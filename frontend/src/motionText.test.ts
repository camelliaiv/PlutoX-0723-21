import { describe, expect, it } from "vitest";
import type { Frame } from "./api";
import {
  describePredictedMotion,
  describeShiftDirection,
  formatPredictedMotion,
} from "./motionText";

function frameAt(epochNumber: number, middleDay: string, column: number, row: number): Frame {
  return {
    epoch_number: epochNumber,
    start_date: `${middleDay}T00:00:00`,
    end_date: `${middleDay}T00:00:00`,
    predicted_position: { column, row },
  } as Frame;
}

describe("describePredictedMotion", () => {
  const frames = [
    frameAt(1, "2025-01-01", 10, 10),
    frameAt(2, "2025-06-01", 10.5, 10.5),
    frameAt(3, "2026-01-01", 13, 14),
  ];

  it("compares the first and the last epoch", () => {
    const motion = describePredictedMotion(frames, 6);
    expect(motion?.columnShift).toBe(3);
    expect(motion?.rowShift).toBe(4);
    expect(motion?.pixels).toBe(5);
    expect(motion?.arcseconds).toBe(30);
    expect(motion?.days).toBe(365);
    expect(motion?.arcsecondsPerYear).toBeCloseTo((30 / 365) * 365.25, 10);
    expect(motion?.firstEpochNumber).toBe(1);
    expect(motion?.lastEpochNumber).toBe(3);
  });

  it("returns null for a single epoch or positions that are not finite", () => {
    expect(describePredictedMotion(frames.slice(0, 1), 6)).toBeNull();
    expect(
      describePredictedMotion([frameAt(1, "2025-01-01", Number.NaN, 1), frames[2] as Frame], 6),
    ).toBeNull();
  });

  it("returns null when the epochs do not move forward in time", () => {
    expect(describePredictedMotion([frames[2] as Frame, frames[0] as Frame], 6)).toBeNull();
  });
});

describe("describeShiftDirection", () => {
  it("names north and west for positive row and column shifts", () => {
    expect(describeShiftDirection(1.5, 2)).toBe("2.00 px north, 1.50 px west");
  });

  it("names south and east for negative shifts", () => {
    expect(describeShiftDirection(-1, -0.5)).toBe("0.50 px south, 1.00 px east");
  });

  it("reports no shift for tiny movements", () => {
    expect(describeShiftDirection(0.01, -0.02)).toBe("no shift");
  });
});

describe("formatPredictedMotion", () => {
  it("writes one sentence with the epochs, the span and the rate", () => {
    const motion = describePredictedMotion(
      [frameAt(1, "2025-01-01", 0, 0), frameAt(3, "2026-01-01", 0, 3)],
      6,
    );
    expect(motion && formatPredictedMotion(motion)).toBe(
      "3.00 px north, 3.00 px ≈ 18.0″ between epoch 1 and epoch 3 (365 days, 18.0″ per year).",
    );
  });
});
