import numpy as np
import pytest
from astropy import units
from astropy.coordinates import SkyCoord

from app import epoch_coadd
from app.spherex_archive import Collection
from app.target_astrometry import FixedTarget
from tests.synthetic_cutouts import (
    SYNTHETIC_STAR,
    install_synthetic_cutouts,
    synthetic_image,
)

GRID_SIZE = 15
EPOCH_ONE_START = 61000.0
EPOCH_TWO_START = 61100.0


def two_epoch_images():
    return [
        synthetic_image("epoch_one_a", EPOCH_ONE_START),
        synthetic_image("epoch_one_b", EPOCH_ONE_START + 0.1),
        synthetic_image("epoch_one_other_detector", EPOCH_ONE_START + 0.2, detector=3),
        synthetic_image("epoch_two_a", EPOCH_TWO_START),
        synthetic_image("epoch_two_b", EPOCH_TWO_START + 0.1),
    ]


def release_map(images):
    return {image.mirror_url: Collection.DATA_RELEASE_1 for image in images}


def build_frames(images, monkeypatch, **options):
    install_synthetic_cutouts(monkeypatch, images, **options)
    return epoch_coadd.build_epoch_frames(
        images,
        release_map(images),
        detector=5,
        target=FixedTarget(SYNTHETIC_STAR),
        size_pixels=GRID_SIZE,
        read_range=None,
    )


def test_output_grid_is_north_up_east_left_centered_on_the_reference():
    center = SkyCoord(10.0 * units.deg, 20.0 * units.deg)
    grid = epoch_coadd.build_output_grid(center, GRID_SIZE)
    middle = (GRID_SIZE - 1) / 2
    middle_sky = grid.pixel_to_world(middle, middle)
    north_sky = grid.pixel_to_world(middle, middle + 1)
    east_sky = grid.pixel_to_world(middle - 1, middle)
    assert middle_sky.separation(center).arcsec == pytest.approx(0, abs=1e-6)
    assert middle_sky.separation(north_sky).arcsec == pytest.approx(6.15, rel=1e-4)
    assert north_sky.dec > middle_sky.dec
    assert east_sky.ra > middle_sky.ra


def test_every_epoch_shares_one_grid_so_a_fixed_star_stays_at_the_center(monkeypatch):
    frame_set = build_frames(two_epoch_images(), monkeypatch)
    assert len(frame_set.frames) == 2
    middle = (GRID_SIZE - 1) // 2
    for frame in frame_set.frames:
        peak = np.unravel_index(np.nanargmax(frame.image), frame.image.shape)
        assert peak == (middle, middle)
        assert frame.image[middle, middle] == pytest.approx(100.0, rel=1e-4)


def test_resampling_with_an_integer_shift_reproduces_the_values():
    center = SkyCoord(10.0 * units.deg, 20.0 * units.deg)
    grid = epoch_coadd.build_output_grid(center, GRID_SIZE)
    source_size = 30
    source_wcs = epoch_coadd.build_output_grid(center, source_size)
    source_wcs.wcs.crpix = [(GRID_SIZE + 1) / 2 + 3, (GRID_SIZE + 1) / 2 + 2]
    layer = np.random.default_rng(3).normal(size=(source_size, source_size))

    coordinates = epoch_coadd.source_pixel_coordinates(grid, source_wcs, GRID_SIZE)
    resampled = epoch_coadd.resample_bilinear(layer, coordinates)

    expected = layer[2 : 2 + GRID_SIZE, 3 : 3 + GRID_SIZE]
    assert resampled == pytest.approx(expected, abs=1e-6)


def test_grid_pixels_outside_the_source_are_missing():
    coordinates = np.array([[[-5.0, 1.0]], [[1.0, 1.0]]])
    resampled = epoch_coadd.resample_bilinear(np.ones((4, 4)), coordinates)
    assert np.isnan(resampled[0, 0])
    assert resampled[0, 1] == pytest.approx(1.0)


def test_pixels_touching_non_finite_values_are_missing():
    layer = np.ones((5, 5))
    layer[2, 2] = np.nan
    coordinates = np.array([[[2.0, 2.5, 1.0]], [[2.0, 2.0, 1.0]]])
    resampled = epoch_coadd.resample_bilinear(layer, coordinates)
    assert np.isnan(resampled[0, 0])
    assert np.isnan(resampled[0, 1])
    assert resampled[0, 2] == pytest.approx(1.0)


