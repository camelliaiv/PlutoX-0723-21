import type { ExposureMeasurement, Frame } from "./api";
import { prepareFrames, type PreparedFrames } from "./preparedFrames";

export function makeExposure(overrides: Partial<ExposureMeasurement> = {}): ExposureMeasurement {
  return {
    observation_id: "observation",
    data_release: "spherex_dr1",
    epoch_number: 1,
    modified_julian_date: 60900,
    wavelength_micrometers: 1,
    bandwidth_micrometers: 0.02,
    flux_millijansky: 10,
    flux_error_millijansky: 1,
    saturated_fraction: 0,
    non_finite_fraction: 0,
    ...overrides,
  };
}

export function makeFrame(epochNumber: number, startDate: string, endDate: string): Frame {
  return {
    epoch_number: epochNumber,
    start_date: startDate,
    end_date: endDate,
    detector: 1,
    exposure_count: 1,
    skipped_exposure_count: 0,
    wavelength_min_micrometers: 0.75,
    wavelength_max_micrometers: 1.09,
    observation_ids: ["observation"],
    data_releases: ["spherex_dr1"],
    image: [[1]],
    variance: [[1]],
    coverage: [[1]],
    saturated_fraction: [[0]],
    predicted_position: { column: 0.5, row: 0.5, right_ascension: 0, declination: 0 },
  };
}

export function makePrepared(
  frames: Frame[],
  exposures: ExposureMeasurement[],
  fluxUnit = "mJy",
): PreparedFrames {
  return prepareFrames({
    reference_position: { right_ascension: 1, declination: 2 },
    reference_date: "2025-12-01T00:00:00",
    grid: {
      size_pixels: 1,
      pixel_scale_arcseconds: 6.15,
      center: { right_ascension: 1, declination: 2 },
      orientation: "north up",
    },
    unit: "MJy/sr",
    display_range: null,
    citations: [],
    frames,
    exposures,
    flux_unit: fluxUnit,
    notes: [],
    served_from_cache: true,
    computed_at: "2026-11-15T10:20:30+00:00",
  });
}
