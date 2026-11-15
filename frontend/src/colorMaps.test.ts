import { describe, expect, it } from "vitest";
import {
  mapIntensityToColor,
  mapSignedToColor,
  MISSING_PIXEL_COLOR,
  sampleGradient,
} from "./colorMaps";

function luminance([red, green, blue]: readonly number[]): number {
  return 0.2126 * (red ?? 0) + 0.7152 * (green ?? 0) + 0.0722 * (blue ?? 0);
}

describe("mapIntensityToColor", () => {
  it("starts and ends the inferno map on its end colours", () => {
    expect(mapIntensityToColor(0, "inferno")).toEqual([0, 0, 4, 255]);
    expect(mapIntensityToColor(1, "inferno")).toEqual([252, 255, 164, 255]);
  });

  it("brightens along the inferno map, allowing for 8-bit rounding", () => {
    let previous = -1;
    for (let step = 0; step < 256; step += 1) {
      const current = luminance(mapIntensityToColor(step / 255, "inferno"));
      expect(current).toBeGreaterThanOrEqual(previous - 1);
      previous = current;
    }
  });

  it("maps gray to equal channels", () => {
    expect(mapIntensityToColor(0, "gray")).toEqual([0, 0, 0, 255]);
    expect(mapIntensityToColor(1, "gray")).toEqual([255, 255, 255, 255]);
    const [red, green, blue] = mapIntensityToColor(0.5, "gray");
    expect(red).toBe(green);
    expect(green).toBe(blue);
  });

  it("clamps intensities outside 0 to 1", () => {
    expect(mapIntensityToColor(-2, "gray")).toEqual(mapIntensityToColor(0, "gray"));
    expect(mapIntensityToColor(3, "gray")).toEqual(mapIntensityToColor(1, "gray"));
  });
});

describe("mapSignedToColor", () => {
  it("uses the end colours at plus and minus one and the neutral colour at zero", () => {
    expect(mapSignedToColor(-1)).toEqual([47, 123, 255, 255]);
    expect(mapSignedToColor(1)).toEqual([255, 179, 71, 255]);
    expect(mapSignedToColor(0)[0]).toBeLessThan(25);
  });

  it("is blue for negative values and orange for positive values", () => {
    const [negativeRed, , negativeBlue] = mapSignedToColor(-0.8);
    const [positiveRed, , positiveBlue] = mapSignedToColor(0.8);
    expect(negativeBlue).toBeGreaterThan(negativeRed);
    expect(positiveRed).toBeGreaterThan(positiveBlue);
  });

  it("clamps beyond plus and minus one", () => {
    expect(mapSignedToColor(5)).toEqual(mapSignedToColor(1));
    expect(mapSignedToColor(-5)).toEqual(mapSignedToColor(-1));
  });

  it("stays distinct from the missing pixel colour", () => {
    expect(mapSignedToColor(0)).not.toEqual(MISSING_PIXEL_COLOR);
  });
});

describe("sampleGradient", () => {
  it("returns the requested number of colours from the first to the last", () => {
    const samples = sampleGradient("inferno", 5);
    expect(samples).toHaveLength(5);
    expect(samples[0]).toEqual([0, 0, 4, 255]);
    expect(samples[4]).toEqual([252, 255, 164, 255]);
  });

  it("uses the diverging map for differences", () => {
    expect(sampleGradient("difference", 3)[2]).toEqual([255, 179, 71, 255]);
  });
});
