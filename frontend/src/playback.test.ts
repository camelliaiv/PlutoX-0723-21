import { describe, expect, it } from "vitest";
import { intervalMilliseconds, keyboardActionFor, stepFrameIndex } from "./playback";

describe("stepFrameIndex", () => {
  it("steps forward and backward", () => {
    expect(stepFrameIndex(1, 1, 4)).toBe(2);
    expect(stepFrameIndex(2, -1, 4)).toBe(1);
  });

  it("loops past the last and the first frame", () => {
    expect(stepFrameIndex(3, 1, 4)).toBe(0);
    expect(stepFrameIndex(0, -1, 4)).toBe(3);
  });

  it("stays at 0 without frames", () => {
    expect(stepFrameIndex(0, 1, 0)).toBe(0);
  });
});

describe("intervalMilliseconds", () => {
  it("shortens the blink delay as the speed rises", () => {
    expect(intervalMilliseconds(1)).toBe(1500);
    expect(intervalMilliseconds(0.5)).toBe(3000);
    expect(intervalMilliseconds(4)).toBe(375);
  });
});

describe("keyboardActionFor", () => {
  it("maps the transport keys", () => {
    expect(keyboardActionFor(" ")).toEqual({ kind: "toggle" });
    expect(keyboardActionFor("ArrowLeft")).toEqual({ kind: "previous" });
    expect(keyboardActionFor("ArrowRight")).toEqual({ kind: "next" });
  });

  it("maps the number keys to the display modes", () => {
    expect(keyboardActionFor("1")).toEqual({ kind: "mode", mode: "frame" });
    expect(keyboardActionFor("2")).toEqual({ kind: "mode", mode: "difference" });
    expect(keyboardActionFor("3")).toEqual({ kind: "mode", mode: "stack" });
  });

  it("maps zoom, overlay, colour map and saturation keys in either case", () => {
    expect(keyboardActionFor("+")).toEqual({ kind: "zoom", direction: 1 });
    expect(keyboardActionFor("-")).toEqual({ kind: "zoom", direction: -1 });
    expect(keyboardActionFor("t")).toEqual({ kind: "overlay", overlay: "track" });
    expect(keyboardActionFor("M")).toEqual({ kind: "overlay", overlay: "marker" });
    expect(keyboardActionFor("c")).toEqual({ kind: "colorMap" });
    expect(keyboardActionFor("S")).toEqual({ kind: "saturation" });
  });

  it("ignores other keys", () => {
    expect(keyboardActionFor("a")).toBeNull();
    expect(keyboardActionFor("Enter")).toBeNull();
  });
});
