"""Search of SPHEREx spectral images in the NASA/IPAC Infrared Science Archive (IRSA).

Uses the IVOA Simple Image Access v2 (SIA2) service.
"""

import io
from collections import Counter
from dataclasses import dataclass
from enum import StrEnum
from itertools import pairwise
from urllib.parse import urlencode

import httpx
from astropy.io.votable import parse_single_table
from astropy.time import Time

SEARCH_SERVICE_URL = "https://irsa.ipac.caltech.edu/SIA"
EPOCH_GAP_DAYS = 30.0
METERS_TO_MICROMETERS = 1e6


class Collection(StrEnum):
    DATA_RELEASE_1 = "spherex_dr1"
    QUICK_RELEASE_3 = "spherex_qr3"


COLLECTION_TITLES = {
    Collection.DATA_RELEASE_1: "SPHEREx Data Release 1",
    Collection.QUICK_RELEASE_3: "SPHEREx Quick Release 3",
}


class ArchiveError(Exception):
    """The archive could not be reached or returned an unusable response."""

    def __init__(self, http_status: int, message: str):
        super().__init__(message)
        self.http_status = http_status
        self.message = message


@dataclass(frozen=True)
class ObservationImage:
    observation_id: str
    observation_start_modified_julian_date: float
    observation_date: str
    detector_band: str
    wavelength_min_micrometers: float
    wavelength_max_micrometers: float
    download_url: str


@dataclass(frozen=True)
class ObservationEpoch:
    number: int
    start_date: str
    end_date: str
    image_count: int
    image_count_by_band: dict[str, int]


def citation_for(collection: Collection) -> str:
    return f"NASA/IPAC Infrared Science Archive, {COLLECTION_TITLES[collection]} spectral images"


def build_search_url(
    right_ascension: float, declination: float, radius_degrees: float, collection: Collection
) -> str:
    query = urlencode(
        {
            "COLLECTION": collection.value,
            "POS": f"circle {right_ascension} {declination} {radius_degrees}",
            "RESPONSEFORMAT": "votable",
        }
    )
    return f"{SEARCH_SERVICE_URL}?{query}"


def download_search_response(url: str, timeout_seconds: float) -> bytes:
    try:
        response = httpx.get(url, timeout=timeout_seconds, follow_redirects=True)
    except httpx.TimeoutException as error:
        raise ArchiveError(
            504, f"IRSA did not answer within {timeout_seconds:g} seconds."
        ) from error
    except httpx.HTTPError as error:
        raise ArchiveError(502, f"Could not reach IRSA ({type(error).__name__}).") from error
    if response.status_code != 200:
        raise ArchiveError(
            502, f"IRSA returned HTTP {response.status_code}; it may be temporarily unavailable."
        )
    return response.content


def _modified_julian_date_to_iso(modified_julian_date: float) -> str:
    return Time(modified_julian_date, format="mjd", scale="utc").strftime("%Y-%m-%dT%H:%M:%S")


def parse_images(search_response: bytes) -> list[ObservationImage]:
    """Convert an SIA2 VOTable response into image descriptions sorted by observation time."""
    try:
        table = parse_single_table(io.BytesIO(search_response)).to_table(use_names_over_ids=True)
        images = [
            ObservationImage(
                observation_id=str(row["obs_id"]),
                observation_start_modified_julian_date=float(row["t_min"]),
                observation_date=_modified_julian_date_to_iso(float(row["t_min"])),
                detector_band=str(row["energy_bandpassname"]),
                wavelength_min_micrometers=float(row["em_min"]) * METERS_TO_MICROMETERS,
                wavelength_max_micrometers=float(row["em_max"]) * METERS_TO_MICROMETERS,
                download_url=str(row["access_url"]),
            )
            for row in table
        ]
    except Exception as error:
        raise ArchiveError(
            502, f"IRSA response is not a readable VOTable ({type(error).__name__})."
        ) from error
    return sorted(images, key=lambda image: image.observation_start_modified_julian_date)


def group_into_epochs(
    images: list[ObservationImage], gap_days: float = EPOCH_GAP_DAYS
) -> list[ObservationEpoch]:
    """Group images into observation epochs separated by more than `gap_days`."""
    if not images:
        return []
    images_by_time = sorted(images, key=lambda image: image.observation_start_modified_julian_date)
    epochs = [[images_by_time[0]]]
    for previous_image, image in pairwise(images_by_time):
        days_between = (
            image.observation_start_modified_julian_date
            - previous_image.observation_start_modified_julian_date
        )
        if days_between > gap_days:
            epochs.append([])
        epochs[-1].append(image)
    return [
        ObservationEpoch(
            number=epoch_number,
            start_date=epoch_images[0].observation_date,
            end_date=epoch_images[-1].observation_date,
            image_count=len(epoch_images),
            image_count_by_band=dict(
                sorted(Counter(image.detector_band for image in epoch_images).items())
            ),
        )
        for epoch_number, epoch_images in enumerate(epochs, start=1)
    ]
