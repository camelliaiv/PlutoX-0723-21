import { describe, expect, it } from "vitest";
import type { Frame } from "./api";
import {
  describeSaturation,
  formatFrameLabel,
  formatFrameProvenance,
  hasSaturatedPixels,
} from "./frameText";

const frame: Frame = {
  epoch_number: 2,
  start_date: "2026-03-11T01:00:00",
  end_date: "2026-05-05T02:00:00",
  detector: 5,
  exposure_count: 61,
  skipped_exposure_count: 2,
  wavelength_min_micrometers: 3.9,
  wavelength_max_micrometers: 4.4,
  observation_ids: ["a", "b", "c"],
  data_releases: ["spherex_dr1", "spherex_qr3"],
  image: [[1, null]],
  variance: [[1, null]],
  coverage: [[1, 0]],
  saturated_fraction: [[0, null]],
};

describe("frameText", () => {
  it("formats the frame label", () => {
    expect(formatFrameLabel(frame)).toBe(
      "Epoch 2 · 2026-03-11 – 2026-05-05 (UTC) · Detector D5 · 3.90–4.40 µm at target · " +
        "61 exposures used, 2 skipped · Data Release 1, Quick Release 3",
    );
  });

  it("omits skipped exposures when there are none", () => {
    const label = formatFrameLabel({ ...frame, skipped_exposure_count: 0, exposure_count: 1 });
    expect(label).toContain("1 exposure used ·");
  });

  it("describes the observations of a frame", () => {
    expect(formatFrameProvenance(frame)).toBe(
      "This frame combines 3 observations from SPHEREx Data Release 1, Quick Release 3.",
    );
  });

  it("detects saturated pixels, ignoring missing values", () => {
    expect(hasSaturatedPixels(frame)).toBe(false);
    expect(hasSaturatedPixels({ ...frame, saturated_fraction: [[0, 0.25]] })).toBe(true);
  });

  it("gives a saturation notice only when a frame is saturated", () => {
    expect(describeSaturation([frame])).toBeNull();
    const notice = describeSaturation([frame, { ...frame, saturated_fraction: [[1, 0]] }]);
    expect(notice).toContain("Some pixels are saturated");
  });
});
