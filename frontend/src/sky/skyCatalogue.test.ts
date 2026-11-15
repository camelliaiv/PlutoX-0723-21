import { describe, expect, it } from "vitest";
import { buildSkyCatalogue, describeStar } from "./skyCatalogue";

describe("skyCatalogue", () => {
  const gaiaStars = new Float32Array([0, 0, 10, 5, 0.8, 90, 0, -1, 3, 99]);
  const hipparcosStars = new Float32Array([180, 0, 100, 2, 0.5]);
  const catalogue = buildSkyCatalogue(gaiaStars, hipparcosStars);

  it("places stars with a distance at their true position with their absolute magnitude", () => {
    expect(catalogue.count).toBe(3);
    expect(catalogue.renderValues[0]).toBeCloseTo(10, 4);
    expect(catalogue.renderValues[3]).toBeCloseTo(5, 4);
    expect(catalogue.renderValues[4]).toBe(0);
  });

  it("puts stars without a distance on the background shell at their catalogue magnitude", () => {
    expect(catalogue.renderValues[5 + 1]).toBeCloseTo(1, 4);
    expect(catalogue.renderValues[5 + 3]).toBeCloseTo(3, 4);
    expect(catalogue.renderValues[5 + 4]).toBe(1);
  });

  it("colours stars from their colour index and shows a missing colour as white", () => {
    expect(catalogue.colours[3]).toBe(255);
    expect(Array.from(catalogue.colours.slice(4, 8))).toEqual([255, 255, 255, 255]);
  });

  it("describes a star with its source and optional values", () => {
    const gaia = describeStar(catalogue, 1);
    expect(gaia.source).toBe("gaia");
    expect(gaia.distanceParsecs).toBeNull();
    expect(gaia.colourIndex).toBeNull();
    const hipparcos = describeStar(catalogue, 2);
    expect(hipparcos.source).toBe("hipparcos");
    expect(hipparcos.distanceParsecs).toBe(100);
    expect(hipparcos.colourIndex).toBeCloseTo(0.5, 5);
  });
});
