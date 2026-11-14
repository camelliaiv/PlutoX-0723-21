"""Parsing of sky coordinates entered as decimal degrees or sexagesimal text."""

from astropy import units
from astropy.coordinates import Angle


class CoordinateError(ValueError):
    """Raised when a coordinate cannot be parsed or is out of range."""


def _parse_angle_in_degrees(text: str, sexagesimal_unit: units.Unit, label: str) -> float:
    text = str(text).strip()
    if not text:
        raise CoordinateError(f"{label} is empty")
    try:
        return float(text)
    except ValueError:
        pass
    try:
        return float(Angle(text, unit=sexagesimal_unit).degree)
    except Exception as error:
        raise CoordinateError(f"cannot parse {label} {text!r}") from error


def parse_right_ascension(text: str) -> float:
    """Return right ascension in degrees.

    Decimal input is read as degrees; sexagesimal input (e.g. "08h55m10.831s") as hours.
    """
    degrees = _parse_angle_in_degrees(text, units.hourangle, "right ascension")
    if not 0 <= degrees < 360:
        raise CoordinateError("right ascension must be in the range [0, 360) degrees")
    return degrees


def parse_declination(text: str) -> float:
    """Return declination in degrees from decimal or sexagesimal (e.g. "-07d14m42.53s") input."""
    degrees = _parse_angle_in_degrees(text, units.deg, "declination")
    if not -90 <= degrees <= 90:
        raise CoordinateError("declination must be in the range [-90, 90] degrees")
    return degrees
