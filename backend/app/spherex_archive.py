"""Search of SPHEREx spectral images in the NASA/IPAC Infrared Science Archive (IRSA).

Uses the IVOA Simple Image Access v2 (SIA2) service.
"""

import io
import os
from collections import Counter
from collections.abc import Callable
from dataclasses import dataclass
from enum import StrEnum
from itertools import pairwise
from urllib.parse import urlencode

import httpx
from astropy.io.votable import parse_single_table
from astropy.time import Time

from app.errors import ArchiveError
from app.mirror_cutout import mirror_url

SEARCH_SERVICE_URL = "https://irsa.ipac.caltech.edu/SIA"
ARCHIVE_TIMEOUT_SECONDS = float(os.environ.get("ARCHIVE_TIMEOUT_SECONDS", "30"))
EPOCH_GAP_DAYS = 30.0
METERS_TO_MICROMETERS = 1e6


class Collection(StrEnum):
    DATA_RELEASE_1 = "spherex_dr1"
    QUICK_RELEASE_3 = "spherex_qr3"


COLLECTION_TITLES = {
    Collection.DATA_RELEASE_1: "SPHEREx Data Release 1",
    Collection.QUICK_RELEASE_3: "SPHEREx Quick Release 3",
}


@dataclass(frozen=True)
class ObservationImage:
    observation_id: str
    observation_start_modified_julian_date: float
    observation_date: str
    detector_band: str
    wavelength_min_micrometers: float
    wavelength_max_micrometers: float
    download_url: str
    mirror_url: str


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
                mirror_url=mirror_url(str(row["cloud_access"])),
            )
            for row in table
        ]
    except Exception as error:
        raise ArchiveError(
            502, f"IRSA response is not a readable VOTable ({type(error).__name__})."
        ) from error
    return sorted(images, key=lambda image: image.observation_start_modified_julian_date)


def detector_number(image: ObservationImage) -> int:
    return int(image.detector_band.rsplit("D", 1)[-1])


def split_into_epochs(
    images: list[ObservationImage], gap_days: float = EPOCH_GAP_DAYS
) -> list[list[ObservationImage]]:
    """Split images into observation epochs separated by more than `gap_days`."""
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
    return epochs


def group_into_epochs(
    images: list[ObservationImage], gap_days: float = EPOCH_GAP_DAYS
) -> list[ObservationEpoch]:
    """Summarise each observation epoch separated from the next by more than `gap_days`."""
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
        for epoch_number, epoch_images in enumerate(split_into_epochs(images, gap_days), start=1)
    ]


SearchResponseReader = Callable[[Collection, str], bytes]


@dataclass(frozen=True)
class ReleaseSearch:
    images: list[ObservationImage]
    release_by_mirror_url: dict[str, Collection]
    unavailable_releases: dict[Collection, str]


def search_releases(
    right_ascension: float,
    declination: float,
    radius_degrees: float,
    timeout_seconds: float,
    read_search_response: SearchResponseReader | None = None,
) -> ReleaseSearch:
    """Search every release; an observation present in several is kept once, from the first.

    By default each release is queried live; `read_search_response` can supply saved responses.
    """
    if read_search_response is None:

        def read_search_response(collection: Collection, url: str) -> bytes:
            return download_search_response(url, timeout_seconds)

    images: list[ObservationImage] = []
    release_by_mirror_url: dict[str, Collection] = {}
    unavailable_releases: dict[Collection, str] = {}
    known_observations: set[tuple[str, str]] = set()
    first_error: ArchiveError | None = None
    for collection in Collection:
        url = build_search_url(right_ascension, declination, radius_degrees, collection)
        try:
            found_images = parse_images(read_search_response(collection, url))
        except ArchiveError as error:
            first_error = first_error or error
            unavailable_releases[collection] = error.message
            continue
        for image in found_images:
            observation = (image.observation_id, image.detector_band)
            if observation not in known_observations:
                known_observations.add(observation)
                images.append(image)
                release_by_mirror_url[image.mirror_url] = collection
    if first_error is not None and len(unavailable_releases) == len(Collection):
        raise first_error
    return ReleaseSearch(
        images=sorted(images, key=lambda image: image.observation_start_modified_julian_date),
        release_by_mirror_url=release_by_mirror_url,
        unavailable_releases=unavailable_releases,
    )
