import { describe, expect, it } from "vitest";
import { buildSkyCatalogue } from "./skyCatalogue";
import { buildFallbackStars } from "./skyFallback";

describe("skyFallback", () => {
  const catalogue = buildSkyCatalogue(
    new Float32Array([
      0, 0, 100, 5, 0.8, 0, 10, 400, 7.5, 0.8, 90, 0, 5, 12, 2, 180, 0, -1, 3, 0.2,
    ]),
    new Float32Array(0),
  );
  const stars = buildFallbackStars(catalogue);

  it("keeps bright and nearby stars and drops faint distant ones", () => {
    expect(stars).toHaveLength(3);
  });

  it("moves stars without a distance to the far background shell", () => {
    const background = stars[2];
    expect(Math.hypot(...(background?.position ?? [0, 0, 0]))).toBeCloseTo(3000, 3);
    expect(background?.magnitude).toBeCloseTo(3 - 5 * Math.log10(300), 5);
  });

  it("boosts the faint end of the Gaia stars that are not nearby", () => {
    expect(stars[0]?.brightnessBoost).toBe(4.5);
    expect(stars[1]?.brightnessBoost).toBe(0);
  });
});
