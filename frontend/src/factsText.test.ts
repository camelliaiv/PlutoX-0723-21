import { describe, expect, it } from "vitest";
import type { Frame, FramesResponse } from "./api";
import {
  describeFieldRows,
  describeFrameRows,
  describeMetadata,
  meanSaturationOfDetector,
} from "./factsText";

const frame = {
  epoch_number: 2,
  start_date: "2026-03-11T01:00:00",
  end_date: "2026-05-05T02:00:00",
  exposure_count: 61,
  skipped_exposure_count: 2,
  wavelength_min_micrometers: 3.9,
  wavelength_max_micrometers: 4.4,
  observation_ids: ["a", "b"],
  data_releases: ["spherex_dr1", "spherex_qr3"],
  saturated_fraction: [[0.9, 0.1]],
  predicted_position: { column: 15.123, row: 16.5 },
} as unknown as Frame;

const response = {
  reference_position: { right_ascension: 269.4521, declination: 4.6934 },
  reference_date: "2025-12-01T00:00:00",
  grid: { size_pixels: 32, pixel_scale_arcseconds: 6.15 },
  unit: "MJy/sr",
  exposures: [
    { saturated_fraction: 1, non_finite_fraction: 0.1 },
    { saturated_fraction: 0.5, non_finite_fraction: 0.3 },
    { saturated_fraction: null, non_finite_fraction: null },
  ],
} as unknown as FramesResponse;

describe("describeFieldRows", () => {
  it("lists the position, its date and the field of view", () => {
    expect(describeFieldRows(response)).toEqual([
      { label: "RA / Dec", value: "269.4521° / 4.6934°" },
      { label: "Position date", value: "2025-12-01" },
      { label: "Field of view", value: "32×32 px · 6.15″/px · 3.28′" },
    ]);
  });
});

describe("describeFrameRows", () => {
  it("describes the current epoch", () => {
    const rows = describeFrameRows(frame, 2, 3);
    expect(rows[0]).toEqual({ label: "Epoch", value: "2 of 3 · 11 Mar – 5 May 2026" });
    expect(rows[1]?.value).toBe("3.90–4.40 µm");
    expect(rows[2]?.value).toBe("61 used, 2 skipped");
    expect(rows[3]?.value).toBe("Data Release 1, Quick Release 3");
    expect(rows[4]?.value).toBe("15.12, 16.50");
    expect(rows[5]?.value).toBe("1 (at least half of the exposures)");
  });
});

describe("describeMetadata", () => {
  it("includes the unit, the observations and the exposure flag summaries", () => {
    const lines = describeMetadata(response, frame);
    expect(lines[0]).toBe("Unit: MJy/sr");
    expect(lines[2]).toBe("2 observations in this epoch, for example a");
    expect(lines).toContain("Mean saturated fraction of the exposures: 0.75");
    expect(lines).toContain("Largest non-finite fraction of an exposure: 0.30");
  });

  it("leaves out the flag summaries without exposures", () => {
    const lines = describeMetadata({ ...response, exposures: [] }, frame);
    expect(lines.some((line) => line.startsWith("Mean saturated"))).toBe(false);
  });
});

describe("meanSaturationOfDetector", () => {
  it("averages the exposures that have a value", () => {
    expect(meanSaturationOfDetector(response)).toBe(0.75);
    expect(meanSaturationOfDetector({ ...response, exposures: [] })).toBeNull();
  });
});
