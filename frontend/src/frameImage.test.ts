import { describe, expect, it } from "vitest";
import type { Frame } from "./api";
import { mapSignedToColor, MISSING_PIXEL_COLOR } from "./colorMaps";
import {
  buildFramePixels,
  orientNorthUp,
  stretchIntensity,
  type RenderRequest,
} from "./frameImage";
import { buildModeImages } from "./frameModes";

const range = { minimum: 0, maximum: 10 };

function makeFrame(image: (number | null)[][], saturated: (number | null)[][]): Frame {
  return {
    image,
    variance: image.map((row) => row.map(() => 1)),
    saturated_fraction: saturated,
  } as unknown as Frame;
}

const firstFrame = makeFrame(
  [
    [0, null],
    [10, 5],
  ],
  [
    [0, 0],
    [0.5, 0],
  ],
);
const secondFrame = makeFrame(
  [
    [0, 4],
    [10, 5],
  ],
  [
    [0, 0],
    [0, 0],
  ],
);
const frames = [firstFrame, secondFrame];
const modeImages = buildModeImages(frames);

function request(overrides: Partial<RenderRequest>): RenderRequest {
  return {
    mode: "frame",
    colorMap: "gray",
    stretch: "linear",
    showSaturation: false,
    epochIndex: 0,
    displayRange: range,
    ...overrides,
  };
}

function pixelAt(pixels: Uint8ClampedArray, index: number): number[] {
  return Array.from(pixels.slice(index * 4, index * 4 + 4));
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
    expect(stretchIntensity(1, range, "asinh") ?? 0).toBeGreaterThan(0.1);
    expect(stretchIntensity(1, range, "linear")).toBeCloseTo(0.1, 12);
  });

  it("keeps missing pixels missing", () => {
    expect(stretchIntensity(null, range)).toBeNull();
    expect(stretchIntensity(Number.NaN, range)).toBeNull();
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

describe("buildFramePixels", () => {
  it("draws the northern row first and paints missing pixels in the missing colour", () => {
    const pixels = buildFramePixels(frames, modeImages, request({}));
    expect(pixelAt(pixels, 0)).toEqual([255, 255, 255, 255]);
    expect(pixelAt(pixels, 2)).toEqual([0, 0, 0, 255]);
    expect(pixelAt(pixels, 3)).toEqual([...MISSING_PIXEL_COLOR]);
  });

  it("does not mirror the columns", () => {
    const pixels = buildFramePixels(frames, modeImages, request({ epochIndex: 1 }));
    expect(pixelAt(pixels, 1)).toEqual([128, 128, 128, 255]);
    expect(pixelAt(pixels, 3)).toEqual([102, 102, 102, 255]);
  });

  it("uses the inferno map when asked", () => {
    const pixels = buildFramePixels(frames, modeImages, request({ colorMap: "inferno" }));
    expect(pixelAt(pixels, 0)).toEqual([252, 255, 164, 255]);
  });

  it("tints saturated pixels only in frame and stack modes and only when requested", () => {
    const plain = pixelAt(buildFramePixels(frames, modeImages, request({})), 0);
    const tinted = pixelAt(
      buildFramePixels(frames, modeImages, request({ showSaturation: true })),
      0,
    );
    const stacked = pixelAt(
      buildFramePixels(frames, modeImages, request({ mode: "stack", showSaturation: true })),
      0,
    );
    const difference = pixelAt(
      buildFramePixels(frames, modeImages, request({ mode: "difference", showSaturation: true })),
      0,
    );
    expect(plain).toEqual([255, 255, 255, 255]);
    expect(tinted[0]).toBe(255);
    expect(tinted[1]).toBeLessThan(255);
    expect(stacked[1]).toBeLessThan(255);
    expect(difference).toEqual(
      pixelAt(buildFramePixels(frames, modeImages, request({ mode: "difference" })), 0),
    );
  });

  it("draws the first epoch of a difference in the neutral colour and gaps as missing", () => {
    const pixels = buildFramePixels(frames, modeImages, request({ mode: "difference" }));
    expect(pixelAt(pixels, 0)).toEqual([...mapSignedToColor(0)]);
    expect(pixelAt(pixels, 3)).toEqual([...MISSING_PIXEL_COLOR]);
  });

  it("draws every frame pixel as missing without a display range", () => {
    const pixels = buildFramePixels(frames, modeImages, request({ displayRange: null }));
    expect(pixelAt(pixels, 0)).toEqual([...MISSING_PIXEL_COLOR]);
  });

  it("returns no pixels for an epoch that does not exist", () => {
    expect(buildFramePixels(frames, modeImages, request({ epochIndex: 9 }))).toHaveLength(0);
  });
});
