import { describe, expect, it } from "vitest";
import type { Frame } from "./api";
import { buildModeImages } from "./frameModes";
import { describePixelReadout } from "./pixelReadout";

const frames = [
  { image: [[1, null]], variance: [[0.5, 1]], coverage: [[2, 0]], saturated_fraction: [[0, null]] },
  { image: [[5, 3]], variance: [[0.25, 1]], coverage: [[1, 1]], saturated_fraction: [[0.5, 0]] },
] as unknown as Frame[];
const modeImages = buildModeImages(frames);

function read(mode: "frame" | "stack" | "difference", column: number): string {
  return describePixelReadout(
    frames[1] as Frame,
    1,
    mode,
    modeImages,
    { column, row: 0 },
    "MJy/sr",
  );
}

describe("describePixelReadout", () => {
  it("shows the frame value with its variance, coverage and saturation", () => {
    expect(read("frame", 0)).toBe(
      "pixel (0, 0) · 5.00 MJy/sr · variance 0.25 · coverage 1 · saturated 0.50",
    );
  });

  it("shows the difference to the first epoch", () => {
    expect(read("difference", 0)).toContain("4.00 MJy/sr");
  });

  it("shows the stacked value", () => {
    expect(read("stack", 0)).toContain("3.67 MJy/sr");
  });

  it("says when there is no data", () => {
    expect(read("difference", 1)).toContain("no data MJy/sr");
  });
});
