import math
from dataclasses import dataclass

from app.target_astrometry import CHALLENGE_TARGETS, CatalogueEntry

MILLIARCSECONDS_PER_ARCSECOND = 1000


@dataclass(frozen=True)
class TargetFacts:
    slug: str
    name: str
    catalogue_source_id: str
    reference_epoch: str
    right_ascension_degrees: float
    declination_degrees: float
    proper_motion_right_ascension_milliarcseconds_per_year: float
    proper_motion_declination_milliarcseconds_per_year: float
    total_proper_motion_arcseconds_per_year: float
    distance_parsecs: float | None
    distance_source: str


@dataclass(frozen=True)
class TargetsResponse:
    targets: list[TargetFacts]


def describe_target(slug: str, entry: CatalogueEntry) -> TargetFacts:
    right_ascension_motion = entry.proper_motion_right_ascension_milliarcseconds_per_year
    declination_motion = entry.proper_motion_declination_milliarcseconds_per_year
    return TargetFacts(
        slug=slug,
        name=entry.name,
        catalogue_source_id=entry.catalogue_source_id,
        reference_epoch=entry.reference_epoch.utc.strftime("%Y-%m-%d"),
        right_ascension_degrees=entry.right_ascension_degrees,
        declination_degrees=entry.declination_degrees,
        proper_motion_right_ascension_milliarcseconds_per_year=right_ascension_motion,
        proper_motion_declination_milliarcseconds_per_year=declination_motion,
        total_proper_motion_arcseconds_per_year=math.hypot(
            right_ascension_motion, declination_motion
        )
        / MILLIARCSECONDS_PER_ARCSECOND,
        distance_parsecs=entry.distance_parsecs,
        distance_source=entry.distance_source,
    )


def describe_challenge_targets() -> TargetsResponse:
    return TargetsResponse(
        targets=[describe_target(slug, entry) for slug, entry in CHALLENGE_TARGETS.items()]
    )
