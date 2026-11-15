import { describe, expect, it } from "vitest";
import { CHALLENGE_ITEMS } from "./challengeItems";
import { countByStatus, describeChallengeSummary } from "./challengeText";
import { findChallengeTarget } from "./presets";

describe("challenge items", () => {
  it("has unique identifiers", () => {
    const identifiers = CHALLENGE_ITEMS.map((item) => item.identifier);
    expect(new Set(identifiers).size).toBe(identifiers.length);
  });

  it("states what is missing for every item that is not fully implemented", () => {
    for (const item of CHALLENGE_ITEMS) {
      expect(item.missing === null).toBe(item.status === "implemented");
    }
  });

  it("gives every implemented or partial item an action and label", () => {
    for (const item of CHALLENGE_ITEMS) {
      const hasAction = item.status !== "notIncluded";
      expect(item.action !== null).toBe(hasAction);
      expect(item.actionLabel !== null).toBe(hasAction);
    }
  });

  it("points actions only at known targets", () => {
    for (const item of CHALLENGE_ITEMS) {
      if (item.action && "targetSlug" in item.action) {
        expect(findChallengeTarget(item.action.targetSlug)).not.toBeNull();
      }
    }
  });

  it("reports the field of view and Aladin honestly", () => {
    const byIdentifier = (identifier: string) =>
      CHALLENGE_ITEMS.find((item) => item.identifier === identifier);
    expect(byIdentifier("field-of-view")?.status).toBe("partial");
    expect(byIdentifier("aladin")?.status).toBe("notIncluded");
    expect(byIdentifier("other-telescope-overlays")?.status).toBe("partial");
  });

  it("summarises the counts", () => {
    const counts = countByStatus(CHALLENGE_ITEMS);
    expect(counts.implemented + counts.partial + counts.notIncluded).toBe(CHALLENGE_ITEMS.length);
    expect(describeChallengeSummary(CHALLENGE_ITEMS)).toContain(`${CHALLENGE_ITEMS.length} items`);
  });
});
