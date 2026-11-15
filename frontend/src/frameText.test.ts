import { describe, expect, it } from "vitest";
import type { Frame, FramesResponse } from "./api";
import {
  describeSaturation,
  formatFrameLabel,
  formatFramePlayerLabel,
  formatFrameSource,
  formatPlayerBadge,
  countSaturatedPixels,
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
  predicted_position: { column: 0, row: 0, right_ascension: 0, declination: 0 },
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

  it("detects saturated pixels, ignoring missing values", () => {
    expect(hasSaturatedPixels(frame)).toBe(false);
    expect(hasSaturatedPixels({ ...frame, saturated_fraction: [[0, 0.25]] })).toBe(true);
  });

  it("gives a saturation notice only when a frame is saturated", () => {
    expect(describeSaturation([frame])).toBeNull();
    const notice = describeSaturation([frame, { ...frame, saturated_fraction: [[1, 0]] }]);
    expect(notice).toContain("Some pixels are saturated");
  });

  describe("formatFrameSource", () => {
    const response = {
      frames: [frame, { ...frame, data_releases: ["spherex_dr1"] }],
      served_from_cache: true,
      computed_at: "2026-11-15T10:20:30+00:00",
    } as FramesResponse;

    it("states that cached frames are precomputed, with date and releases", () => {
      expect(formatFrameSource(response)).toBe(
        "Precomputed frames, computed 2026-11-15 from SPHEREx Data Release 1 + Quick Release 3.",
      );
    });

    it("states that other frames were computed live", () => {
      expect(formatFrameSource({ ...response, served_from_cache: false })).toBe(
        "Computed live on 2026-11-15 from SPHEREx Data Release 1 + Quick Release 3.",
      );
    });

    it("omits the releases when there are no frames", () => {
      expect(formatFrameSource({ ...response, frames: [] })).toBe(
        "Precomputed frames, computed 2026-11-15.",
      );
    });
  });
});

describe("countSaturatedPixels", () => {
  it("counts pixels saturated in at least half of the exposures", () => {
    const saturatedFrame = { ...frame, saturated_fraction: [[0.5, 0.49, null, 1]] };
    expect(countSaturatedPixels(saturatedFrame)).toBe(2);
  });
});

describe("formatPlayerBadge", () => {
  it("names the detector and the epoch with its dates", () => {
    expect(formatPlayerBadge(frame, "frame", 1, 3)).toBe("D5 · Epoch 2 · 11 Mar – 5 May 2026");
  });

  it("describes difference and stack modes", () => {
    expect(formatPlayerBadge(frame, "difference", 2, 3)).toBe("D5 · Epoch 3 minus epoch 1");
    expect(formatPlayerBadge(frame, "stack", 0, 3)).toBe("D5 · Stack of 3 epochs");
  });
});

describe("formatFramePlayerLabel", () => {
  it("combines the frame label, the mode and the predicted position", () => {
    const label = formatFramePlayerLabel(
      { ...frame, predicted_position: { ...frame.predicted_position, column: 3.14, row: 20 } },
      "stack",
      1,
      3,
    );
    expect(label).toContain("Real SPHEREx image, epoch 2 of 3.");
    expect(label).toContain(formatFrameLabel(frame));
    expect(label).toContain("Mode: Stack. Predicted position at column 3.1, row 20.0.");
    expect(label.endsWith("North up, east left.")).toBe(true);
  });
});
