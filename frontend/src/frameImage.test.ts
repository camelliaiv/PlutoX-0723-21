import { describe, expect, it } from "vitest";
import type { Frame } from "./api";
import {
  buildFramePixels,
  integerScaleFor,
  MISSING_PIXEL_COLOR,
  orientNorthUp,
  scaleBarLengthPixels,
  stretchIntensity,
} from "./frameImage";

const range = { minimum: 0, maximum: 10 };

function makeFrame(image: (number | null)[][], saturated: (number | null)[][]): Frame {
  return {
    epoch_number: 1,
    start_date: "2025-08-15T01:00:00",
    end_date: "2025-10-01T02:00:00",
    detector: 5,
    exposure_count: 3,
    skipped_exposure_count: 0,
    wavelength_min_micrometers: 3.9,
    wavelength_max_micrometers: 4.4,
    observation_ids: ["a", "b", "c"],
    data_releases: ["spherex_dr1"],
    image,
    variance: image,
    coverage: image.map((row) => row.map(() => 1)),
    saturated_fraction: saturated,
    predicted_position: { column: 0, row: 0, right_ascension: 0, declination: 0 },
  };
}

describe("stretchIntensity", () => {
  it("maps the range ends to 0 and 1", () => {
    expect(stretchIntensity(0, range)).toBe(0);
    expect(stretchIntensity(10, range)).toBeCloseTo(1, 12);
  });

  it("clamps values outside the range", () => {
    expect(stretchIntensity(-5, range)).toBe(0);
    expect(stretchIntensity(50, range)).toBeCloseTo(1, 12);
  });

  it("brightens faint values more than a linear mapping", () => {
    expect(stretchIntensity(1, range) ?? 0).toBeGreaterThan(0.1);
  });

  it("keeps missing pixels missing", () => {
    expect(stretchIntensity(null, range)).toBeNull();
  });

  it("maps everything to 0 when the range has no width", () => {
    expect(stretchIntensity(3, { minimum: 3, maximum: 3 })).toBe(0);
  });
});

describe("orientNorthUp", () => {
  it("puts the southern row 0 at the bottom", () => {
    expect(orientNorthUp([[1], [2], [3]])).toEqual([[3], [2], [1]]);
  });

  it("does not change the input", () => {
    const rows = [[1], [2]];
    orientNorthUp(rows);
    expect(rows).toEqual([[1], [2]]);
  });
});

describe("scaling", () => {
  it("uses the largest integer scale that fits about 384 pixels", () => {
    expect(integerScaleFor(32)).toBe(12);
    expect(integerScaleFor(40)).toBe(9);
    expect(integerScaleFor(500)).toBe(1);
  });

  it("converts an angle to canvas pixels", () => {
    expect(scaleBarLengthPixels(60, 6, 10)).toBe(100);
  });
});

describe("buildFramePixels", () => {
  const frame = makeFrame(
    [
      [0, null],
      [10, 5],
    ],
    [
      [0, 0],
      [0.5, 0],
    ],
  );

  it("draws the northern row first and paints missing pixels in the missing colour", () => {
    const pixels = Array.from(buildFramePixels(frame, range, false));
    expect(pixels.slice(0, 4)).toEqual([255, 255, 255, 255]);
    expect(pixels.slice(8, 12)).toEqual([0, 0, 0, 255]);
    expect(pixels.slice(12, 16)).toEqual([...MISSING_PIXEL_COLOR]);
  });

  it("tints saturated pixels only when requested", () => {
    const plain = Array.from(buildFramePixels(frame, range, false)).slice(0, 4);
    const tinted = Array.from(buildFramePixels(frame, range, true)).slice(0, 4);
    expect(plain).toEqual([255, 255, 255, 255]);
    expect(tinted[0]).toBe(255);
    expect(tinted[1]).toBeLessThan(255);
  });

  it("draws every pixel as missing without a display range", () => {
    const pixels = Array.from(buildFramePixels(frame, null, false));
    expect(pixels.slice(0, 4)).toEqual([...MISSING_PIXEL_COLOR]);
  });
});
