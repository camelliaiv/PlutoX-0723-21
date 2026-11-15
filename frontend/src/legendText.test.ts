import { describe, expect, it } from "vitest";
import type { Frame, FramesResponse } from "./api";
import { describeLegend } from "./legendText";
import { DEFAULT_PLAYER_SETTINGS } from "./playerSettings";
import { prepareFrames } from "./preparedFrames";

const frame = {
  image: [[0, 4]],
  variance: [[1, 1]],
  saturated_fraction: [[0, 0]],
} as unknown as Frame;
const later = { ...frame, image: [[2, 9]] } as unknown as Frame;
const prepared = prepareFrames({
  unit: "MJy/sr",
  frames: [frame, later],
  display_range: { minimum: 0.04, maximum: 120 },
} as unknown as FramesResponse);

describe("describeLegend", () => {
  it("shows the shared display range in frame mode", () => {
    expect(describeLegend(prepared, DEFAULT_PLAYER_SETTINGS, 0)).toEqual({
      gradient: "inferno",
      lowLabel: "0.0",
      highLabel: "120",
      caption: "MJy/sr, shared across epochs",
    });
  });

  it("uses the colour map that is selected", () => {
    const settings = { ...DEFAULT_PLAYER_SETTINGS, colorMap: "gray" as const };
    expect(describeLegend(prepared, settings, 0).gradient).toBe("gray");
  });

  it("states the weighting in stack mode", () => {
    const settings = { ...DEFAULT_PLAYER_SETTINGS, mode: "stack" as const };
    expect(describeLegend(prepared, settings, 0).caption).toBe(
      "MJy/sr · stack: inverse-variance weighted mean of 2 epochs",
    );
  });

  it("shows a range that is symmetric about zero in difference mode", () => {
    const settings = { ...DEFAULT_PLAYER_SETTINGS, mode: "difference" as const };
    const legend = describeLegend(prepared, settings, 1);
    expect(legend.gradient).toBe("difference");
    expect(legend.lowLabel).toBe(`−${legend.highLabel.slice(1)}`);
    expect(legend.caption).toContain("epoch 2 minus epoch 1");
  });

  it("leaves the labels empty without a display range", () => {
    const withoutRange = prepareFrames({
      unit: "MJy/sr",
      frames: [frame],
      display_range: null,
    } as unknown as FramesResponse);
    expect(describeLegend(withoutRange, DEFAULT_PLAYER_SETTINGS, 0).lowLabel).toBe("");
  });
});
