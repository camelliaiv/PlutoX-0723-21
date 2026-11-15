"""Per-epoch, per-detector coadds of SPHEREx cutouts on one fixed sky grid.

Every exposure is resampled onto the same north-up grid, so motion of the target between epochs
shows up as motion across the frames.
"""

import math
from collections.abc import Mapping
from concurrent.futures import ThreadPoolExecutor
from dataclasses import dataclass

import numpy as np
from astropy.coordinates import SkyCoord
from astropy.time import Time
from astropy.wcs import WCS
from scipy.ndimage import map_coordinates

from app import mirror_cutout
from app.aperture_photometry import measure_aperture
from app.frames_models import ExposureMeasurement, PredictedPosition
from app.mirror_cutout import ByteRangeReader, CenterOutsideImageError, MirrorCutout
from app.spherex_archive import (
    Collection,
    ObservationImage,
    detector_number,
    split_into_epochs,
)
from app.target_astrometry import TargetDescription, target_position_at

FRAME_RECIPE_VERSION = 2
PIXEL_SCALE_ARCSECONDS = 6.15
CUTOUT_MARGIN_PIXELS = 6
MAXIMUM_WORKER_COUNT = 8
MINIMUM_FINITE_FRACTION = 0.999
SURVEY_MIDPOINT_TIME = Time(2026.0, format="jyear")
SATURATION_FLAG_BITS = (1, 2, 26)
SATURATION_FLAG_MASK = sum(1 << bit for bit in SATURATION_FLAG_BITS)


@dataclass(frozen=True)
class FrameGeometry:
    grid: WCS
    size_pixels: int
    cutout_size_pixels: int


@dataclass(frozen=True)
class ResampledExposure:
    signal: np.ndarray
    variance: np.ndarray
    saturated: np.ndarray
    wavelength_micrometers: float
    observation_id: str
    data_release: Collection
    measurement: ExposureMeasurement


@dataclass(frozen=True)
class Coadd:
    image: np.ndarray
    variance: np.ndarray
    coverage: np.ndarray


@dataclass(frozen=True)
class EpochFrame:
    epoch_number: int
    start_date: str
    end_date: str
    detector: int
    exposure_count: int
    skipped_exposure_count: int
    wavelength_min_micrometers: float
    wavelength_max_micrometers: float
    observation_ids: tuple[str, ...]
    data_releases: tuple[Collection, ...]
    image: np.ndarray
    variance: np.ndarray
    coverage: np.ndarray
    saturated_fraction: np.ndarray
    predicted_position: PredictedPosition


@dataclass(frozen=True)
class FrameSet:
    reference_position: SkyCoord
    reference_date: str
    frames: list[EpochFrame]
    exposures: list[ExposureMeasurement]
    epochs_without_frames: list[int]


def build_output_grid(center: SkyCoord, size_pixels: int) -> WCS:
    """Tangent-plane grid with north up and east left; array row 0 is the southern edge."""
    pixel_scale_degrees = PIXEL_SCALE_ARCSECONDS / 3600
    grid = WCS(naxis=2)
    grid.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    grid.wcs.cunit = ["deg", "deg"]
    grid.wcs.crval = [center.ra.deg, center.dec.deg]
    grid.wcs.crpix = [(size_pixels + 1) / 2, (size_pixels + 1) / 2]
    grid.wcs.cdelt = [-pixel_scale_degrees, pixel_scale_degrees]
    grid.pixel_shape = (size_pixels, size_pixels)
    return grid


def cutout_size_for(size_pixels: int) -> int:
    """Side of a cutout that covers the grid however the detector is rotated on the sky."""
    return math.ceil(size_pixels * math.sqrt(2)) + 2 * CUTOUT_MARGIN_PIXELS


def source_pixel_coordinates(grid: WCS, source_wcs: WCS, size_pixels: int) -> np.ndarray:
    """Source-image (row, column) of every grid pixel, shaped (2, rows, columns)."""
    columns, rows = np.meshgrid(np.arange(size_pixels), np.arange(size_pixels))
    longitude, latitude = grid.pixel_to_world_values(columns, rows)
    source_columns, source_rows = source_wcs.world_to_pixel_values(longitude, latitude)
    return np.stack([source_rows, source_columns])


def resample_bilinear(layer: np.ndarray, coordinates: np.ndarray) -> np.ndarray:
    """Bilinear resampling; grid pixels not fully surrounded by finite values become NaN."""
    finite = np.isfinite(layer)
    interpolated = map_coordinates(
        np.where(finite, layer, 0.0).astype(np.float64),
        coordinates,
        order=1,
        mode="constant",
        cval=np.nan,
    )
    finite_fraction = map_coordinates(
        finite.astype(np.float64), coordinates, order=1, mode="constant", cval=np.nan
    )
    complete = finite_fraction >= MINIMUM_FINITE_FRACTION
    safe_fraction = np.where(complete, finite_fraction, 1.0)
    return np.where(complete, interpolated / safe_fraction, np.nan)


