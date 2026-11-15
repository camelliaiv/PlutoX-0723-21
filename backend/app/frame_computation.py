"""Live computation of the frames response shared by the API and the precompute command."""

import httpx
import numpy as np
from astropy.coordinates import SkyCoord

from app import frame_cache, spherex_archive
from app.aperture_photometry import FLUX_UNIT
from app.epoch_coadd import (
    PIXEL_SCALE_ARCSECONDS,
    SURVEY_MIDPOINT_TIME,
    EpochFrame,
    build_epoch_frames,
)
from app.frames_models import (
    DisplayRange,
    FrameResponse,
    FramesResponse,
    GridDescription,
    SkyPosition,
)
from app.mirror_cutout import http_range_reader
from app.spherex_archive import COLLECTION_TITLES, SearchResponseReader
from app.target_astrometry import TargetDescription, target_position_at

DEFAULT_FRAME_SIZE_PIXELS = 32
MINIMUM_FRAME_SIZE_PIXELS = 8
MAXIMUM_FRAME_SIZE_PIXELS = 96
FRAME_SEARCH_RADIUS_DEGREES = 0.01
DISPLAY_RANGE_PERCENTILES = (1.0, 99.5)
SIGNIFICANT_DIGITS = 4
GRID_ORIENTATION = (
    "North up, east left; row 0 of every array is the southern edge, column 0 the eastern edge."
)


def _significant_rows(values: np.ndarray) -> list[list[float | None]]:
    return [
        [float(f"{value:.{SIGNIFICANT_DIGITS}g}") if np.isfinite(value) else None for value in row]
        for row in values
    ]


def _frame_response(frame: EpochFrame) -> FrameResponse:
    return FrameResponse(
        epoch_number=frame.epoch_number,
        start_date=frame.start_date,
        end_date=frame.end_date,
        detector=frame.detector,
        exposure_count=frame.exposure_count,
        skipped_exposure_count=frame.skipped_exposure_count,
        wavelength_min_micrometers=frame.wavelength_min_micrometers,
        wavelength_max_micrometers=frame.wavelength_max_micrometers,
        observation_ids=list(frame.observation_ids),
        data_releases=list(frame.data_releases),
        image=_significant_rows(frame.image),
        variance=_significant_rows(frame.variance),
        coverage=frame.coverage.tolist(),
        saturated_fraction=_significant_rows(frame.saturated_fraction),
        predicted_position=frame.predicted_position,
    )


def _display_range(frames: list[EpochFrame]) -> DisplayRange | None:
    values = np.concatenate([frame.image.ravel() for frame in frames]) if frames else np.empty(0)
    finite_values = values[np.isfinite(values)]
    if finite_values.size == 0:
        return None
    lower, upper = np.percentile(finite_values, DISPLAY_RANGE_PERCENTILES)
    return DisplayRange(minimum=float(lower), maximum=float(upper))


def _sky_position(position: SkyCoord) -> SkyPosition:
    return SkyPosition(right_ascension=float(position.ra.deg), declination=float(position.dec.deg))


def compute_live_frames(
    target_description: TargetDescription,
    detector: int,
    size: int,
    client: httpx.Client,
    read_search_response: SearchResponseReader | None = None,
) -> tuple[FramesResponse, bool]:
    search_position = target_position_at(target_description, SURVEY_MIDPOINT_TIME)
    search = spherex_archive.search_releases(
        search_position.ra.deg,
        search_position.dec.deg,
        FRAME_SEARCH_RADIUS_DEGREES,
        spherex_archive.ARCHIVE_TIMEOUT_SECONDS,
        read_search_response,
    )
    frame_set = build_epoch_frames(
        search.images,
        search.release_by_mirror_url,
        detector,
        target_description,
        size,
        http_range_reader(client),
    )

    notes = [
        f"{COLLECTION_TITLES[release]} was unavailable ({reason}); "
        "the frames use the other release only."
        for release, reason in search.unavailable_releases.items()
    ]
    skipped_exposure_count = sum(frame.skipped_exposure_count for frame in frame_set.frames)
    if skipped_exposure_count:
        exposure_phrase = (
            "1 exposure was"
            if skipped_exposure_count == 1
            else f"{skipped_exposure_count} exposures were"
        )
        notes.append(f"{exposure_phrase} skipped because the target falls outside the detector.")
    if frame_set.epochs_without_frames:
        epoch_list = ", ".join(str(number) for number in frame_set.epochs_without_frames)
        epoch_phrase = (
            f"Epoch {epoch_list} has"
            if len(frame_set.epochs_without_frames) == 1
            else f"Epochs {epoch_list} have"
        )
        notes.append(f"{epoch_phrase} no frame: the target is off the detector there.")
    if not frame_set.frames and not frame_set.epochs_without_frames:
        notes.append(f"No SPHEREx exposures of detector {detector} cover this position.")

    used_releases = {release for frame in frame_set.frames for release in frame.data_releases}
    reference_position = _sky_position(frame_set.reference_position)
    response = FramesResponse(
        reference_position=reference_position,
        reference_date=frame_set.reference_date,
        grid=GridDescription(
            size_pixels=size,
            pixel_scale_arcseconds=PIXEL_SCALE_ARCSECONDS,
            center=reference_position,
            orientation=GRID_ORIENTATION,
        ),
        unit="MJy/sr (image minus zodiacal light)",
        display_range=_display_range(frame_set.frames),
        citations=[spherex_archive.citation_for(release) for release in sorted(used_releases)],
        frames=[_frame_response(frame) for frame in frame_set.frames],
        exposures=frame_set.exposures,
        flux_unit=FLUX_UNIT,
        notes=notes,
        served_from_cache=False,
        computed_at=frame_cache.current_timestamp(),
    )
    is_complete = not search.unavailable_releases and bool(frame_set.frames)
    return response, is_complete
