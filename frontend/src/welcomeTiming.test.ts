import { describe, expect, it } from "vitest";
import {
  WELCOME_ANIMATED_MILLISECONDS,
  WELCOME_REDUCED_MOTION_MILLISECONDS,
  isWelcomeDismissKey,
  welcomeDisplayMilliseconds,
} from "./welcomeTiming";

describe("welcomeTiming", () => {
  it("shows the welcome for a shorter time under reduced motion", () => {
    expect(welcomeDisplayMilliseconds(false)).toBe(WELCOME_ANIMATED_MILLISECONDS);
    expect(welcomeDisplayMilliseconds(true)).toBe(WELCOME_REDUCED_MOTION_MILLISECONDS);
    expect(WELCOME_REDUCED_MOTION_MILLISECONDS).toBeLessThan(WELCOME_ANIMATED_MILLISECONDS);
  });

  it("dismisses on Enter and Escape only", () => {
    expect(isWelcomeDismissKey("Enter")).toBe(true);
    expect(isWelcomeDismissKey("Escape")).toBe(true);
    expect(isWelcomeDismissKey("a")).toBe(false);
    expect(isWelcomeDismissKey("ArrowRight")).toBe(false);
  });
});
