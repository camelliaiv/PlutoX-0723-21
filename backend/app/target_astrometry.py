"""Catalogue astrometry of the challenge targets, propagated to the time of an observation."""

from dataclasses import dataclass

import astropy.units as units
from astropy.coordinates import SkyCoord
from astropy.time import Time


@dataclass(frozen=True)
class CatalogueEntry:
    name: str
    catalogue_source_id: str
    reference_epoch: Time
    right_ascension_degrees: float
    declination_degrees: float
    proper_motion_right_ascension_milliarcseconds_per_year: float
    proper_motion_declination_milliarcseconds_per_year: float


GAIA_DR3_EPOCH = Time(2016.0, format="jyear")

CHALLENGE_TARGETS: dict[str, CatalogueEntry] = {
    "barnards_star": CatalogueEntry(
        name="Barnard's Star",
        catalogue_source_id="Gaia DR3 4472832130942575872",
        reference_epoch=GAIA_DR3_EPOCH,
        right_ascension_degrees=269.44850252543836,
        declination_degrees=4.739420051112412,
        proper_motion_right_ascension_milliarcseconds_per_year=-801.5509783684709,
        proper_motion_declination_milliarcseconds_per_year=10362.394206546573,
    ),
    "rw_aurigae": CatalogueEntry(
        name="RW Aurigae",
        catalogue_source_id="Gaia DR3 156430822114424576",
        reference_epoch=GAIA_DR3_EPOCH,
        right_ascension_degrees=76.95608119552952,
        declination_degrees=30.401204589097233,
        proper_motion_right_ascension_milliarcseconds_per_year=2.6406431770317083,
        proper_motion_declination_milliarcseconds_per_year=-27.397582540455325,
    ),
    "r_draconis": CatalogueEntry(
        name="R Draconis",
        catalogue_source_id="Gaia DR3 1648328016354496384",
        reference_epoch=GAIA_DR3_EPOCH,
        right_ascension_degrees=248.1673783672889,
        declination_degrees=66.75500674547219,
        proper_motion_right_ascension_milliarcseconds_per_year=-20.642811719160797,
        proper_motion_declination_milliarcseconds_per_year=6.148818852711324,
    ),
    "wise_0855_0714": CatalogueEntry(
        name="WISE 0855-0714",
        catalogue_source_id="CatWISE2020 J085507.96-071439.3",
        reference_epoch=Time(57338.571065, format="mjd"),
        right_ascension_degrees=133.7831722,
        declination_degrees=-7.2442516,
        proper_motion_right_ascension_milliarcseconds_per_year=-8021.2,
        proper_motion_declination_milliarcseconds_per_year=1035.7,
    ),
    "epsilon_indi_b": CatalogueEntry(
        name="Epsilon Indi B",
        catalogue_source_id="CatWISE2020 J220418.42-564738.2",
        reference_epoch=Time(57493.372170, format="mjd"),
        right_ascension_degrees=331.0767776,
        declination_degrees=-56.7939530,
        proper_motion_right_ascension_milliarcseconds_per_year=3790.0,
        proper_motion_declination_milliarcseconds_per_year=-2370.0,
    ),
}


def position_at(entry: CatalogueEntry, observation_time: Time) -> SkyCoord:
    """Linear proper-motion propagation; the yearly shift from Earth's orbit is under a pixel."""
    years_elapsed = (observation_time - entry.reference_epoch).to_value(units.yr)
    reference_position = SkyCoord(
        entry.right_ascension_degrees * units.deg, entry.declination_degrees * units.deg
    )
    return reference_position.spherical_offsets_by(
        entry.proper_motion_right_ascension_milliarcseconds_per_year * years_elapsed * units.mas,
        entry.proper_motion_declination_milliarcseconds_per_year * years_elapsed * units.mas,
    )


@dataclass(frozen=True)
class FixedTarget:
    position: SkyCoord


@dataclass(frozen=True)
class CatalogueTarget:
    entry: CatalogueEntry


TargetDescription = FixedTarget | CatalogueTarget


def target_position_at(target: TargetDescription, observation_time: Time) -> SkyCoord:
    if isinstance(target, FixedTarget):
        return target.position
    return position_at(target.entry, observation_time)
