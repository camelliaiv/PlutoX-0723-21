import json
import warnings
from pathlib import Path

import numpy as np
import pytest
from astropy.io import fits
from astropy.time import Time
from astropy.wcs import WCS, FITSFixedWarning

from app import mirror_cutout, spherex_archive
from app.errors import ArchiveError
from app.mirror_cutout import CenterOutsideImageError
from app.target_astrometry import CHALLENGE_TARGETS, position_at

SYNTHETIC_WIDTH = 40
SYNTHETIC_HEIGHT = 30
SYNTHETIC_URL = "https://example.org/synthetic_test_input.fits"
SYNTHETIC_FLAG_NAMES = {0: "TRANSIENT", 1: "OVERFLOW", 21: "SOURCE"}
CONTROL_POINT_COUNT = 9
CONTROL_POINT_SPACING = 5
WAVELENGTH_AT_FIRST_COLUMN = 1.0
WAVELENGTH_STEP_PER_COLUMN = 0.01


def synthetic_image_header() -> fits.Header:
    """Header of a synthetic test input: a small tangent-plane image with a wavelength lookup."""
    return fits.Header(
        {
            "EXTNAME": "IMAGE",
            "CTYPE1": "RA---TAN",
            "CTYPE2": "DEC--TAN",
            "CRPIX1": SYNTHETIC_WIDTH / 2,
            "CRPIX2": SYNTHETIC_HEIGHT / 2,
            "CRVAL1": 100.0,
            "CRVAL2": 10.0,
            "CD1_1": -6.15 / 3600,
            "CD1_2": 0.0,
            "CD2_1": 0.0,
            "CD2_2": 6.15 / 3600,
            "CUNIT1": "deg",
            "CUNIT2": "deg",
            "MJD-AVG": 61000.5,
            "XPOSURE": 112.5,
            "DETECTOR": 3,
            "OBSID": "synthetic_test_input",
            "WCSAXESW": 2,
            "CNAME1W": "Wavelength",
            "CNAME2W": "Bandwidth",
            "CRPIX1W": 1,
            "CRPIX2W": 1,
            "CDELT1W": 1,
            "CDELT2W": 1,
            "CUNIT1W": "um",
            "CUNIT2W": "um",
            "CTYPE1W": "WAVE-TAB",
            "CTYPE2W": "WAVE-TAB",
            "CRVAL1W": 1,
            "CRVAL2W": 1,
            "PV1_3W": 1,
            "PV2_3W": 2,
            "PS1_0W": "WCS-WAVE",
            "PS2_0W": "WCS-WAVE",
            "PS1_1W": "VALUES",
            "PS2_1W": "VALUES",
            "PS1_2W": "X",
            "PS2_2W": "Y",
        }
    )


def synthetic_layer(seed: int) -> np.ndarray:
    layer = np.random.default_rng(seed).normal(size=(SYNTHETIC_HEIGHT, SYNTHETIC_WIDTH))
    layer = layer.astype(np.float32)
    layer[3, 4] = np.nan
    return layer


def synthetic_wavelength_table() -> fits.BinTableHDU:
    control_points = np.arange(CONTROL_POINT_COUNT) * CONTROL_POINT_SPACING + 1
    wavelengths = WAVELENGTH_AT_FIRST_COLUMN + WAVELENGTH_STEP_PER_COLUMN * (
        np.broadcast_to(control_points, (CONTROL_POINT_COUNT, CONTROL_POINT_COUNT)) - 1
    )
    values = np.stack([wavelengths, np.full_like(wavelengths, 0.02)], axis=-1)
    columns = [
        fits.Column(name="X", format="9J", dim="(9)", array=control_points[np.newaxis]),
        fits.Column(name="Y", format="9J", dim="(9)", array=control_points[np.newaxis]),
        fits.Column(
            name="VALUES",
            format="162E",
            dim="(2,9,9)",
            array=values[np.newaxis].astype(np.float32),
        ),
    ]
    return fits.BinTableHDU.from_columns(columns, name="WCS-WAVE")


