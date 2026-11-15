"""Aperture photometry of a target on a native-pixel cutout, with a local background estimate."""

import math
from dataclasses import dataclass

import numpy as np

APERTURE_RADIUS_PIXELS = 2.0
BACKGROUND_INNER_RADIUS_PIXELS = 4.0
BACKGROUND_OUTER_RADIUS_PIXELS = 7.0
NOMINAL_PIXEL_SCALE_ARCSECONDS = 6.15
MILLIJANSKY_PER_MEGAJANSKY = 1e9
PIXEL_SOLID_ANGLE_STERADIANS = math.radians(NOMINAL_PIXEL_SCALE_ARCSECONDS / 3600) ** 2
FLUX_UNIT = "mJy (approximate: nominal pixel area, no aperture correction)"


@dataclass(frozen=True)
class AperturePhotometry:
    flux_millijansky: float | None
    flux_error_millijansky: float | None
    saturated_fraction: float | None
    non_finite_fraction: float | None


def distances_from(shape: tuple[int, int], column: float, row: float) -> np.ndarray:
    """Distance of every pixel centre from a sub-pixel position, in pixels."""
    rows, columns = np.indices(shape)
    return np.hypot(columns - column, rows - row)


def measure_aperture(
    signal: np.ndarray,
    variance: np.ndarray,
    saturated: np.ndarray,
    column: float,
    row: float,
) -> AperturePhotometry:
    """Background-subtracted flux in a circular aperture, in millijansky.

    The background is the median signal of the surrounding annulus. When the aperture holds no
    finite pixel, or the annulus none, the flux and its error are missing rather than guessed.
    """
    distances = distances_from(signal.shape, column, row)
    in_aperture = distances <= APERTURE_RADIUS_PIXELS
    in_annulus = (distances >= BACKGROUND_INNER_RADIUS_PIXELS) & (
        distances < BACKGROUND_OUTER_RADIUS_PIXELS
    )
    aperture_pixel_count = int(in_aperture.sum())
    if aperture_pixel_count == 0:
        return AperturePhotometry(None, None, None, None)

    usable_aperture = in_aperture & np.isfinite(signal) & np.isfinite(variance)
    usable_annulus = in_annulus & np.isfinite(signal)
    saturated_fraction = float((saturated & in_aperture).sum() / aperture_pixel_count)
    non_finite_fraction = 1.0 - float(usable_aperture.sum() / aperture_pixel_count)
    if not usable_aperture.any() or not usable_annulus.any():
        return AperturePhotometry(None, None, saturated_fraction, non_finite_fraction)

    background = float(np.median(signal[usable_annulus]))
    aperture_sum = float((signal[usable_aperture] - background).sum())
    aperture_variance = float(variance[usable_aperture].sum())
    scale = PIXEL_SOLID_ANGLE_STERADIANS * MILLIJANSKY_PER_MEGAJANSKY
    return AperturePhotometry(
        flux_millijansky=aperture_sum * scale,
        flux_error_millijansky=math.sqrt(aperture_variance) * scale,
        saturated_fraction=saturated_fraction,
        non_finite_fraction=non_finite_fraction,
    )
