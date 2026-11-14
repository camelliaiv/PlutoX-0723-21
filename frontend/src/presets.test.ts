import { describe, expect, it } from "vitest";
import { CHALLENGE_TARGETS, defaultDetectorFor, findChallengeTarget } from "./presets";

describe("presets", () => {
  it("chooses the default detector of each challenge target", () => {
    expect(defaultDetectorFor("barnards_star")).toBe(5);
    expect(defaultDetectorFor("rw_aurigae")).toBe(1);
    expect(defaultDetectorFor("r_draconis")).toBe(5);
    expect(defaultDetectorFor("wise_0855_0714")).toBe(5);
    expect(defaultDetectorFor("epsilon_indi_b")).toBe(3);
  });

  it("chooses detector 1 for free coordinates and unknown targets", () => {
    expect(defaultDetectorFor(null)).toBe(1);
    expect(defaultDetectorFor("unknown_target")).toBe(1);
  });

  it("finds a challenge target by slug", () => {
    expect(findChallengeTarget("rw_aurigae")?.name).toBe("RW Aurigae");
    expect(findChallengeTarget("unknown_target")).toBeNull();
  });

  it("gives every target a unique slug", () => {
    const slugs = CHALLENGE_TARGETS.map((challengeTarget) => challengeTarget.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });
});
