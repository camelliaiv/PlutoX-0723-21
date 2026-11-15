import io
import json
from pathlib import Path

import numpy as np
import pytest
from astropy.io.votable import from_table
from astropy.table import Table
from PIL import Image

from app import build_sky_assets
from app.build_sky_assets import (
    GAIA_COLUMNS,
    SkyAssetError,
    StarTable,
    convert_milky_way_map,
    distance_parsecs_from_measure,
    merge_nearby_stars,
    pack_star_records,
    parse_gator_table,
    select_bright_stars_missing_from,
    star_table_from_gaia,
    star_table_from_hipparcos,
)

GATOR_HEADER_NAMES = ["ra", "dec", "clon", "clat", "parallax", "phot_g_mean_mag", "bp_rp"]
GATOR_TEXT = "\n".join(
    [
        "\\fixlen = T",
        "\\DATETIME= '2026-11-15 00:00:12'",
        "\\SQL     = 'WHERE  (phot_g_mean_mag<8.5) '",
        "| " + " | ".join(GATOR_HEADER_NAMES) + " |",
        "| double | double | char | char | double | double | double |",
        " 10.5 -20.25 00h42m00.00s -20d15m00.00s 100.0 5.5 1.25",
        " 30.0 40.0 02h00m00.00s +40d00m00.00s null 7.0 null",
        " 50.0 60.0 03h20m00.00s +60d00m00.00s 0.05 8.0 0.5",
        "",
    ]
)


def make_stars(
    right_ascension: list[float],
    declination: list[float],
    magnitude: list[float],
) -> StarTable:
    count = len(right_ascension)
    return StarTable(
        np.array(right_ascension),
        np.array(declination),
        np.full(count, np.nan),
        np.array(magnitude),
        np.full(count, np.nan),
    )


def test_parses_gator_rows_with_missing_values():
    table = parse_gator_table(GATOR_TEXT, GAIA_COLUMNS)
    assert table.query_time == "2026-11-15 00:00:12"
    assert table.columns["ra"].tolist() == [10.5, 30.0, 50.0]
    assert np.isnan(table.columns["parallax"][1])
    assert np.isnan(table.columns["bp_rp"][1])


def test_rejects_gator_text_without_a_table_or_columns():
    with pytest.raises(SkyAssetError):
        parse_gator_table("no table here", GAIA_COLUMNS)
    with pytest.raises(SkyAssetError):
        parse_gator_table(GATOR_TEXT, ("ra", "unknown_column"))


def test_distance_is_only_given_for_reliable_measurements():
    distances = distance_parsecs_from_measure(np.array([100.0, 0.05, np.nan, -3.0, 0.1]))
    assert distances[0] == pytest.approx(10.0)
    assert np.isnan(distances[1])
    assert np.isnan(distances[2])
    assert np.isnan(distances[3])
    assert distances[4] == pytest.approx(10000.0)


def test_packs_little_endian_records_with_markers_for_missing_values():
    stars = star_table_from_gaia(parse_gator_table(GATOR_TEXT, GAIA_COLUMNS))
    packed = pack_star_records(stars)
    assert len(packed) == 3 * 5 * 4
    records = np.frombuffer(packed, dtype="<f4").reshape(-1, 5)
    assert records[0].tolist() == pytest.approx([10.5, -20.25, 10.0, 5.5, 1.25])
    assert records[1].tolist() == pytest.approx([30.0, 40.0, -1.0, 7.0, 99.0])
    assert records[2][2] == -1.0


def test_nearby_stars_replace_the_same_star_in_the_bright_list():
    bright = make_stars([10.0, 20.0], [5.0, 5.0], [6.0, 7.0])
    nearby = StarTable(
        np.array([10.0 + 0.2 / 3600.0, 80.0]),
        np.array([5.0, -30.0]),
        np.array([3.0, 4.0]),
        np.array([6.0, 12.0]),
        np.array([1.0, 2.0]),
    )
    merged = merge_nearby_stars(bright, nearby)
    assert merged.right_ascension_degrees.tolist() == pytest.approx(
        [20.0, 10.0 + 0.2 / 3600.0, 80.0]
    )
    assert merged.distance_parsecs.tolist()[1:] == [3.0, 4.0]


