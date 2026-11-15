import { describe, expect, it } from "vitest";
import { DEFAULT_PLAYER_SETTINGS, readPlayerSettings, writePlayerSettings } from "./playerSettings";

function write(settings: Parameters<typeof writePlayerSettings>[1]): string {
  const parameters = new URLSearchParams();
  writePlayerSettings(parameters, settings);
  return parameters.toString();
}

describe("readPlayerSettings", () => {
  it("returns the defaults for an empty query", () => {
    expect(readPlayerSettings(new URLSearchParams(""))).toEqual(DEFAULT_PLAYER_SETTINGS);
  });

  it("reads every parameter", () => {
    const parameters = new URLSearchParams(
      "mode=difference&map=gray&stretch=linear&zoom=6&marker=0&track=0",
    );
    expect(readPlayerSettings(parameters)).toEqual({
      mode: "difference",
      colorMap: "gray",
      stretch: "linear",
      zoom: 6,
      showMarker: false,
      showTrack: false,
      showSaturation: false,
    });
  });

  it("ignores invalid values", () => {
    const parameters = new URLSearchParams("mode=sum&map=viridis&stretch=log&zoom=5&marker=no");
    expect(readPlayerSettings(parameters)).toEqual(DEFAULT_PLAYER_SETTINGS);
  });
});

describe("writePlayerSettings", () => {
  it("omits defaults", () => {
    expect(write(DEFAULT_PLAYER_SETTINGS)).toBe("");
  });

  it("round-trips changed settings", () => {
    const settings = {
      ...DEFAULT_PLAYER_SETTINGS,
      mode: "stack" as const,
      colorMap: "gray" as const,
      zoom: 4,
      showTrack: false,
    };
    expect(write(settings)).toBe("mode=stack&map=gray&zoom=4&track=0");
    expect(readPlayerSettings(new URLSearchParams(write(settings)))).toEqual(settings);
  });
});
