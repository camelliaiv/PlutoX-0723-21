"""Precompute the frame cache for the challenge targets.

Run from the backend directory: ``python -m app.precompute_frames``. A combination of target and
detector is cached only when its frames are complete, exactly as the API does for live requests.
"""

import argparse
import sys
from collections.abc import Sequence
from contextlib import contextmanager
from dataclasses import dataclass
from enum import StrEnum
from pathlib import Path
from time import monotonic, sleep

import httpx
from astropy import log as astropy_log

from app import frame_cache
from app.errors import ArchiveError
from app.frame_computation import (
    DEFAULT_FRAME_SIZE_PIXELS,
    MAXIMUM_FRAME_SIZE_PIXELS,
    MINIMUM_FRAME_SIZE_PIXELS,
    compute_live_frames,
)
from app.frames_models import FramesResponse
from app.mirror_cutout import open_mirror_client
from app.spherex_archive import COLLECTION_TITLES, Collection, SearchResponseReader
from app.target_astrometry import CHALLENGE_TARGETS, CatalogueTarget

DETECTORS = (1, 2, 3, 4, 5, 6)
RETRY_WAIT_SECONDS = (30, 60, 90, 120)
INCOMPLETE_RESULT_REASON = "the result was incomplete"


class CombinationStatus(StrEnum):
    COMPUTED = "computed"
    ALREADY_CACHED = "already cached"
    FAILED = "failed"


@dataclass(frozen=True)
class CombinationResult:
    target: str
    detector: int
    status: CombinationStatus
    seconds: float
    response: FramesResponse | None = None
    failure_reason: str | None = None

    @property
    def succeeded(self) -> bool:
        return self.status is not CombinationStatus.FAILED

    def describe(self) -> str:
        label = f"{self.target} D{self.detector}"
        if self.response is None:
            detail = self.failure_reason or ""
            return f"{label}: {self.status.value} ({detail}) in {self.seconds:.0f} s"
        frames = self.response.frames
        used = sum(frame.exposure_count for frame in frames)
        skipped = sum(frame.skipped_exposure_count for frame in frames)
        return (
            f"{label}: {len(frames)} epochs, {used} exposures used, {skipped} skipped, "
            f"{self.seconds:.0f} s, {self.status.value}"
        )


def parse_arguments(arguments: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="python -m app.precompute_frames",
        description="Compute and cache the SPHEREx frames of the challenge targets.",
    )
    parser.add_argument(
        "--targets",
        nargs="+",
        choices=sorted(CHALLENGE_TARGETS),
        default=list(CHALLENGE_TARGETS),
        metavar="SLUG",
        help="Challenge target slugs (default: all)",
    )
    parser.add_argument(
        "--detectors",
        nargs="+",
        type=int,
        choices=DETECTORS,
        default=list(DETECTORS),
        metavar="DETECTOR",
        help="Detector arrays 1 to 6 (default: all)",
    )
    parser.add_argument(
        "--size",
        type=int,
        choices=range(MINIMUM_FRAME_SIZE_PIXELS, MAXIMUM_FRAME_SIZE_PIXELS + 1),
        default=DEFAULT_FRAME_SIZE_PIXELS,
        metavar="PIXELS",
        help=f"Frame side in pixels (default: {DEFAULT_FRAME_SIZE_PIXELS})",
    )
    parser.add_argument(
        "--force", action="store_true", help="Recompute even if a valid cache file exists"
    )
    parser.add_argument(
        "--search-responses",
        type=Path,
        metavar="DIRECTORY",
        help=(
            "Read saved IRSA search responses named <target>_<collection>.xml from this directory "
            "instead of querying IRSA; pixels are still read from the archive mirror"
        ),
    )
    return parser.parse_args(arguments)


def stored_search_response_reader(directory: Path, target: str) -> SearchResponseReader:
    """Reader of saved search responses; a missing file makes that release unavailable."""

    def read_search_response(collection: Collection, url: str) -> bytes:
        path = directory / f"{target}_{collection.value}.xml"
        try:
            return path.read_bytes()
        except OSError as error:
            raise ArchiveError(
                502, f"No saved search response for {COLLECTION_TITLES[collection]}."
            ) from error

    return read_search_response


def compute_with_retries(
    target: str,
    detector: int,
    size: int,
    client: httpx.Client,
    read_search_response: SearchResponseReader | None = None,
) -> tuple[FramesResponse | None, str]:
    """Complete frames of one combination, or None and the reason of the last failure."""
    description = CatalogueTarget(CHALLENGE_TARGETS[target])
    for attempt, wait_seconds in enumerate((*RETRY_WAIT_SECONDS, None)):
        try:
            response, is_complete = compute_live_frames(
                description, detector, size, client, read_search_response
            )
        except ArchiveError as error:
            reason = error.message
        else:
            if is_complete:
                return response, ""
            reason = INCOMPLETE_RESULT_REASON
        if wait_seconds is not None:
            print(f"  attempt {attempt + 1} failed ({reason}); waiting {wait_seconds} s")
            sleep(wait_seconds)
    return None, reason


def precompute_combination(
    target: str,
    detector: int,
    size: int,
    force: bool,
    client: httpx.Client,
    read_search_response: SearchResponseReader | None = None,
) -> CombinationResult:
    started = monotonic()
    key = frame_cache.key_for_target(target, detector, size)
    cached_response = None if force else frame_cache.read_cached_frames(key)
    if cached_response is not None:
        return CombinationResult(
            target,
            detector,
            CombinationStatus.ALREADY_CACHED,
            monotonic() - started,
            cached_response,
        )
    response, reason = compute_with_retries(target, detector, size, client, read_search_response)
    if response is None:
        return CombinationResult(
            target, detector, CombinationStatus.FAILED, monotonic() - started, failure_reason=reason
        )
    frame_cache.write_cached_frames(key, response)
    return CombinationResult(
        target, detector, CombinationStatus.COMPUTED, monotonic() - started, response
    )


@contextmanager
def _quiet_astropy_log():
    """Hide the astropy INFO notices about header distortion terms while reading cutouts."""
    previous_level = astropy_log.level
    astropy_log.setLevel("WARNING")
    try:
        yield
    finally:
        astropy_log.setLevel(previous_level)


def main(arguments: Sequence[str] | None = None) -> int:
    options = parse_arguments(arguments)
    results: list[CombinationResult] = []
    started = monotonic()
    with _quiet_astropy_log(), open_mirror_client() as client:
        for target in options.targets:
            read_search_response = (
                stored_search_response_reader(options.search_responses, target)
                if options.search_responses
                else None
            )
            for detector in options.detectors:
                result = precompute_combination(
                    target, detector, options.size, options.force, client, read_search_response
                )
                print(result.describe(), flush=True)
                results.append(result)
    failed = [result for result in results if not result.succeeded]
    print(
        f"{len(results) - len(failed)} of {len(results)} combinations succeeded "
        f"in {monotonic() - started:.0f} s"
    )
    for result in failed:
        print(f"failed: --targets {result.target} --detectors {result.detector}")
    return 1 if failed else 0


if __name__ == "__main__":
    sys.exit(main())
