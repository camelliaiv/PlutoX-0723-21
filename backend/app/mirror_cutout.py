"""Small sub-images of SPHEREx spectral images, read as byte ranges from the public AWS mirror.

A full spectral image file is about 66 MB, most of it unused. Only the rows of the requested
window are downloaded for each layer (image, variance, zodiacal light, flags).
"""

import io
import json
import math
import warnings
from collections.abc import Callable
from dataclasses import dataclass

import astropy.units as units
import httpx
import numpy as np
from astropy.coordinates import SkyCoord
from astropy.io import fits
from astropy.wcs import WCS, FITSFixedWarning

from app.errors import ArchiveError

FITS_BLOCK_BYTES = 2880
HEADER_CARD_BYTES = 80
HEADER_READ_BYTES = 8 * FITS_BLOCK_BYTES
END_CARD = b"END".ljust(HEADER_CARD_BYTES)
DESCRIPTOR_BYTES = 8
FLOAT32_BYTES = 4
LAST_NEEDED_EXTENSION = "WCS-WAVE"
READ_TIMEOUT_SECONDS = 30.0

ByteRangeReader = Callable[[str, int, int], bytes]


class CenterOutsideImageError(ValueError):
    """The requested sky position does not fall on the detector image."""


@dataclass(frozen=True)
class ExtensionLayout:
    name: str
    header: fits.Header
    header_offset: int
    header_length: int
    data_offset: int
    data_length: int


@dataclass(frozen=True)
class PixelWindow:
    x_start: int
    x_stop: int
    y_start: int
    y_stop: int

    @property
    def width(self) -> int:
        return self.x_stop - self.x_start

    @property
    def height(self) -> int:
        return self.y_stop - self.y_start


@dataclass(frozen=True)
class MirrorCutout:
    image: np.ndarray
    variance: np.ndarray
    zodiacal_light: np.ndarray
    flags: np.ndarray
    celestial_wcs: WCS
    origin_x: int
    origin_y: int
    wavelength_micrometers: float
    bandwidth_micrometers: float
    modified_julian_date_average: float
    exposure_seconds: float
    detector: int
    observation_id: str


def mirror_url(cloud_access_json: str) -> str:
    location = json.loads(cloud_access_json)["aws"]
    return (
        f"https://{location['bucket_name']}.s3.{location['region']}.amazonaws.com/{location['key']}"
    )


def open_mirror_client() -> httpx.Client:
    return httpx.Client(timeout=READ_TIMEOUT_SECONDS, follow_redirects=True)


def http_range_reader(client: httpx.Client) -> ByteRangeReader:
    """Byte-range reader that reuses one HTTP connection pool for many requests."""

    def read_range(url: str, start: int, length: int) -> bytes:
        headers = {"Range": f"bytes={start}-{start + length - 1}"}
        try:
            response = client.get(url, headers=headers)
        except httpx.TimeoutException as error:
            raise ArchiveError(504, "The SPHEREx file mirror did not answer in time.") from error
        except httpx.HTTPError as error:
            raise ArchiveError(
                502, f"Could not reach the SPHEREx file mirror ({type(error).__name__})."
            ) from error
        if response.status_code != 206:
            raise ArchiveError(
                502,
                f"The SPHEREx file mirror returned HTTP {response.status_code} for a range read.",
            )
        return response.content

    return read_range


def _read_exactly(read_range: ByteRangeReader, url: str, start: int, length: int) -> bytes:
    content = read_range(url, start, length)
    if len(content) != length:
        raise ArchiveError(
            502, f"The SPHEREx file mirror returned {len(content)} bytes instead of {length}."
        )
    return content


