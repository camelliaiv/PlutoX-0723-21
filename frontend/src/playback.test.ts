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
  it("converts frames per second to a delay", () => {
    expect(intervalMilliseconds(1)).toBe(1000);
    expect(intervalMilliseconds(8)).toBe(125);
  });
});

describe("keyboardActionFor", () => {
  it("maps the player keys", () => {
    expect(keyboardActionFor(" ")).toBe("toggle");
    expect(keyboardActionFor("ArrowLeft")).toBe("previous");
    expect(keyboardActionFor("ArrowRight")).toBe("next");
  });

  it("ignores other keys", () => {
    expect(keyboardActionFor("a")).toBeNull();
  });
});
