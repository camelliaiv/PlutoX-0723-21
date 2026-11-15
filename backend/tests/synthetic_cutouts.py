"""Synthetic stand-ins for mirror cutouts: a Gaussian star on a rotated, offset detector grid."""

import numpy as np
from astropy import units
from astropy.coordinates import SkyCoord
from astropy.wcs import WCS

from app import mirror_cutout
from app.mirror_cutout import CenterOutsideImageError, MirrorCutout
from app.spherex_archive import ObservationImage

SYNTHETIC_CUTOUT_SIZE = 41
STAR_SIGMA_PIXELS = 1.5
STAR_AMPLITUDE = 100.0
SYNTHETIC_ZODI_LEVEL = 7.0
SYNTHETIC_VARIANCE = 4.0
SYNTHETIC_STAR = SkyCoord(120.0 * units.deg, 30.0 * units.deg)


def synthetic_wcs(star: SkyCoord, rotation_degrees: float, offset_pixels: float) -> WCS:
    rotation = np.radians(rotation_degrees)
    wcs = WCS(naxis=2)
    wcs.wcs.ctype = ["RA---TAN", "DEC--TAN"]
    wcs.wcs.cunit = ["deg", "deg"]
    wcs.wcs.crval = [star.ra.deg, star.dec.deg]
    wcs.wcs.crpix = [(SYNTHETIC_CUTOUT_SIZE + 1) / 2 + offset_pixels] * 2
    wcs.wcs.cdelt = [-6.15 / 3600, 6.15 / 3600]
    wcs.wcs.pc = [[np.cos(rotation), -np.sin(rotation)], [np.sin(rotation), np.cos(rotation)]]
    return wcs


def synthetic_cutout(
    star: SkyCoord,
    rotation_degrees: float,
    offset_pixels: float,
    wavelength_micrometers: float,
    observation_id: str,
    modified_julian_date: float = 61000.0,
    saturate_star: bool = False,
) -> MirrorCutout:
    wcs = synthetic_wcs(star, rotation_degrees, offset_pixels)
    star_column, star_row = (float(value) for value in wcs.world_to_pixel(star))
    rows, columns = np.mgrid[0:SYNTHETIC_CUTOUT_SIZE, 0:SYNTHETIC_CUTOUT_SIZE]
    squared_distance = (columns - star_column) ** 2 + (rows - star_row) ** 2
    star_image = STAR_AMPLITUDE * np.exp(-squared_distance / (2 * STAR_SIGMA_PIXELS**2))
    flags = np.zeros(star_image.shape, dtype=np.int32)
    if saturate_star:
        flags[squared_distance < 4] = 1 << 26
    return MirrorCutout(
        image=(star_image + SYNTHETIC_ZODI_LEVEL).astype(np.float32),
        variance=np.full(star_image.shape, SYNTHETIC_VARIANCE, dtype=np.float32),
        zodiacal_light=np.full(star_image.shape, SYNTHETIC_ZODI_LEVEL, dtype=np.float32),
        flags=flags,
        celestial_wcs=wcs,
        origin_x=0,
        origin_y=0,
        wavelength_micrometers=wavelength_micrometers,
        bandwidth_micrometers=0.02,
        modified_julian_date_average=modified_julian_date,
        exposure_seconds=112.5,
        detector=5,
        observation_id=observation_id,
    )


def synthetic_image(
    observation_id: str, modified_julian_date: float, detector: int = 5
) -> ObservationImage:
    return ObservationImage(
        observation_id=observation_id,
        observation_start_modified_julian_date=modified_julian_date,
        observation_date=f"synthetic-{modified_julian_date}",
        detector_band=f"SPHEREx-D{detector}",
        wavelength_min_micrometers=0.0,
        wavelength_max_micrometers=0.0,
        download_url="",
        mirror_url=f"https://example.org/synthetic/{observation_id}_D{detector}.fits",
    )


def install_synthetic_cutouts(
    monkeypatch,
    images: list[ObservationImage],
    star: SkyCoord = SYNTHETIC_STAR,
    outside_observation_ids: frozenset[str] = frozenset(),
    saturate_star: bool = False,
) -> None:
    """Replace the mirror read; each image gets its own rotation, offset and wavelength."""
    image_by_url = {image.mirror_url: image for image in images}
    cutout_by_url = {
        image.mirror_url: (index, image.observation_id) for index, image in enumerate(images)
    }

    def read_synthetic_cutout(url, center, size_pixels, read_range=None):
        index, observation_id = cutout_by_url[url]
        if observation_id in outside_observation_ids:
            raise CenterOutsideImageError("synthetic position outside the detector")
        return synthetic_cutout(
            star,
            rotation_degrees=17.0 * index,
            offset_pixels=float(index % 3),
            wavelength_micrometers=1.0 + 0.1 * index,
            observation_id=observation_id,
            modified_julian_date=image_by_url[url].observation_start_modified_julian_date,
            saturate_star=saturate_star,
        )

    monkeypatch.setattr(mirror_cutout, "read_cutout", read_synthetic_cutout)
