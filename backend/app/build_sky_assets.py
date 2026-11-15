"""Build the static sky assets of the 3D sky view.

Run from the backend directory: ``python -m app.build_sky_assets``. The command downloads the Gaia
DR3 bright and nearby stars (NASA/IPAC IRSA Gator), the Hipparcos New Reduction bright stars (NASA
HEASARC TAP) and the ESA Gaia EDR3 colour map of the sky, and writes compact files for the browser
to ``frontend/public/sky/``. Use ``--raw-directory`` to reuse raw files that were downloaded
earlier: files found there are read, missing ones are downloaded into it.
"""

import argparse
import io
import json
import re
import sys
import tempfile
from collections.abc import Callable, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from pathlib import Path

import httpx
import numpy as np
from astropy.io.votable import parse_single_table
from PIL import Image
from scipy.spatial import cKDTree

REQUEST_TIMEOUT_SECONDS = 300.0

GATOR_URL = "https://irsa.ipac.caltech.edu/cgi-bin/Gator/nph-query"
GAIA_CATALOGUE = "gaia_dr3_source"
GAIA_COLUMNS = ("ra", "dec", "parallax", "phot_g_mean_mag", "bp_rp")
GAIA_BRIGHT_CONSTRAINT = "phot_g_mean_mag<8.5"
GAIA_NEARBY_CONSTRAINT = "parallax>60 and parallax_over_error>10"

HEASARC_TAP_URL = "https://heasarc.gsfc.nasa.gov/xamin/vo/tap/sync"
HIPPARCOS_QUERY = (
    "SELECT hip_number, ra, dec, parallax, hip_mag, bv_color FROM hipnewcat WHERE hip_mag < 4.0"
)

ESA_MAP_URL = (
    "https://sci.esa.int/documents/33580/35361/Gaia_EDR3_flux_cartesian_4k.png/"
    "4648ec09-6c63-47a5-d0da-3ab3e0b42afe?version=1.0&t=1606986362680&download=true"
)

GAIA_BRIGHT_FILE_NAME = "gaia_sky.tbl"
GAIA_NEARBY_FILE_NAME = "gaia_nearby.tbl"
HIPPARCOS_FILE_NAME = "hipparcos_bright.xml"
MAP_FILE_NAME = "Gaia_EDR3_flux_cartesian_4k.png"

STARS_FILE_NAME = "stars.bin"
BRIGHT_STARS_FILE_NAME = "bright_stars.bin"
MILKY_WAY_FILE_NAME = "milky_way_4k.jpg"
MANIFEST_FILE_NAME = "manifest.json"

MINIMUM_RELIABLE_DISTANCE_MEASURE_MILLIARCSECONDS = 0.1
MISSING_DISTANCE = -1.0
MISSING_COLOUR = 99.0

NEARBY_MATCH_RADIUS_ARCSECONDS = 1.0
BRIGHT_MATCH_RADIUS_ARCMINUTES = 2.0
BRIGHT_MATCH_MAXIMUM_GAIA_MAGNITUDE = 5.0

MAP_WIDTH_PIXELS = 4096
MAP_HEIGHT_PIXELS = 2048
MAP_JPEG_QUALITY = 90

MANIFEST_FORMAT_VERSION = 1
DEFAULT_OUTPUT_DIRECTORY = Path(__file__).resolve().parents[2] / "frontend" / "public" / "sky"

GAIA_CREDIT = "Gaia DR3 star data (ESA/Gaia/DPAC), retrieved through NASA/IPAC IRSA"
HIPPARCOS_CREDIT = (
    "Hipparcos, the New Reduction (van Leeuwen 2007), ESA, via NASA HEASARC table hipnewcat"
)
MAP_CREDIT = "ESA/Gaia/DPAC; CC BY-SA 3.0 IGO. Acknowledgement: A. Moitinho"
MAP_LICENCE_URL = "https://creativecommons.org/licenses/by-sa/3.0/igo/"


class SkyAssetError(Exception):
    pass


