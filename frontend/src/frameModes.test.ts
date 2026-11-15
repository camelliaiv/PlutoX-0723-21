import { describe, expect, it } from "vitest";
import type { Frame } from "./api";
import {
  buildDifferenceImage,
  buildModeImages,
  buildStackImage,
  percentile,
  sequentialRange,
  symmetricRange,
} from "./frameModes";

function makeFrame(image: (number | null)[][], variance: (number | null)[][]): Frame {
  return { image, variance, saturated_fraction: [] } as unknown as Frame;
}

describe("percentile", () => {
  it("interpolates between sorted values", () => {
    expect(percentile([4, 1, 3, 2], 50)).toBe(2.5);
    expect(percentile([0, 10], 25)).toBe(2.5);
  });

  it("returns the ends at 0 and 100 and 0 for no values", () => {
    expect(percentile([5, 1, 9], 0)).toBe(1);
    expect(percentile([5, 1, 9], 100)).toBe(9);
    expect(percentile([], 50)).toBe(0);
  });
});

describe("buildDifferenceImage", () => {
  it("gives zeros for identical images", () => {
    const image = [
      [1, 2],
      [3, 4],
    ];
    expect(buildDifferenceImage(image, image)).toEqual([
      [0, 0],
      [0, 0],
    ]);
  });

  it("subtracts the reference", () => {
    expect(buildDifferenceImage([[5, 7]], [[1, 2]])).toEqual([[4, 5]]);
  });

  it("gives null where either image has no value", () => {
    expect(buildDifferenceImage([[null, 1, 2]], [[1, null, Number.NaN]])).toEqual([
      [null, null, null],
    ]);
  });

  it("throws when the sizes differ", () => {
    expect(() => buildDifferenceImage([[1, 2]], [[1]])).toThrow("Frames have different sizes.");
    expect(() => buildDifferenceImage([[1]], [[1], [2]])).toThrow("Frames have different sizes.");
  });
});

describe("buildStackImage", () => {
  it("weights each epoch by the inverse of its variance", () => {
    const frames = [makeFrame([[10]], [[1]]), makeFrame([[20]], [[4]])];
    expect(buildStackImage(frames)[0]?.[0]).toBeCloseTo((10 + 20 / 4) / (1 + 1 / 4), 12);
  });

  it("ignores epochs with a missing value or a variance that is not positive", () => {
    const frames = [
      makeFrame([[null]], [[1]]),
      makeFrame([[8]], [[0]]),
      makeFrame([[6]], [[2]]),
      makeFrame([[2]], [[null]]),
    ];
    expect(buildStackImage(frames)).toEqual([[6]]);
  });

  it("is null only where no epoch qualifies", () => {
    expect(buildStackImage([makeFrame([[null, 1]], [[1, 1]])])).toEqual([[null, 1]]);
  });
});

describe("symmetricRange", () => {
  it("uses the 99.5th percentile of absolute differences shared by all images", () => {
    expect(symmetricRange([[[-2, 1]], [[0, 4]]])).toBeCloseTo(3.97, 10);
  });

  it("falls back to 1 when there is nothing to scale", () => {
    expect(symmetricRange([])).toBe(1);
    expect(symmetricRange([[[0, 0]], [[null, 0]]])).toBe(1);
  });
});

describe("sequentialRange", () => {
  it("spans the 0.5th to the 99.5th percentile", () => {
    const range = sequentialRange([[0, 100]]);
    expect(range.minimum).toBeCloseTo(0.5, 6);
    expect(range.maximum).toBeCloseTo(99.5, 6);
  });

  it("widens a degenerate range by one", () => {
    expect(sequentialRange([[3, 3]])).toEqual({ minimum: 3, maximum: 4 });
  });
});

describe("buildModeImages", () => {
  it("makes the reference difference all zero and keeps it out of the shared limit", () => {
    const frames = [makeFrame([[1, 1]], [[1, 1]]), makeFrame([[3, 1]], [[1, 1]])];
    const modeImages = buildModeImages(frames);
    expect(modeImages.differences[0]).toEqual([[0, 0]]);
    expect(modeImages.differences[1]).toEqual([[2, 0]]);
    expect(modeImages.differenceLimit).toBeCloseTo(1.99, 2);
    expect(modeImages.stack).toEqual([[2, 1]]);
  });
});