def test_nearest_resampling_of_a_mask():
    mask = np.zeros((4, 4), dtype=bool)
    mask[1, 2] = True
    coordinates = np.array([[[1.2, 3.0]], [[1.8, 3.0]]])
    assert epoch_coadd.resample_nearest(mask, coordinates).tolist() == [[True, False]]


def test_weighted_mean_and_variance_match_hand_computed_values():
    signal = np.array([[1.0, 5.0, np.nan], [3.0, 9.0, np.nan]])
    variance = np.array([[1.0, 2.0, 1.0], [3.0, 0.0, 1.0]])
    coadd = epoch_coadd.weighted_coadd(signal, variance)
    assert coadd.image[0] == pytest.approx((1 / 1 * 1 + 3 / 3) / (1 + 1 / 3))
    assert coadd.variance[0] == pytest.approx(1 / (1 + 1 / 3))
    assert coadd.image[1] == pytest.approx(5.0)
    assert coadd.variance[1] == pytest.approx(2.0)
    assert np.isnan(coadd.image[2])
    assert np.isnan(coadd.variance[2])
    assert coadd.coverage.tolist() == [2, 1, 0]


def test_saturated_fraction_counts_only_contributing_exposures():
    signal = np.array([[1.0, 1.0, np.nan, np.nan], [1.0, 1.0, 1.0, np.nan]])
    variance = np.ones_like(signal)
    saturated = np.array([[True, False, True, True], [False, False, True, False]])
    fraction = epoch_coadd.saturated_fraction(saturated, signal, variance)
    assert fraction[:3].tolist() == [0.5, 0.0, 1.0]
    assert np.isnan(fraction[3])


def test_frames_belong_to_their_epoch_and_detector(monkeypatch):
    frame_set = build_frames(two_epoch_images(), monkeypatch)
    first, second = frame_set.frames
    assert (first.epoch_number, second.epoch_number) == (1, 2)
    assert first.observation_ids == ("epoch_one_a", "epoch_one_b")
    assert second.observation_ids == ("epoch_two_a", "epoch_two_b")
    assert first.exposure_count == second.exposure_count == 2
    assert first.detector == 5
    assert first.data_releases == (Collection.DATA_RELEASE_1,)
    assert first.wavelength_min_micrometers == pytest.approx(1.0)
    assert first.wavelength_max_micrometers == pytest.approx(1.1)
    assert first.coverage[GRID_SIZE // 2, GRID_SIZE // 2] == 2


def test_reference_time_is_the_midpoint_of_the_request(monkeypatch):
    frame_set = build_frames(two_epoch_images(), monkeypatch)
    assert frame_set.reference_date == "2026-01-10T01:12:00"


def test_exposures_outside_the_detector_are_skipped_and_counted(monkeypatch):
    frame_set = build_frames(
        two_epoch_images(), monkeypatch, outside_observation_ids=frozenset({"epoch_one_b"})
    )
    first = frame_set.frames[0]
    assert first.exposure_count == 1
    assert first.skipped_exposure_count == 1
    assert first.observation_ids == ("epoch_one_a",)


def test_an_epoch_with_no_usable_exposure_gets_no_frame(monkeypatch):
    frame_set = build_frames(
        two_epoch_images(),
        monkeypatch,
        outside_observation_ids=frozenset({"epoch_two_a", "epoch_two_b"}),
    )
    assert [frame.epoch_number for frame in frame_set.frames] == [1]
    assert frame_set.epochs_without_frames == [2]


def test_signal_is_image_minus_zodiacal_light(monkeypatch):
    frame_set = build_frames(two_epoch_images(), monkeypatch)
    corner = frame_set.frames[0].image[0, 0]
    assert abs(corner) < 1e-3


def test_saturation_is_shown_not_hidden(monkeypatch):
    frame_set = build_frames(two_epoch_images(), monkeypatch, saturate_star=True)
    middle = GRID_SIZE // 2
    frame = frame_set.frames[0]
    assert frame.saturated_fraction[middle, middle] == pytest.approx(1.0)
    assert frame.saturated_fraction[0, 0] == pytest.approx(0.0)
    assert frame.coverage[middle, middle] == 2
    assert np.isfinite(frame.image[middle, middle])