@dataclass(frozen=True)
class StarTable:
    right_ascension_degrees: np.ndarray
    declination_degrees: np.ndarray
    distance_parsecs: np.ndarray
    magnitude: np.ndarray
    colour_index: np.ndarray

    def __len__(self) -> int:
        return len(self.right_ascension_degrees)

    def select(self, mask: np.ndarray) -> "StarTable":
        return StarTable(
            self.right_ascension_degrees[mask],
            self.declination_degrees[mask],
            self.distance_parsecs[mask],
            self.magnitude[mask],
            self.colour_index[mask],
        )

    def concatenate(self, other: "StarTable") -> "StarTable":
        return StarTable(
            np.concatenate([self.right_ascension_degrees, other.right_ascension_degrees]),
            np.concatenate([self.declination_degrees, other.declination_degrees]),
            np.concatenate([self.distance_parsecs, other.distance_parsecs]),
            np.concatenate([self.magnitude, other.magnitude]),
            np.concatenate([self.colour_index, other.colour_index]),
        )


@dataclass(frozen=True)
class GatorTable:
    columns: dict[str, np.ndarray]
    query_time: str


@dataclass(frozen=True)
class RawSource:
    description: str
    retrieved: str


def distance_parsecs_from_measure(measure_milliarcseconds: np.ndarray) -> np.ndarray:
    """Distance in parsecs from the inverse-distance measurement; NaN when it is not reliable."""
    reliable = measure_milliarcseconds >= MINIMUM_RELIABLE_DISTANCE_MEASURE_MILLIARCSECONDS
    distances = np.full(measure_milliarcseconds.shape, np.nan)
    distances[reliable] = 1000.0 / measure_milliarcseconds[reliable]
    return distances


def parse_gator_table(text: str, wanted_columns: Sequence[str]) -> GatorTable:
    lines = text.splitlines()
    header_lines = [line for line in lines if line.startswith("|")]
    if not header_lines:
        raise SkyAssetError("The Gator response has no table header.")
    names = [name.strip() for name in header_lines[0].strip("|").split("|")]
    missing = [name for name in wanted_columns if name not in names]
    if missing:
        raise SkyAssetError(f"The Gator response lacks the columns {', '.join(missing)}.")
    indices = [names.index(name) for name in wanted_columns]
    values: dict[str, list[float]] = {name: [] for name in wanted_columns}
    for line in lines:
        if not line.startswith(" ") or not line.strip():
            continue
        fields = line.split()
        if len(fields) != len(names):
            raise SkyAssetError("A Gator table row does not match the header.")
        for name, index in zip(wanted_columns, indices, strict=True):
            values[name].append(np.nan if fields[index] == "null" else float(fields[index]))
    query_time_match = re.search(r"^\\DATETIME= '([^']+)'", text, re.MULTILINE)
    return GatorTable(
        columns={name: np.array(column, dtype=float) for name, column in values.items()},
        query_time=query_time_match.group(1) if query_time_match else "unknown",
    )


def star_table_from_gaia(table: GatorTable) -> StarTable:
    columns = table.columns
    complete = (
        np.isfinite(columns["ra"])
        & np.isfinite(columns["dec"])
        & np.isfinite(columns["phot_g_mean_mag"])
    )
    return StarTable(
        columns["ra"][complete],
        columns["dec"][complete],
        distance_parsecs_from_measure(columns["parallax"][complete]),
        columns["phot_g_mean_mag"][complete],
        columns["bp_rp"][complete],
    )


def star_table_from_hipparcos(content: bytes) -> StarTable:
    table = parse_single_table(io.BytesIO(content)).to_table()

    def filled(name: str) -> np.ndarray:
        return np.ma.filled(np.ma.asarray(table[name]).astype(float), np.nan)

    complete = (
        np.isfinite(filled("ra")) & np.isfinite(filled("dec")) & np.isfinite(filled("hip_mag"))
    )
    return StarTable(
        filled("ra")[complete],
        filled("dec")[complete],
        distance_parsecs_from_measure(filled("parallax")[complete]),
        filled("hip_mag")[complete],
        filled("bv_color")[complete],
    )


