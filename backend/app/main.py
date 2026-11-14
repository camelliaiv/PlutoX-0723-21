import os
from dataclasses import dataclass

import numpy as np
from astropy import units
from astropy.coordinates import SkyCoord
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse

from app import spherex_archive
from app.coordinates import CoordinateError, parse_declination, parse_right_ascension
from app.epoch_coadd import (
    PIXEL_SCALE_ARCSECONDS,
    SURVEY_MIDPOINT_TIME,
    EpochFrame,
    build_epoch_frames,
)
from app.errors import ArchiveError
from app.mirror_cutout import http_range_reader, open_mirror_client
from app.spherex_archive import COLLECTION_TITLES, Collection, ObservationEpoch, ObservationImage
from app.target_astrometry import (
    CHALLENGE_TARGETS,
    CatalogueTarget,
    FixedTarget,
    TargetDescription,
    target_position_at,
)

ARCHIVE_TIMEOUT_SECONDS = float(os.environ.get("ARCHIVE_TIMEOUT_SECONDS", "30"))
FRAME_SEARCH_RADIUS_DEGREES = 0.01
DISPLAY_RANGE_PERCENTILES = (1.0, 99.5)
SIGNIFICANT_DIGITS = 4
GRID_ORIENTATION = (
    "North up, east left; row 0 of every array is the southern edge, column 0 the eastern edge."
)


@dataclass(frozen=True)
class HealthResponse:
    status: str


@dataclass(frozen=True)
class SkyPosition:
    right_ascension: float
    declination: float


@dataclass(frozen=True)
class ObservationsResponse:
    target: SkyPosition
    collection: Collection
    citation: str
    search_url: str
    image_count: int
    epochs: list[ObservationEpoch]
    images: list[ObservationImage]


@dataclass(frozen=True)
class GridDescription:
    size_pixels: int
    pixel_scale_arcseconds: float
    center: SkyPosition
    orientation: str


@dataclass(frozen=True)
class DisplayRange:
    minimum: float
    maximum: float


@dataclass(frozen=True)
class FrameResponse:
    epoch_number: int
    start_date: str
    end_date: str
    detector: int
    exposure_count: int
    skipped_exposure_count: int
    wavelength_min_micrometers: float
    wavelength_max_micrometers: float
    observation_ids: list[str]
    data_releases: list[Collection]
    image: list[list[float | None]]
    variance: list[list[float | None]]
    coverage: list[list[int]]
    saturated_fraction: list[list[float | None]]


@dataclass(frozen=True)
class FramesResponse:
    reference_position: SkyPosition
    reference_date: str
    grid: GridDescription
    unit: str
    display_range: DisplayRange | None
    citations: list[str]
    frames: list[FrameResponse]
    notes: list[str]


app = FastAPI(title="PlutoX API")


@app.exception_handler(ArchiveError)
async def handle_archive_error(_request: Request, error: ArchiveError) -> JSONResponse:
    return JSONResponse(status_code=error.http_status, content={"error": error.message})


@app.get("/api/health")
def health() -> HealthResponse:
    return HealthResponse(status="ok")


@app.get("/api/observations")
def observations(
    ra: str = Query(description="Right ascension: decimal degrees or sexagesimal hours"),
    dec: str = Query(description="Declination: decimal or sexagesimal degrees"),
    radius: float = Query(0.001, gt=0, le=1, description="Search radius in degrees"),
    collection: Collection = Collection.DATA_RELEASE_1,
) -> ObservationsResponse:
    try:
        right_ascension = parse_right_ascension(ra)
        declination = parse_declination(dec)
    except CoordinateError as error:
        raise HTTPException(422, str(error)) from error

    search_url = spherex_archive.build_search_url(right_ascension, declination, radius, collection)
    search_response = spherex_archive.download_search_response(search_url, ARCHIVE_TIMEOUT_SECONDS)
    images = spherex_archive.parse_images(search_response)
    return ObservationsResponse(
        target=SkyPosition(right_ascension=right_ascension, declination=declination),
        collection=collection,
        citation=spherex_archive.citation_for(collection),
        search_url=search_url,
        image_count=len(images),
        epochs=spherex_archive.group_into_epochs(images),
        images=images,
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
    )


def _display_range(frames: list[EpochFrame]) -> DisplayRange | None:
    values = np.concatenate([frame.image.ravel() for frame in frames]) if frames else np.empty(0)
    finite_values = values[np.isfinite(values)]
    if finite_values.size == 0:
        return None
    lower, upper = np.percentile(finite_values, DISPLAY_RANGE_PERCENTILES)
    return DisplayRange(minimum=float(lower), maximum=float(upper))


def _resolve_target(target: str | None, ra: str | None, dec: str | None) -> TargetDescription:
    if target is not None:
        if ra is not None or dec is not None:
            raise HTTPException(422, "Give either target or ra and dec, not both.")
        if target not in CHALLENGE_TARGETS:
            raise HTTPException(422, f"Unknown target {target!r}.")
        return CatalogueTarget(CHALLENGE_TARGETS[target])
    if ra is None or dec is None:
        raise HTTPException(422, "Give either target or both ra and dec.")
    try:
        position = SkyCoord(
            parse_right_ascension(ra) * units.deg, parse_declination(dec) * units.deg
        )
    except CoordinateError as error:
        raise HTTPException(422, str(error)) from error
    return FixedTarget(position)


def _sky_position(position: SkyCoord) -> SkyPosition:
    return SkyPosition(right_ascension=float(position.ra.deg), declination=float(position.dec.deg))


@app.get("/api/frames")
def frames(
    detector: int = Query(ge=1, le=6, description="SPHEREx detector array"),
    size: int = Query(32, ge=8, le=96, description="Frame side in pixels of 6.15 arcseconds"),
    target: str | None = Query(None, description="Slug of a challenge target"),
    ra: str | None = Query(None, description="Right ascension: degrees or sexagesimal hours"),
    dec: str | None = Query(None, description="Declination: decimal or sexagesimal degrees"),
) -> FramesResponse:
    target_description = _resolve_target(target, ra, dec)
    search_position = target_position_at(target_description, SURVEY_MIDPOINT_TIME)
    search = spherex_archive.search_releases(
        search_position.ra.deg,
        search_position.dec.deg,
        FRAME_SEARCH_RADIUS_DEGREES,
        ARCHIVE_TIMEOUT_SECONDS,
    )
    with open_mirror_client() as client:
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
        notes.append(f"Epoch {epoch_list} has no frame: the target is off the detector there.")
    if not frame_set.frames and not frame_set.epochs_without_frames:
        notes.append(f"No SPHEREx exposures of detector {detector} cover this position.")

    used_releases = {release for frame in frame_set.frames for release in frame.data_releases}
    reference_position = _sky_position(frame_set.reference_position)
    return FramesResponse(
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
        notes=notes,
    )
