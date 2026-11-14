import os
from dataclasses import dataclass

from fastapi import FastAPI, HTTPException, Query, Request
from fastapi.responses import JSONResponse

from app import spherex_archive
from app.coordinates import CoordinateError, parse_declination, parse_right_ascension
from app.errors import ArchiveError
from app.spherex_archive import Collection, ObservationEpoch, ObservationImage

ARCHIVE_TIMEOUT_SECONDS = float(os.environ.get("ARCHIVE_TIMEOUT_SECONDS", "30"))


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