def unit_vectors(
    right_ascension_degrees: np.ndarray, declination_degrees: np.ndarray
) -> np.ndarray:
    right_ascension = np.radians(right_ascension_degrees)
    declination = np.radians(declination_degrees)
    return np.column_stack(
        [
            np.cos(declination) * np.cos(right_ascension),
            np.cos(declination) * np.sin(right_ascension),
            np.sin(declination),
        ]
    )


def has_neighbour_within(
    stars: StarTable, reference_stars: StarTable, radius_degrees: float
) -> np.ndarray:
    """True for every star that has a reference star closer than the given angle."""
    if len(reference_stars) == 0 or len(stars) == 0:
        return np.zeros(len(stars), dtype=bool)
    chord = 2.0 * np.sin(np.radians(radius_degrees) / 2.0)
    reference_tree = cKDTree(
        unit_vectors(reference_stars.right_ascension_degrees, reference_stars.declination_degrees)
    )
    distances, _ = reference_tree.query(
        unit_vectors(stars.right_ascension_degrees, stars.declination_degrees),
        distance_upper_bound=chord,
    )
    return np.isfinite(distances)


def merge_nearby_stars(bright_stars: StarTable, nearby_stars: StarTable) -> StarTable:
    """Nearby stars replace the bright-star rows that describe the same star."""
    listed_twice = has_neighbour_within(
        bright_stars, nearby_stars, NEARBY_MATCH_RADIUS_ARCSECONDS / 3600.0
    )
    return bright_stars.select(~listed_twice).concatenate(nearby_stars)


def select_bright_stars_missing_from(
    hipparcos_stars: StarTable, gaia_stars: StarTable
) -> StarTable:
    """Hipparcos stars without a bright Gaia star within two arcminutes."""
    bright_gaia = gaia_stars.select(gaia_stars.magnitude < BRIGHT_MATCH_MAXIMUM_GAIA_MAGNITUDE)
    duplicated = has_neighbour_within(
        hipparcos_stars, bright_gaia, BRIGHT_MATCH_RADIUS_ARCMINUTES / 60.0
    )
    return hipparcos_stars.select(~duplicated)


def pack_star_records(stars: StarTable) -> bytes:
    records = np.column_stack(
        [
            stars.right_ascension_degrees,
            stars.declination_degrees,
            np.nan_to_num(stars.distance_parsecs, nan=MISSING_DISTANCE),
            stars.magnitude,
            np.nan_to_num(stars.colour_index, nan=MISSING_COLOUR),
        ]
    )
    return records.astype("<f4").tobytes()


def convert_milky_way_map(image_bytes: bytes) -> bytes:
    with Image.open(io.BytesIO(image_bytes)) as source_image:
        resized = source_image.convert("RGB").resize(
            (MAP_WIDTH_PIXELS, MAP_HEIGHT_PIXELS), Image.Resampling.LANCZOS
        )
    output = io.BytesIO()
    resized.save(output, format="JPEG", quality=MAP_JPEG_QUALITY, optimize=True)
    return output.getvalue()


def star_record_layout(magnitude_description: str, colour_description: str) -> list[dict[str, str]]:
    return [
        {"name": "right_ascension", "unit": "degree", "description": "ICRS right ascension"},
        {"name": "declination", "unit": "degree", "description": "ICRS declination"},
        {
            "name": "distance",
            "unit": "parsec",
            "description": f"{MISSING_DISTANCE:g} when there is no reliable distance",
        },
        {"name": "magnitude", "unit": "mag", "description": magnitude_description},
        {
            "name": "colour_index",
            "unit": "mag",
            "description": f"{colour_description}; {MISSING_COLOUR:g} when there is none",
        },
    ]