def write_synthetic_file(path: Path) -> Path:
    flags = np.random.default_rng(7).integers(0, 2**26, size=(SYNTHETIC_HEIGHT, SYNTHETIC_WIDTH))
    flags_header = fits.Header(
        {f"MSKN{bit:04d}": name for bit, name in SYNTHETIC_FLAG_NAMES.items()}
    )
    point_spread_table = fits.BinTableHDU.from_columns(
        [fits.Column(name="PSF", format="100E", array=np.ones((1000, 100), dtype=np.float32))],
        name="EPSF",
    )
    header_data_units = fits.HDUList(
        [
            fits.PrimaryHDU(),
            fits.ImageHDU(synthetic_layer(1), header=synthetic_image_header(), name="IMAGE"),
            fits.CompImageHDU(
                flags.astype(np.int32),
                header=flags_header,
                compression_type="RICE_1",
                tile_shape=(1, SYNTHETIC_WIDTH),
                name="FLAGS",
            ),
            fits.ImageHDU(synthetic_layer(2), name="VARIANCE"),
            fits.ImageHDU(synthetic_layer(3), name="ZODI"),
            point_spread_table,
            synthetic_wavelength_table(),
        ]
    )
    header_data_units.writeto(path)
    return path


class RecordingReader:
    def __init__(self, path: Path):
        self.content = path.read_bytes()
        self.requests: list[tuple[int, int]] = []

    def __call__(self, url: str, start: int, length: int) -> bytes:
        self.requests.append((start, length))
        return self.content[start : start + length]


@pytest.fixture
def synthetic_path(tmp_path) -> Path:
    return write_synthetic_file(tmp_path / "synthetic_test_input.fits")


@pytest.fixture
def full_wcs(synthetic_path) -> WCS:
    with fits.open(synthetic_path) as header_data_units, warnings.catch_warnings():
        warnings.simplefilter("ignore", FITSFixedWarning)
        return WCS(header_data_units["IMAGE"].header)


def read_synthetic_cutout(synthetic_path, full_wcs, x, y, size):
    reader = RecordingReader(synthetic_path)
    center = full_wcs.pixel_to_world(x, y)
    return mirror_cutout.read_cutout(SYNTHETIC_URL, center, size, read_range=reader), reader


def test_mirror_url_is_built_from_cloud_access_json():
    cloud_access = json.dumps(
        {"aws": {"bucket_name": "bucket", "key": "dr1/file.fits", "region": "us-east-1"}}
    )
    assert mirror_cutout.mirror_url(cloud_access) == (
        "https://bucket.s3.us-east-1.amazonaws.com/dr1/file.fits"
    )


def test_mirror_url_matches_the_archive_search_response(barnard_star_search_response):
    image = spherex_archive.parse_images(barnard_star_search_response)[0]
    assert image.mirror_url.startswith(
        "https://nasa-irsa-spherex.s3.us-east-1.amazonaws.com/dr1/level2/"
    )


@pytest.mark.parametrize(
    ("x", "y", "size"), [(20, 15, 9), (20, 15, 10), (13.2, 7.8, 5), (30, 20, 1)]
)
def test_every_layer_equals_the_full_read_sliced_to_the_window(
    synthetic_path, full_wcs, x, y, size
):
    cutout, _ = read_synthetic_cutout(synthetic_path, full_wcs, x, y, size)
    rows = slice(cutout.origin_y, cutout.origin_y + cutout.image.shape[0])
    columns = slice(cutout.origin_x, cutout.origin_x + cutout.image.shape[1])
    with fits.open(synthetic_path) as header_data_units:
        for name, layer in [
            ("IMAGE", cutout.image),
            ("VARIANCE", cutout.variance),
            ("ZODI", cutout.zodiacal_light),
            ("FLAGS", cutout.flags),
        ]:
            expected = header_data_units[name].data[rows, columns]
            assert np.array_equal(layer, expected, equal_nan=True), name
    assert cutout.image.shape == (size, size)


def test_window_is_clipped_at_the_image_edge_without_padding(synthetic_path, full_wcs):
    cutout, _ = read_synthetic_cutout(synthetic_path, full_wcs, 1, 2, 9)
    assert (cutout.origin_x, cutout.origin_y) == (0, 0)
    assert cutout.image.shape == (7, 6)
    assert cutout.flags.shape == cutout.image.shape

    cutout, _ = read_synthetic_cutout(synthetic_path, full_wcs, SYNTHETIC_WIDTH - 1, 20, 9)
    assert cutout.origin_x == SYNTHETIC_WIDTH - 1 - 4
    assert cutout.image.shape == (9, 5)


def test_center_outside_the_image_raises_a_clear_error(synthetic_path, full_wcs):
    with pytest.raises(CenterOutsideImageError, match="outside"):
        read_synthetic_cutout(synthetic_path, full_wcs, -5, 10, 9)
    with pytest.raises(CenterOutsideImageError):
        read_synthetic_cutout(synthetic_path, full_wcs, 10, SYNTHETIC_HEIGHT + 3, 9)


