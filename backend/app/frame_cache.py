import json
import os
import tempfile
from dataclasses import dataclass, replace
from datetime import UTC, datetime
from pathlib import Path

from fastapi.encoders import jsonable_encoder
from pydantic import TypeAdapter, ValidationError

from app.epoch_coadd import FRAME_RECIPE_VERSION
from app.frames_models import FramesResponse

CACHE_FORMAT_VERSION = 1
CACHE_DIRECTORY_VARIABLE = "FRAME_CACHE_DIRECTORY"
BACKEND_DIRECTORY = Path(__file__).resolve().parent.parent
DEFAULT_CACHE_DIRECTORY = "frame_cache"
COORDINATE_DECIMALS = 6

_RESPONSE_ADAPTER = TypeAdapter(FramesResponse)


@dataclass(frozen=True)
class FrameCacheKey:
    location: str
    detector: int
    size_pixels: int

    @property
    def file_name(self) -> str:
        return f"{self.location}_detector{self.detector}_size{self.size_pixels}.json"


def key_for_target(target_slug: str, detector: int, size_pixels: int) -> FrameCacheKey:
    return FrameCacheKey(target_slug, detector, size_pixels)


def key_for_coordinates(
    right_ascension_degrees: float, declination_degrees: float, detector: int, size_pixels: int
) -> FrameCacheKey:
    location = (
        f"ra{right_ascension_degrees:.{COORDINATE_DECIMALS}f}"
        f"_dec{declination_degrees:+.{COORDINATE_DECIMALS}f}"
    )
    return FrameCacheKey(location, detector, size_pixels)


def cache_directory() -> Path:
    configured = os.environ.get(CACHE_DIRECTORY_VARIABLE) or DEFAULT_CACHE_DIRECTORY
    return BACKEND_DIRECTORY / configured


def read_cached_frames(key: FrameCacheKey) -> FramesResponse | None:
    try:
        envelope = json.loads((cache_directory() / key.file_name).read_text(encoding="utf-8"))
        if (
            envelope["format_version"] != CACHE_FORMAT_VERSION
            or envelope["frame_recipe_version"] != FRAME_RECIPE_VERSION
        ):
            return None
        response = _RESPONSE_ADAPTER.validate_python(envelope["response"])
        return replace(response, served_from_cache=True, computed_at=envelope["computed_at"])
    except (OSError, ValueError, KeyError, TypeError, ValidationError):
        return None


def write_cached_frames(key: FrameCacheKey, response: FramesResponse) -> None:
    directory = cache_directory()
    directory.mkdir(parents=True, exist_ok=True)
    envelope = {
        "format_version": CACHE_FORMAT_VERSION,
        "frame_recipe_version": FRAME_RECIPE_VERSION,
        "computed_at": response.computed_at,
        "response": jsonable_encoder(response),
    }
    descriptor, temporary_name = tempfile.mkstemp(dir=directory, suffix=".tmp")
    try:
        with os.fdopen(descriptor, "w", encoding="utf-8") as temporary_file:
            json.dump(envelope, temporary_file)
        os.replace(temporary_name, directory / key.file_name)
    except BaseException:
        Path(temporary_name).unlink(missing_ok=True)
        raise


def current_timestamp() -> str:
    return datetime.now(UTC).isoformat(timespec="seconds")
