import pytest

from app.coordinates import CoordinateError, parse_declination, parse_right_ascension


def test_decimal_degrees_are_accepted():
    assert parse_right_ascension("269.4465") == pytest.approx(269.4465)
    assert parse_declination("-7.5") == -7.5


def test_sexagesimal_right_ascension_is_read_as_hours():
    assert parse_right_ascension("08h55m10.831s") == pytest.approx(133.795129, abs=1e-5)


def test_sexagesimal_declination_is_read_as_degrees():
    assert parse_declination("-07d14m42.53s") == pytest.approx(-7.245147, abs=1e-5)


@pytest.mark.parametrize("invalid_value", ["abc", "", "-1", "360", "361"])
def test_invalid_right_ascension_is_rejected(invalid_value):
    with pytest.raises(CoordinateError):
        parse_right_ascension(invalid_value)


@pytest.mark.parametrize("invalid_value", ["abc", "", "-91", "91"])
def test_invalid_declination_is_rejected(invalid_value):
    with pytest.raises(CoordinateError):
        parse_declination(invalid_value)


def test_colon_separated_sexagesimal_is_accepted():
    assert parse_right_ascension("08:55:10.831") == pytest.approx(133.795129, abs=1e-5)
    assert parse_declination("-07:14:42.53") == pytest.approx(-7.245147, abs=1e-5)


def test_surrounding_whitespace_is_ignored():
    assert parse_right_ascension("  269.4465 ") == pytest.approx(269.4465)
    assert parse_declination(" 4.7668  ") == pytest.approx(4.7668)


@pytest.mark.parametrize("boundary_value", ["0", "359.9999"])
def test_right_ascension_range_boundaries_are_accepted(boundary_value):
    assert parse_right_ascension(boundary_value) == pytest.approx(float(boundary_value))


@pytest.mark.parametrize("boundary_value", ["-90", "90"])
def test_declination_range_boundaries_are_accepted(boundary_value):
    assert parse_declination(boundary_value) == float(boundary_value)