def test_cutout_size_must_be_positive(synthetic_path, full_wcs):
    with pytest.raises(ValueError, match="at least one pixel"):
        read_synthetic_cutout(synthetic_path, full_wcs, 20, 15, 0)


def test_cutout_wcs_maps_to_the_same_sky_position_as_the_full_frame(synthetic_path, full_wcs):
    cutout, _ = read_synthetic_cutout(synthetic_path, full_wcs, 3, 4, 9)
    for x, y in [(0, 0), (2, 3), (5, 4)]:
        in_cutout = cutout.celestial_wcs.pixel_to_world(x, y)
        in_full_frame = full_wcs.pixel_to_world(x + cutout.origin_x, y + cutout.origin_y)
        assert in_cutout.separation(in_full_frame).arcsec < 1e-6


def test_header_values_and_wavelength_are_reported(synthetic_path, full_wcs):
    cutout, _ = read_synthetic_cutout(synthetic_path, full_wcs, 20, 15, 9)
    assert cutout.detector == 3
    assert cutout.observation_id == "synthetic_test_input"
    assert cutout.modified_julian_date_average == 61000.5
    assert cutout.exposure_seconds == 112.5
    center_column = 20
    expected_wavelength = WAVELENGTH_AT_FIRST_COLUMN + WAVELENGTH_STEP_PER_COLUMN * center_column
    assert cutout.wavelength_micrometers == pytest.approx(expected_wavelength, abs=1e-4)
    assert cutout.bandwidth_micrometers == pytest.approx(0.02, abs=1e-6)


def test_the_point_spread_table_data_is_never_requested(synthetic_path, full_wcs):
    _, reader = read_synthetic_cutout(synthetic_path, full_wcs, 20, 15, 9)
    with fits.open(synthetic_path) as header_data_units:
        info = header_data_units.fileinfo("EPSF")
    forbidden = range(
        info["datLoc"] + mirror_cutout.HEADER_READ_BYTES, info["datLoc"] + info["datSpan"]
    )
    for start, length in reader.requests:
        requested = range(start, start + length)
        assert requested.stop <= forbidden.start or requested.start >= forbidden.stop


def test_only_the_window_rows_of_each_layer_are_requested(synthetic_path, full_wcs):
    _, reader = read_synthetic_cutout(synthetic_path, full_wcs, 20, 15, 5)
    row_bytes = SYNTHETIC_WIDTH * 4
    lengths = [length for _, length in reader.requests]
    assert lengths.count(5 * row_bytes) == 3
    assert SYNTHETIC_HEIGHT * row_bytes not in lengths


def test_flag_names_are_read_from_the_header(synthetic_path):
    with fits.open(synthetic_path) as header_data_units:
        assert mirror_cutout.flag_names(header_data_units["FLAGS"].header) == SYNTHETIC_FLAG_NAMES


class FullContentClient:
    def get(self, url, headers):
        class FullContentResponse:
            status_code = 200
            content = b""

        return FullContentResponse()


class TimingOutClient:
    def get(self, url, headers):
        raise mirror_cutout.httpx.ReadTimeout("timed out")


def test_a_response_that_is_not_partial_content_becomes_an_archive_error():
    read_range = mirror_cutout.http_range_reader(FullContentClient())
    with pytest.raises(ArchiveError) as raised:
        read_range(SYNTHETIC_URL, 0, 10)
    assert raised.value.http_status == 502


def test_range_read_timeout_becomes_gateway_timeout():
    read_range = mirror_cutout.http_range_reader(TimingOutClient())
    with pytest.raises(ArchiveError) as raised:
        read_range(SYNTHETIC_URL, 0, 10)
    assert raised.value.http_status == 504


@pytest.mark.network
def test_barnards_star_cutout_is_read_from_the_mirror(barnard_star_search_response):
    image = spherex_archive.parse_images(barnard_star_search_response)[0]
    observation_time = Time(image.observation_start_modified_julian_date, format="mjd")
    center = position_at(CHALLENGE_TARGETS["barnards_star"], observation_time)

    cutout = mirror_cutout.read_cutout(image.mirror_url, center, 18)

    assert cutout.image.shape == (18, 18)
    for layer in (cutout.image, cutout.variance, cutout.zodiacal_light):
        assert np.isfinite(layer).all()
    assert cutout.flags.shape == (18, 18)
    assert 1 <= cutout.detector <= 6
    assert image.wavelength_min_micrometers <= cutout.wavelength_micrometers
    assert cutout.wavelength_micrometers <= image.wavelength_max_micrometers
