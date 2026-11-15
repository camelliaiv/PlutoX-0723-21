import { describe, expect, it } from "vitest";
import { CHALLENGE_TARGETS } from "../presets";
import { computeCameraBasis, projectToScreen } from "./skyCamera";
import { vectorLength } from "./skyMath";
import {
  cameraForTarget,
  DIRECTION_ONLY_DISTANCE_TEXT,
  findSkyTarget,
  formatDistance,
  SKY_TARGETS,
} from "./skyTargets";

describe("skyTargets", () => {
  it("has one sky target for each challenge target", () => {
    expect(SKY_TARGETS.map((target) => target.slug).sort()).toEqual(
      CHALLENGE_TARGETS.map((target) => target.slug).sort(),
    );
  });

  it("takes distances from Gaia DR3", () => {
    expect(findSkyTarget("barnards_star")?.distanceParsecs).toBeCloseTo(1.828, 3);
    expect(findSkyTarget("epsilon_indi_b")?.distanceParsecs).toBeCloseTo(3.638, 3);
    expect(findSkyTarget("rw_aurigae")?.distanceParsecs).toBeCloseTo(156.1, 1);
    expect(findSkyTarget("r_draconis")?.distanceParsecs).toBeCloseTo(799.4, 1);
  });

  it("shows only the direction of the target that is not in Gaia DR3", () => {
    const target = findSkyTarget("wise_0855_0714");
    expect(target?.distanceParsecs).toBeNull();
    expect(vectorLength(target?.position ?? [0, 0, 0])).toBeCloseTo(8, 6);
    expect(formatDistance(null, 2, 1)).toBe(DIRECTION_ONLY_DISTANCE_TEXT);
  });

  it("formats distances in parsecs and light years", () => {
    expect(formatDistance(1.8282, 2, 1)).toBe("1.83 pc · 6.0 ly");
    expect(formatDistance(1.8282, 3, 2)).toBe("1.828 pc · 5.96 ly");
  });

  it("flies to a camera that has the target in the middle of the screen", () => {
    const target = findSkyTarget("barnards_star");
    expect(target).not.toBeNull();
    if (target) {
      const camera = cameraForTarget(target);
      const screen = projectToScreen(computeCameraBasis(camera, { x: 0, y: 0 }), target.position, {
        width: 800,
        height: 600,
      });
      expect(screen.x).toBeCloseTo(400, 5);
      expect(camera.distance).toBe(1.4);
    }
  });

  it("returns nothing for an unknown slug", () => {
    expect(findSkyTarget("pluto")).toBeNull();
  });
});