def test_hipparcos_stars_next_to_a_bright_gaia_star_are_skipped():
    gaia = make_stars([100.0, 200.0, 300.0], [10.0, 10.0, 10.0], [3.0, 4.9, 5.5])
    hipparcos = make_stars(
        [100.0 + 1.0 / 60.0, 200.0, 300.0 + 1.0 / 60.0, 150.0],
        [10.0, 10.0 + 3.0 / 60.0, 10.0, 10.0],
        [2.0, 2.5, 3.0, 3.5],
    )
    kept = select_bright_stars_missing_from(hipparcos, gaia)
    assert kept.right_ascension_degrees.tolist() == pytest.approx(
        [200.0, 300.0 + 1.0 / 60.0, 150.0]
    )


def test_reads_the_hipparcos_votable():
    table = Table(
        {
            "hip_number": [1, 2],
            "ra": [10.0, 20.0],
            "dec": [-5.0, 6.0],
            "parallax": [20.0, 0.0],
            "hip_mag": [3.5, 2.0],
            "bv_color": np.ma.array([0.5, 0.0], mask=[False, True]),
        }
    )
    output = io.BytesIO()
    from_table(table).to_xml(output)
    stars = star_table_from_hipparcos(output.getvalue())
    assert stars.distance_parsecs[0] == pytest.approx(50.0)
    assert np.isnan(stars.distance_parsecs[1])
    assert np.isnan(stars.colour_index[1])
    assert stars.magnitude.tolist() == [3.5, 2.0]


def make_png() -> bytes:
    output = io.BytesIO()
    Image.new("RGB", (40, 20), (200, 100, 50)).save(output, format="PNG")
    return output.getvalue()


def test_converts_the_map_to_a_jpeg_of_the_texture_size():
    converted = convert_milky_way_map(make_png())
    with Image.open(io.BytesIO(converted)) as image:
        assert image.format == "JPEG"
        assert image.size == (4096, 2048)


def test_writes_all_assets_from_a_raw_directory(tmp_path: Path):
    raw_directory = tmp_path / "raw"
    raw_directory.mkdir()
    (raw_directory / build_sky_assets.GAIA_BRIGHT_FILE_NAME).write_text(GATOR_TEXT)
    (raw_directory / build_sky_assets.GAIA_NEARBY_FILE_NAME).write_text(GATOR_TEXT)
    hipparcos = Table(
        {
            "hip_number": [1],
            "ra": [200.0],
            "dec": [10.0],
            "parallax": [20.0],
            "hip_mag": [1.0],
            "bv_color": [0.3],
        }
    )
    hipparcos_bytes = io.BytesIO()
    from_table(hipparcos).to_xml(hipparcos_bytes)
    (raw_directory / build_sky_assets.HIPPARCOS_FILE_NAME).write_bytes(hipparcos_bytes.getvalue())
    (raw_directory / build_sky_assets.MAP_FILE_NAME).write_bytes(make_png())
    output_directory = tmp_path / "sky"

    exit_code = build_sky_assets.main(
        ["--raw-directory", str(raw_directory), "--output-directory", str(output_directory)]
    )

    assert exit_code == 0
    manifest = json.loads((output_directory / "manifest.json").read_text(encoding="utf-8"))
    assert manifest["stars"]["count"] == 3
    assert manifest["bright_stars"]["count"] == 1
    assert (output_directory / "stars.bin").stat().st_size == 3 * 20
    assert (output_directory / "bright_stars.bin").stat().st_size == 20
    assert (output_directory / "milky_way_4k.jpg").exists()
    assert manifest["sources"]["gaia_bright"]["retrieved"] == "2026-11-15 00:00:12"
