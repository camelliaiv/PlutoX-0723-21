import math

import numpy as np
import pytest

from app import aperture_photometry

IMAGE_SIZE = 21
CENTER = 10.0
SYNTHETIC_BACKGROUND = 5.0
SYNTHETIC_VARIANCE = 4.0
SYNTHETIC_SOURCE_PIXEL_VALUE = 3.0
SCALE = aperture_photometry.PIXEL_SOLID_ANGLE_STERADIANS * 1e9


def synthetic_layers():
    """Flat background with a constant-brightness disc exactly covering the aperture."""
    signal = np.full((IMAGE_SIZE, IMAGE_SIZE), SYNTHETIC_BACKGROUND)
    distances = aperture_photometry.distances_from(signal.shape, CENTER, CENTER)
    aperture = distances <= aperture_photometry.APERTURE_RADIUS_PIXELS
    signal[aperture] += SYNTHETIC_SOURCE_PIXEL_VALUE
    variance = np.full(signal.shape, SYNTHETIC_VARIANCE)
    saturated = np.zeros(signal.shape, dtype=bool)
    return signal, variance, saturated, int(aperture.sum())


def test_aperture_pixel_count_for_a_centered_radius_of_two():
    assert synthetic_layers()[3] == 13


def test_flux_and_error_match_hand_computed_values():
    signal, variance, saturated, pixel_count = synthetic_layers()
    result = aperture_photometry.measure_aperture(signal, variance, saturated, CENTER, CENTER)
    assert result.flux_millijansky == pytest.approx(
        pixel_count * SYNTHETIC_SOURCE_PIXEL_VALUE * SCALE
    )
    assert result.flux_error_millijansky == pytest.approx(
        math.sqrt(pixel_count * SYNTHETIC_VARIANCE) * SCALE
    )
    assert result.saturated_fraction == 0.0
    assert result.non_finite_fraction == 0.0


def test_the_flat_background_is_subtracted():
    signal, variance, saturated, _ = synthetic_layers()
    shifted = aperture_photometry.measure_aperture(
        signal + 100.0, variance, saturated, CENTER, CENTER
    )
    original = aperture_photometry.measure_aperture(signal, variance, saturated, CENTER, CENTER)
    assert shifted.flux_millijansky == pytest.approx(original.flux_millijansky)


def test_the_background_is_a_median_that_ignores_a_bright_neighbour():
    signal, variance, saturated, pixel_count = synthetic_layers()
    signal[10, 15] = 1e6
    result = aperture_photometry.measure_aperture(signal, variance, saturated, CENTER, CENTER)
    assert result.flux_millijansky == pytest.approx(
        pixel_count * SYNTHETIC_SOURCE_PIXEL_VALUE * SCALE
    )


def test_non_finite_aperture_pixels_are_left_out_and_counted():
    signal, variance, saturated, pixel_count = synthetic_layers()
    signal[10, 10] = np.nan
    result = aperture_photometry.measure_aperture(signal, variance, saturated, CENTER, CENTER)
    assert result.non_finite_fraction == pytest.approx(1 / pixel_count)
    assert result.flux_millijansky == pytest.approx(
        (pixel_count - 1) * SYNTHETIC_SOURCE_PIXEL_VALUE * SCALE
    )
    assert result.flux_error_millijansky == pytest.approx(
        math.sqrt((pixel_count - 1) * SYNTHETIC_VARIANCE) * SCALE
    )


def test_an_aperture_without_finite_pixels_has_no_flux():
    signal, variance, saturated, _ = synthetic_layers()
    signal[:] = np.nan
    result = aperture_photometry.measure_aperture(signal, variance, saturated, CENTER, CENTER)
    assert result.flux_millijansky is None
    assert result.flux_error_millijansky is None
    assert result.non_finite_fraction == 1.0


def test_saturated_fraction_is_the_share_of_aperture_pixels():
    signal, variance, saturated, pixel_count = synthetic_layers()
    saturated[10, 10] = saturated[10, 11] = True
    saturated[0, 0] = True
    result = aperture_photometry.measure_aperture(signal, variance, saturated, CENTER, CENTER)
    assert result.saturated_fraction == pytest.approx(2 / pixel_count)


def test_a_position_far_outside_the_image_has_no_measurement():
    signal, variance, saturated, _ = synthetic_layers()
    result = aperture_photometry.measure_aperture(signal, variance, saturated, 100.0, 100.0)
    assert result == aperture_photometry.AperturePhotometry(None, None, None, None)
