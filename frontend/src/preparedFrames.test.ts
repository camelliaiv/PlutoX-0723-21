import { describe, expect, it } from "vitest";
import type { Frame, FramesResponse } from "./api";
import { DEFAULT_PLAYER_SETTINGS } from "./playerSettings";
import { buildPlayerPixels, buildThumbnailPixels, prepareFrames } from "./preparedFrames";

const frame = {
  image: [[10]],
  variance: [[1]],
  saturated_fraction: [[1]],
} as unknown as Frame;

const response = {
  frames: [frame, { ...frame, image: [[12]] }],
  display_range: { minimum: 0, maximum: 10 },
} as unknown as FramesResponse;

describe("preparedFrames", () => {
  const prepared = prepareFrames(response);

  it("prepares the mode images once for all frames", () => {
    expect(prepared.modeImages.differences).toHaveLength(2);
    expect(prepared.modeImages.stack[0]?.[0]).toBe(11);
  });

  it("builds one pixel per image cell for the chosen epoch", () => {
    expect(buildPlayerPixels(prepared, 0, DEFAULT_PLAYER_SETTINGS)).toHaveLength(4);
  });

  it("ignores the mode and the saturated tint in thumbnails", () => {
    const settings = {
      ...DEFAULT_PLAYER_SETTINGS,
      mode: "difference" as const,
      showSaturation: true,
    };
    expect(Array.from(buildThumbnailPixels(prepared, 0, settings))).toEqual(
      Array.from(buildPlayerPixels(prepared, 0, DEFAULT_PLAYER_SETTINGS)),
    );
  });
});
