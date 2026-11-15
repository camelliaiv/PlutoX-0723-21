import os
from dataclasses import dataclass
from pathlib import Path

from astropy import units
from astropy.coordinates import SkyCoord
from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse
from fastapi.staticfiles import StaticFiles

from app import frame_cache, spherex_archive
from app.coordinates import CoordinateError, parse_declination, parse_right_ascension
from app.epoch_coadd import SURVEY_MIDPOINT_TIME
from app.errors import ArchiveError
from app.frame_computation import (
    DEFAULT_FRAME_SIZE_PIXELS,
    MAXIMUM_FRAME_SIZE_PIXELS,
    MINIMUM_FRAME_SIZE_PIXELS,
    compute_live_frames,
)
from app.frames_models import FramesResponse, SkyPosition
from app.mirror_cutout import open_mirror_client
from app.spherex_archive import (
    ARCHIVE_TIMEOUT_SECONDS,
    Collection,
    ObservationEpoch,
    ObservationImage,
)
from app.target_astrometry import (
    CHALLENGE_TARGETS,
    CatalogueTarget,
    FixedTarget,
    TargetDescription,
    target_position_at,
)


@dataclass(frozen=True)
class HealthResponse:
    status: str


@dataclass(frozen=True)
class ObservationsResponse:
    target: SkyPosition
    collection: Collection
    citation: str
    search_url: str
    image_count: int
    epochs: list[ObservationEpoch]
    images: list[ObservationImage]


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


@app.get("/api/frames")
def frames(
    detector: int = Query(ge=1, le=6, description="SPHEREx detector array"),
    size: int = Query(
        DEFAULT_FRAME_SIZE_PIXELS,
        ge=MINIMUM_FRAME_SIZE_PIXELS,
        le=MAXIMUM_FRAME_SIZE_PIXELS,
        description="Frame side in pixels of 6.15 arcseconds",
    ),
    target: str | None = Query(None, description="Slug of a challenge target"),
    ra: str | None = Query(None, description="Right ascension: degrees or sexagesimal hours"),
    dec: str | None = Query(None, description="Declination: decimal or sexagesimal degrees"),
) -> FramesResponse:
    target_description = _resolve_target(target, ra, dec)
    cache_key = _cache_key(target, target_description, detector, size)
    cached_response = frame_cache.read_cached_frames(cache_key)
    if cached_response is not None:
        return cached_response
    with open_mirror_client() as client:
        response, is_complete = compute_live_frames(target_description, detector, size, client)
    if is_complete:
        frame_cache.write_cached_frames(cache_key, response)
    return response


def _cache_key(
    target: str | None, target_description: TargetDescription, detector: int, size: int
) -> frame_cache.FrameCacheKey:
    if target is not None:
        return frame_cache.key_for_target(target, detector, size)
    position = target_position_at(target_description, SURVEY_MIDPOINT_TIME)
    return frame_cache.key_for_coordinates(position.ra.deg, position.dec.deg, detector, size)


def frontend_build_directory() -> Path:
    """Built frontend served by the API in production; in development Vite serves it instead."""
    default = Path(__file__).resolve().parents[2] / "frontend" / "dist"
    return Path(os.environ.get("FRONTEND_BUILD_DIRECTORY", default))


if frontend_build_directory().is_dir():
    app.mount("/", StaticFiles(directory=frontend_build_directory(), html=True), name="frontend")
