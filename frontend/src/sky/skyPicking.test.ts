import { describe, expect, it } from "vitest";
import { computeCameraBasis, projectToScreen } from "./skyCamera";
import { buildSkyCatalogue } from "./skyCatalogue";
import {
  describeStarTooltip,
  describeTargetTooltip,
  findStarNear,
  findTargetAt,
} from "./skyPicking";
import { findSkyTarget, SKY_TARGETS } from "./skyTargets";

const VIEWPORT = { width: 800, height: 600 };
const NO_LOOK = { x: 0, y: 0 };

describe("skyPicking", () => {
  it("picks the nearest visible target within the pick radius", () => {
    const positions = new Map([
      ["barnards_star", { x: 100, y: 100, visible: true }],
      ["rw_aurigae", { x: 110, y: 100, visible: true }],
      ["r_draconis", { x: 101, y: 100, visible: false }],
    ]);
    expect(findTargetAt(positions, SKY_TARGETS, 108, 100)?.slug).toBe("rw_aurigae");
    expect(findTargetAt(positions, SKY_TARGETS, 300, 300)).toBeNull();
  });

  it("finds the star under the pointer and ignores stars far from it", () => {
    const camera = { focus: [0, 0, 0] as const, yaw: 0, pitch: 0, distance: 10 };
    const basis = computeCameraBasis(camera, NO_LOOK);
    const catalogue = buildSkyCatalogue(
      new Float32Array([0, 0, 2, 3, 0.8, 0, 45, 2, 3, 0.8]),
      new Float32Array(0),
    );
    const star = projectToScreen(
      basis,
      [
        catalogue.renderValues[0] ?? 0,
        catalogue.renderValues[1] ?? 0,
        catalogue.renderValues[2] ?? 0,
      ],
      VIEWPORT,
    );
    expect(star.depth).toBeGreaterThan(0);
    expect(findStarNear(catalogue, basis, VIEWPORT, star.x + 3, star.y - 2)).toBe(0);
    expect(findStarNear(catalogue, basis, VIEWPORT, star.x + 200, star.y)).toBeNull();
  });

  it("describes Gaia and Hipparcos stars with their own catalogue", () => {
    const catalogue = buildSkyCatalogue(
      new Float32Array([10, 20, 5, 4.5, 0.8]),
      new Float32Array([200, -30, -1, 1.5, 99]),
    );
    const gaia = describeStarTooltip(catalogue, 0);
    expect(gaia.title).toBe("Gaia DR3 star");
    expect(gaia.lines[0]).toBe("5.00 pc · 16.3 ly");
    expect(gaia.lines[1]).toBe("G 4.50 · BP-RP 0.80");
    const hipparcos = describeStarTooltip(catalogue, 1);
    expect(hipparcos.title).toBe("Hipparcos star");
    expect(hipparcos.lines[0]).toBe("no reliable distance in Hipparcos");
    expect(hipparcos.lines[1]).toBe("Hp 1.50 · B-V n/a");
    expect(hipparcos.lines[2]).toContain("(J1991.25)");
  });

  it("describes a target with its distance and the way to fly there", () => {
    const barnard = findSkyTarget("barnards_star");
    const wise = findSkyTarget("wise_0855_0714");
    expect(barnard && describeTargetTooltip(barnard).lines[0]).toBe("1.83 pc · 6.0 ly");
    expect(wise && describeTargetTooltip(wise).lines[0]).toBe("distance not in Gaia DR3");
    expect(barnard && describeTargetTooltip(barnard).note).toBe("Click to fly there");
  });
});
