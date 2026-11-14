import astropy.units as units
from astropy.coordinates import SkyCoord
from astropy.time import Time

from app.target_astrometry import CHALLENGE_TARGETS, position_at


def test_position_at_the_reference_epoch_is_the_catalogue_position():
    entry = CHALLENGE_TARGETS["barnards_star"]
    position = position_at(entry, entry.reference_epoch)
    assert abs(position.ra.deg - entry.right_ascension_degrees) < 1e-9
    assert abs(position.dec.deg - entry.declination_degrees) < 1e-9


def test_barnards_star_moves_north_by_its_proper_motion_in_one_year():
    entry = CHALLENGE_TARGETS["barnards_star"]
    position = position_at(entry, Time(2017.0, format="jyear"))
    reference = SkyCoord(
        entry.right_ascension_degrees * units.deg, entry.declination_degrees * units.deg
    )
    separation = reference.separation(position).to_value(units.arcsec)
    assert abs(separation - 10.36) < 0.05
    assert position.dec > reference.dec


def test_wise_0855_is_about_two_arcminutes_from_the_challenge_statement_coordinates():
    challenge_statement_position = SkyCoord("08h55m10.831s", "-07d14m42.53s")
    position = position_at(
        CHALLENGE_TARGETS["wise_0855_0714"], Time("2026-05-14T00:00:00", scale="utc")
    )
    separation = challenge_statement_position.separation(position).to_value(units.arcmin)
    assert 1.7 < separation < 2.3


def test_every_target_has_a_catalogue_source_identifier():
    assert all(entry.catalogue_source_id for entry in CHALLENGE_TARGETS.values())
    assert len(CHALLENGE_TARGETS) == 5