def resample_nearest(mask: np.ndarray, coordinates: np.ndarray) -> np.ndarray:
    nearest = map_coordinates(
        mask.astype(np.float32), coordinates, order=0, mode="constant", cval=0.0
    )
    return nearest > 0.5


def contributing_mask(signal: np.ndarray, variance: np.ndarray) -> np.ndarray:
    return np.isfinite(signal) & np.isfinite(variance) & (variance > 0)


def weighted_coadd(signal: np.ndarray, variance: np.ndarray) -> Coadd:
    """Inverse-variance weighted mean over the first axis of stacked exposures."""
    contributing = contributing_mask(signal, variance)
    weights = np.divide(1.0, variance, out=np.zeros_like(variance), where=contributing)
    weight_sum = weights.sum(axis=0)
    weighted_signal_sum = np.where(contributing, signal * weights, 0.0).sum(axis=0)
    has_weight = weight_sum > 0
    safe_weight_sum = np.where(has_weight, weight_sum, 1.0)
    return Coadd(
        image=np.where(has_weight, weighted_signal_sum / safe_weight_sum, np.nan),
        variance=np.where(has_weight, 1.0 / safe_weight_sum, np.nan),
        coverage=contributing.sum(axis=0),
    )


def saturated_fraction(
    saturated: np.ndarray, signal: np.ndarray, variance: np.ndarray
) -> np.ndarray:
    """Share of the contributing exposures that were saturated, NaN where none contributed."""
    contributing = contributing_mask(signal, variance)
    contributing_count = contributing.sum(axis=0)
    saturated_count = (saturated & contributing).sum(axis=0)
    safe_count = np.where(contributing_count > 0, contributing_count, 1)
    return np.where(contributing_count > 0, saturated_count / safe_count, np.nan)


def measure_cutout(
    cutout: MirrorCutout, position: SkyCoord, data_release: Collection, epoch_number: int
) -> ExposureMeasurement:
    """Aperture photometry at the target position, in the native pixels of the cutout."""
    column, row = (float(value) for value in cutout.celestial_wcs.world_to_pixel(position))
    photometry = measure_aperture(
        cutout.image.astype(np.float64) - cutout.zodiacal_light,
        cutout.variance.astype(np.float64),
        (cutout.flags & SATURATION_FLAG_MASK) != 0,
        column,
        row,
    )
    return ExposureMeasurement(
        observation_id=cutout.observation_id,
        data_release=data_release,
        epoch_number=epoch_number,
        modified_julian_date=cutout.modified_julian_date_average,
        wavelength_micrometers=cutout.wavelength_micrometers,
        bandwidth_micrometers=cutout.bandwidth_micrometers,
        flux_millijansky=photometry.flux_millijansky,
        flux_error_millijansky=photometry.flux_error_millijansky,
        saturated_fraction=photometry.saturated_fraction,
        non_finite_fraction=photometry.non_finite_fraction,
    )


def predicted_position_on_grid(grid: WCS, position: SkyCoord) -> PredictedPosition:
    """Fractional (column, row) of a sky position on the output grid, with its coordinates."""
    column, row = (float(value) for value in grid.world_to_pixel(position))
    return PredictedPosition(
        column=column,
        row=row,
        right_ascension=float(position.ra.deg),
        declination=float(position.dec.deg),
    )


def resample_cutout(
    cutout: MirrorCutout, geometry: FrameGeometry, measurement: ExposureMeasurement
) -> ResampledExposure:
    signal = cutout.image.astype(np.float64) - cutout.zodiacal_light
    variance = cutout.variance.astype(np.float64)
    usable = np.isfinite(signal) & np.isfinite(variance)
    coordinates = source_pixel_coordinates(
        geometry.grid, cutout.celestial_wcs, geometry.size_pixels
    )
    return ResampledExposure(
        signal=resample_bilinear(np.where(usable, signal, np.nan), coordinates),
        variance=resample_bilinear(np.where(usable, variance, np.nan), coordinates),
        saturated=resample_nearest((cutout.flags & SATURATION_FLAG_MASK) != 0, coordinates),
        wavelength_micrometers=cutout.wavelength_micrometers,
        observation_id=cutout.observation_id,
        data_release=measurement.data_release,
        measurement=measurement,
    )