def _round_up_to_block(byte_count: int) -> int:
    return -(-byte_count // FITS_BLOCK_BYTES) * FITS_BLOCK_BYTES


def _find_end_card(raw_header: bytes) -> int | None:
    for position in range(0, len(raw_header) - HEADER_CARD_BYTES + 1, HEADER_CARD_BYTES):
        if raw_header[position : position + HEADER_CARD_BYTES] == END_CARD:
            return position
    return None


def data_length_of(header: fits.Header) -> int:
    """Padded byte length of the data that follows a header."""
    axis_count = header["NAXIS"]
    if axis_count == 0:
        return 0
    element_count = math.prod(header[f"NAXIS{axis}"] for axis in range(1, axis_count + 1))
    bytes_per_element = abs(header["BITPIX"]) // 8
    unpadded = (
        bytes_per_element * header.get("GCOUNT", 1) * (header.get("PCOUNT", 0) + element_count)
    )
    return _round_up_to_block(unpadded)


def _read_header(read_range: ByteRangeReader, url: str, offset: int) -> tuple[fits.Header, int]:
    raw_header = b""
    while (end_card_position := _find_end_card(raw_header)) is None:
        chunk = read_range(url, offset + len(raw_header), HEADER_READ_BYTES)
        if not chunk:
            raise ArchiveError(502, "A SPHEREx file ended inside a header.")
        raw_header += chunk
    header_length = _round_up_to_block(end_card_position + HEADER_CARD_BYTES)
    return fits.Header.fromstring(raw_header[:header_length].decode("ascii")), header_length


def read_layout(url: str, read_range: ByteRangeReader) -> dict[str, ExtensionLayout]:
    """Headers and data locations of every extension up to and including WCS-WAVE."""
    layout: dict[str, ExtensionLayout] = {}
    offset = 0
    while LAST_NEEDED_EXTENSION not in layout:
        header, header_length = _read_header(read_range, url, offset)
        name = header.get("EXTNAME", "PRIMARY")
        data_length = data_length_of(header)
        layout[name] = ExtensionLayout(
            name=name,
            header=header,
            header_offset=offset,
            header_length=header_length,
            data_offset=offset + header_length,
            data_length=data_length,
        )
        offset += header_length + data_length
    return layout


def flag_names(flags_header: fits.Header) -> dict[int, str]:
    """Bit number to bit name, from the MSKNnnnn cards of the FLAGS header."""
    prefix = "MSKN"
    return {
        int(card.keyword[len(prefix) :]): str(card.value)
        for card in flags_header.cards
        if card.keyword.startswith(prefix) and card.keyword[len(prefix) :].isdigit()
    }


def window_around(center_x: float, center_y: float, header: fits.Header, size: int) -> PixelWindow:
    """Square window of `size` pixels around the center, clipped to the detector image."""
    width, height = header["NAXIS1"], header["NAXIS2"]
    center_column, center_row = round(center_x), round(center_y)
    if not (0 <= center_column < width and 0 <= center_row < height):
        raise CenterOutsideImageError(
            f"The position falls at pixel ({center_x:.1f}, {center_y:.1f}), "
            f"outside the {width}x{height} image."
        )
    x_start = center_column - size // 2
    y_start = center_row - size // 2
    return PixelWindow(
        x_start=max(x_start, 0),
        x_stop=min(x_start + size, width),
        y_start=max(y_start, 0),
        y_stop=min(y_start + size, height),
    )


def _read_float_layer(
    url: str, read_range: ByteRangeReader, extension: ExtensionLayout, window: PixelWindow
) -> np.ndarray:
    row_bytes = extension.header["NAXIS1"] * FLOAT32_BYTES
    rows = _read_exactly(
        read_range,
        url,
        extension.data_offset + window.y_start * row_bytes,
        window.height * row_bytes,
    )
    full_rows = np.frombuffer(rows, dtype=">f4").reshape(window.height, -1)
    return full_rows[:, window.x_start : window.x_stop].astype(np.float32)


def _read_flags_layer(
    url: str, read_range: ByteRangeReader, extension: ExtensionLayout, window: PixelWindow
) -> np.ndarray:
    """Read the compressed row tiles of the window and let astropy decompress them."""
    header = extension.header
    descriptors = np.frombuffer(
        _read_exactly(
            read_range,
            url,
            extension.data_offset + window.y_start * DESCRIPTOR_BYTES,
            window.height * DESCRIPTOR_BYTES,
        ),
        dtype=">i4",
    ).reshape(window.height, 2)
    heap_start = int(descriptors[:, 1].min())
    heap_stop = int((descriptors[:, 1] + descriptors[:, 0]).max())
    table_bytes = header["NAXIS1"] * header["NAXIS2"]
    heap = _read_exactly(
        read_range,
        url,
        extension.data_offset + header.get("THEAP", table_bytes) + heap_start,
        heap_stop - heap_start,
    )

    rebased_descriptors = descriptors.copy()
    rebased_descriptors[:, 1] -= heap_start
    small_header = header.copy()
    small_header["NAXIS2"] = window.height
    small_header["ZNAXIS2"] = window.height
    small_header["PCOUNT"] = len(heap)
    small_header.remove("THEAP", ignore_missing=True)
    data = rebased_descriptors.astype(">i4").tobytes() + heap
    padded_data = data.ljust(_round_up_to_block(len(data)), b"\0")

    small_file = _primary_header_bytes() + small_header.tostring().encode("ascii") + padded_data
    with fits.open(io.BytesIO(small_file)) as header_data_units:
        flags = np.array(header_data_units[1].data)
    return flags[:, window.x_start : window.x_stop]


def _primary_header_bytes() -> bytes:
    buffer = io.BytesIO()
    fits.PrimaryHDU().writeto(buffer)
    return buffer.getvalue()


def _read_wavelength_table(
    url: str, read_range: ByteRangeReader, extension: ExtensionLayout
) -> fits.HDUList:
    table_bytes = _read_exactly(
        read_range, url, extension.header_offset, extension.header_length + extension.data_length
    )
    return fits.open(io.BytesIO(_primary_header_bytes() + table_bytes))


def wavelength_at(
    image_header: fits.Header, wavelength_table: fits.HDUList, x: float, y: float
) -> tuple[float, float]:
    """Central wavelength and bandwidth in micrometres at a full-frame pixel position."""
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", FITSFixedWarning)
        spectral_wcs = WCS(header=image_header, fobj=wavelength_table, key="W")
    spectral_wcs.sip = None
    wavelength, bandwidth = spectral_wcs.pixel_to_world(x, y)
    return float(wavelength.to_value(units.um)), float(bandwidth.to_value(units.um))


def read_cutout(
    url: str,
    center: SkyCoord,
    size_pixels: int,
    read_range: ByteRangeReader | None = None,
) -> MirrorCutout:
    if size_pixels < 1:
        raise ValueError("The cutout size must be at least one pixel.")
    if read_range is None:
        with open_mirror_client() as client:
            return read_cutout(url, center, size_pixels, http_range_reader(client))
    layout = read_layout(url, read_range)
    image_header = layout["IMAGE"].header
    with warnings.catch_warnings():
        warnings.simplefilter("ignore", FITSFixedWarning)
        celestial_wcs = WCS(image_header)
    center_x, center_y = (float(value) for value in celestial_wcs.world_to_pixel(center))
    window = window_around(center_x, center_y, image_header, size_pixels)

    with _read_wavelength_table(url, read_range, layout[LAST_NEEDED_EXTENSION]) as table:
        wavelength, bandwidth = wavelength_at(image_header, table, center_x, center_y)

    return MirrorCutout(
        image=_read_float_layer(url, read_range, layout["IMAGE"], window),
        variance=_read_float_layer(url, read_range, layout["VARIANCE"], window),
        zodiacal_light=_read_float_layer(url, read_range, layout["ZODI"], window),
        flags=_read_flags_layer(url, read_range, layout["FLAGS"], window),
        celestial_wcs=celestial_wcs[window.y_start : window.y_stop, window.x_start : window.x_stop],
        origin_x=window.x_start,
        origin_y=window.y_start,
        wavelength_micrometers=wavelength,
        bandwidth_micrometers=bandwidth,
        modified_julian_date_average=float(image_header["MJD-AVG"]),
        exposure_seconds=float(image_header["XPOSURE"]),
        detector=int(image_header["DETECTOR"]),
        observation_id=str(image_header["OBSID"]),
    )
