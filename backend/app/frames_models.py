from dataclasses import dataclass

from app.spherex_archive import Collection


@dataclass(frozen=True)
class SkyPosition:
    right_ascension: float
    declination: float


@dataclass(frozen=True)
class GridDescription:
    size_pixels: int
    pixel_scale_arcseconds: float
    center: SkyPosition
    orientation: str


@dataclass(frozen=True)
class DisplayRange:
    minimum: float
    maximum: float


@dataclass(frozen=True)
class FrameResponse:
    epoch_number: int
    start_date: str
    end_date: str
    detector: int
    exposure_count: int
    skipped_exposure_count: int
    wavelength_min_micrometers: float
    wavelength_max_micrometers: float
    observation_ids: list[str]
    data_releases: list[Collection]
    image: list[list[float | None]]
    variance: list[list[float | None]]
    coverage: list[list[int]]
    saturated_fraction: list[list[float | None]]


@dataclass(frozen=True)
class FramesResponse:
    reference_position: SkyPosition
    reference_date: str
    grid: GridDescription
    unit: str
    display_range: DisplayRange | None
    citations: list[str]
    frames: list[FrameResponse]
    notes: list[str]
    served_from_cache: bool
    computed_at: str