def reference_time_of(images: list[ObservationImage]) -> Time:
    """Midpoint between the first and the last exposure."""
    if not images:
        return SURVEY_MIDPOINT_TIME
    modified_julian_dates = [image.observation_start_modified_julian_date for image in images]
    return Time((min(modified_julian_dates) + max(modified_julian_dates)) / 2, format="mjd")


def _resample_exposure(
    image: ObservationImage,
    data_release: Collection,
    epoch_number: int,
    target: TargetDescription,
    geometry: FrameGeometry,
    read_range: ByteRangeReader,
) -> ResampledExposure | None:
    observation_time = Time(image.observation_start_modified_julian_date, format="mjd")
    try:
        position = target_position_at(target, observation_time)
        cutout = mirror_cutout.read_cutout(
            image.mirror_url, position, geometry.cutout_size_pixels, read_range
        )
    except CenterOutsideImageError:
        return None
    measurement = measure_cutout(cutout, position, data_release, epoch_number)
    return resample_cutout(cutout, geometry, measurement)


def build_epoch_frame(
    epoch_number: int,
    detector: int,
    exposures: list[ResampledExposure],
    images: list[ObservationImage],
    skipped_exposure_count: int,
    predicted_position: PredictedPosition,
) -> EpochFrame:
    signal = np.stack([exposure.signal for exposure in exposures])
    variance = np.stack([exposure.variance for exposure in exposures])
    saturated = np.stack([exposure.saturated for exposure in exposures])
    coadd = weighted_coadd(signal, variance)
    wavelengths = [exposure.wavelength_micrometers for exposure in exposures]
    return EpochFrame(
        epoch_number=epoch_number,
        start_date=min(image.observation_date for image in images),
        end_date=max(image.observation_date for image in images),
        detector=detector,
        exposure_count=len(exposures),
        skipped_exposure_count=skipped_exposure_count,
        wavelength_min_micrometers=min(wavelengths),
        wavelength_max_micrometers=max(wavelengths),
        observation_ids=tuple(dict.fromkeys(exposure.observation_id for exposure in exposures)),
        data_releases=tuple(
            sorted(
                {exposure.data_release for exposure in exposures}, key=lambda release: release.value
            )
        ),
        image=coadd.image,
        variance=coadd.variance,
        coverage=coadd.coverage,
        saturated_fraction=saturated_fraction(saturated, signal, variance),
        predicted_position=predicted_position,
    )


def build_epoch_frames(
    images: list[ObservationImage],
    release_by_mirror_url: Mapping[str, Collection],
    detector: int,
    target: TargetDescription,
    size_pixels: int,
    read_range: ByteRangeReader,
) -> FrameSet:
    detector_images = [image for image in images if detector_number(image) == detector]
    reference_time = reference_time_of(detector_images)
    reference_position = target_position_at(target, reference_time)
    geometry = FrameGeometry(
        grid=build_output_grid(reference_position, size_pixels),
        size_pixels=size_pixels,
        cutout_size_pixels=cutout_size_for(size_pixels),
    )

    frames: list[EpochFrame] = []
    epochs_without_frames: list[int] = []
    measurements: list[ExposureMeasurement] = []
    with ThreadPoolExecutor(max_workers=MAXIMUM_WORKER_COUNT) as pool:
        for epoch_number, epoch_images in enumerate(split_into_epochs(images), start=1):
            epoch_detector_images = [
                image for image in epoch_images if detector_number(image) == detector
            ]
            if not epoch_detector_images:
                continue
            resampled = list(
                pool.map(
                    lambda image, epoch_number=epoch_number: _resample_exposure(
                        image,
                        release_by_mirror_url[image.mirror_url],
                        epoch_number,
                        target,
                        geometry,
                        read_range,
                    ),
                    epoch_detector_images,
                )
            )
            used = [
                (image, exposure)
                for image, exposure in zip(epoch_detector_images, resampled, strict=True)
                if exposure is not None
            ]
            if not used:
                epochs_without_frames.append(epoch_number)
                continue
            used_images = [image for image, _ in used]
            predicted_position = predicted_position_on_grid(
                geometry.grid, target_position_at(target, reference_time_of(used_images))
            )
            frames.append(
                build_epoch_frame(
                    epoch_number,
                    detector,
                    [exposure for _, exposure in used],
                    used_images,
                    len(epoch_detector_images) - len(used),
                    predicted_position,
                )
            )
            measurements.extend(exposure.measurement for _, exposure in used)
    return FrameSet(
        reference_position=reference_position,
        reference_date=reference_time.strftime("%Y-%m-%dT%H:%M:%S"),
        frames=frames,
        exposures=sorted(measurements, key=lambda item: item.modified_julian_date),
        epochs_without_frames=epochs_without_frames,
    )