def build_manifest(
    stars: StarTable,
    bright_stars: StarTable,
    hipparcos_count: int,
    bright_gaia_count: int,
    nearby_count: int,
    sources: dict[str, RawSource],
) -> dict:
    return {
        "format_version": MANIFEST_FORMAT_VERSION,
        "stars": {
            "file": STARS_FILE_NAME,
            "encoding": "little-endian float32, records of five values stored one after another",
            "count": len(stars),
            "record": star_record_layout("Gaia G magnitude", "Gaia BP minus RP colour"),
            "bright_gaia_count": bright_gaia_count,
            "nearby_count": nearby_count,
            "selection": [
                f"{GAIA_BRIGHT_CONSTRAINT} ({bright_gaia_count} stars)",
                f"{GAIA_NEARBY_CONSTRAINT}, merged without duplicates ({nearby_count} stars)",
            ],
        },
        "bright_stars": {
            "file": BRIGHT_STARS_FILE_NAME,
            "encoding": "little-endian float32, records of five values stored one after another",
            "count": len(bright_stars),
            "catalogue_count": hipparcos_count,
            "skipped_duplicate_count": hipparcos_count - len(bright_stars),
            "record": star_record_layout("Hipparcos Hp magnitude", "Hipparcos B minus V colour"),
            "epoch": "1991.25",
            "deduplication": (
                f"Skipped when a Gaia star brighter than G {BRIGHT_MATCH_MAXIMUM_GAIA_MAGNITUDE:g} "
                f"lies within {BRIGHT_MATCH_RADIUS_ARCMINUTES:g} arcminutes"
            ),
        },
        "milky_way": {
            "file": MILKY_WAY_FILE_NAME,
            "width": MAP_WIDTH_PIXELS,
            "height": MAP_HEIGHT_PIXELS,
            "projection": "equirectangular",
            "orientation": (
                "Galactic coordinates with the galactic centre in the middle and the longitude "
                "increasing to the left, verified with the Magellanic Clouds"
            ),
            "processing": (
                f"Resampled to {MAP_WIDTH_PIXELS} by {MAP_HEIGHT_PIXELS} pixels and saved as JPEG "
                f"quality {MAP_JPEG_QUALITY}; the colours are not modified"
            ),
        },
        "sources": {
            name: {"description": source.description, "retrieved": source.retrieved}
            for name, source in sources.items()
        },
        "credits": {
            "milky_way": MAP_CREDIT,
            "milky_way_licence": MAP_LICENCE_URL,
            "gaia": GAIA_CREDIT,
            "hipparcos": HIPPARCOS_CREDIT,
        },
    }


def fetch_gator_text(constraint: str) -> bytes:
    response = httpx.get(
        GATOR_URL,
        params={
            "catalog": GAIA_CATALOGUE,
            "spatial": "NONE",
            "outfmt": "1",
            "selcols": ",".join(GAIA_COLUMNS),
            "constraints": constraint,
        },
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return response.content


def fetch_hipparcos_votable() -> bytes:
    response = httpx.get(
        HEASARC_TAP_URL,
        params={
            "REQUEST": "doQuery",
            "LANG": "ADQL",
            "FORMAT": "votable",
            "QUERY": HIPPARCOS_QUERY,
        },
        timeout=REQUEST_TIMEOUT_SECONDS,
    )
    response.raise_for_status()
    return response.content


def fetch_map_image() -> bytes:
    response = httpx.get(ESA_MAP_URL, timeout=REQUEST_TIMEOUT_SECONDS, follow_redirects=True)
    response.raise_for_status()
    return response.content


def read_or_fetch(path: Path, fetch: Callable[[], bytes]) -> bytes:
    if path.exists():
        print(f"Using {path}")
        return path.read_bytes()
    print(f"Downloading {path.name}")
    content = fetch()
    path.write_bytes(content)
    return content


def modification_date(path: Path) -> str:
    return datetime.fromtimestamp(path.stat().st_mtime, UTC).date().isoformat()


def build_sky_assets(raw_directory: Path, output_directory: Path) -> dict:
    raw_directory.mkdir(parents=True, exist_ok=True)
    output_directory.mkdir(parents=True, exist_ok=True)

    bright_gaia_text = read_or_fetch(
        raw_directory / GAIA_BRIGHT_FILE_NAME, lambda: fetch_gator_text(GAIA_BRIGHT_CONSTRAINT)
    ).decode("utf-8")
    nearby_gaia_text = read_or_fetch(
        raw_directory / GAIA_NEARBY_FILE_NAME, lambda: fetch_gator_text(GAIA_NEARBY_CONSTRAINT)
    ).decode("utf-8")
    hipparcos_content = read_or_fetch(raw_directory / HIPPARCOS_FILE_NAME, fetch_hipparcos_votable)
    map_content = read_or_fetch(raw_directory / MAP_FILE_NAME, fetch_map_image)

    bright_gaia_table = parse_gator_table(bright_gaia_text, GAIA_COLUMNS)
    nearby_gaia_table = parse_gator_table(nearby_gaia_text, GAIA_COLUMNS)
    bright_gaia = star_table_from_gaia(bright_gaia_table)
    nearby_gaia = star_table_from_gaia(nearby_gaia_table)
    stars = merge_nearby_stars(bright_gaia, nearby_gaia)

    hipparcos = star_table_from_hipparcos(hipparcos_content)
    bright_stars = select_bright_stars_missing_from(hipparcos, stars)

    (output_directory / STARS_FILE_NAME).write_bytes(pack_star_records(stars))
    (output_directory / BRIGHT_STARS_FILE_NAME).write_bytes(pack_star_records(bright_stars))
    (output_directory / MILKY_WAY_FILE_NAME).write_bytes(convert_milky_way_map(map_content))

    manifest = build_manifest(
        stars,
        bright_stars,
        hipparcos_count=len(hipparcos),
        bright_gaia_count=len(bright_gaia),
        nearby_count=len(nearby_gaia),
        sources={
            "gaia_bright": RawSource(
                f"IRSA Gator {GAIA_CATALOGUE}, {GAIA_BRIGHT_CONSTRAINT}, columns "
                f"{', '.join(GAIA_COLUMNS)}",
                bright_gaia_table.query_time,
            ),
            "gaia_nearby": RawSource(
                f"IRSA Gator {GAIA_CATALOGUE}, {GAIA_NEARBY_CONSTRAINT}, columns "
                f"{', '.join(GAIA_COLUMNS)}",
                nearby_gaia_table.query_time,
            ),
            "hipparcos": RawSource(
                f"NASA HEASARC TAP: {HIPPARCOS_QUERY}",
                modification_date(raw_directory / HIPPARCOS_FILE_NAME),
            ),
            "milky_way": RawSource(
                f"ESA Gaia EDR3 colour map, {ESA_MAP_URL}",
                modification_date(raw_directory / MAP_FILE_NAME),
            ),
        },
    )
    (output_directory / MANIFEST_FILE_NAME).write_text(
        json.dumps(manifest, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )
    return manifest


def parse_arguments(arguments: Sequence[str] | None = None) -> argparse.Namespace:
    parser = argparse.ArgumentParser(
        prog="python -m app.build_sky_assets",
        description="Build the static star tables, Milky Way map and manifest of the 3D sky.",
    )
    parser.add_argument(
        "--raw-directory",
        type=Path,
        help="Directory with raw downloads to reuse; missing files are downloaded into it.",
    )
    parser.add_argument(
        "--output-directory",
        type=Path,
        default=DEFAULT_OUTPUT_DIRECTORY,
        help="Where the assets are written (default: frontend/public/sky).",
    )
    return parser.parse_args(arguments)


def main(arguments: Sequence[str] | None = None) -> int:
    parsed = parse_arguments(arguments)
    try:
        if parsed.raw_directory is not None:
            manifest = build_sky_assets(parsed.raw_directory, parsed.output_directory)
        else:
            with tempfile.TemporaryDirectory() as temporary_directory:
                manifest = build_sky_assets(Path(temporary_directory), parsed.output_directory)
    except (SkyAssetError, httpx.HTTPError) as error:
        print(f"Building the sky assets failed: {error}", file=sys.stderr)
        return 1
    print(
        f"Wrote {manifest['stars']['count']} stars and {manifest['bright_stars']['count']} "
        f"Hipparcos stars to {parsed.output_directory}"
    )
    return 0


if __name__ == "__main__":
    sys.exit(main())
