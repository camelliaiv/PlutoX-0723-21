import { describe, expect, it } from "vitest";
import {
  dot,
  easeInOutCubic,
  equatorialToCartesian,
  equatorialToGalacticRows,
  formatScaleLabel,
  matrixRowsToColumnMajor,
  niceScaleLength,
  shortestAngleDelta,
  vectorLength,
} from "./skyMath";

function galacticCoordinates(rightAscensionDegrees: number, declinationDegrees: number) {
  const direction = equatorialToCartesian(rightAscensionDegrees, declinationDegrees, 1);
  const [xAxis, yAxis, zAxis] = equatorialToGalacticRows();
  const x = dot(xAxis, direction);
  const y = dot(yAxis, direction);
  const z = dot(zAxis, direction);
  return {
    longitude: ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360,
    latitude: (Math.asin(z) * 180) / Math.PI,
  };
}

describe("skyMath", () => {
  it("converts equatorial coordinates to a vector of the given length", () => {
    const vector = equatorialToCartesian(90, 0, 5);
    expect(vector[0]).toBeCloseTo(0, 10);
    expect(vector[1]).toBeCloseTo(5, 10);
    expect(vector[2]).toBeCloseTo(0, 10);
    expect(vectorLength(equatorialToCartesian(123.4, -56.7, 3))).toBeCloseTo(3, 10);
  });

  it("puts the galactic centre at longitude 0 and latitude 0", () => {
    const centre = galacticCoordinates(266.405, -28.936);
    expect(Math.min(centre.longitude, 360 - centre.longitude)).toBeLessThan(0.05);
    expect(Math.abs(centre.latitude)).toBeLessThan(0.05);
  });

  it("puts the north celestial pole at galactic latitude 27.13 degrees", () => {
    expect(galacticCoordinates(0, 90).latitude).toBeCloseTo(27.1283, 3);
  });

  it("stores the rotation column by column", () => {
    const rows = equatorialToGalacticRows();
    const columnMajor = matrixRowsToColumnMajor(rows);
    expect(columnMajor.slice(0, 3)).toEqual([rows[0][0], rows[1][0], rows[2][0]]);
  });

  it("eases from 0 to 1", () => {
    expect(easeInOutCubic(0)).toBe(0);
    expect(easeInOutCubic(1)).toBe(1);
    expect(easeInOutCubic(0.5)).toBe(0.5);
  });

  it("takes the shortest way round an angle", () => {
    expect(shortestAngleDelta(0.1, 0.3)).toBeCloseTo(0.2, 10);
    expect(shortestAngleDelta(0.1, Math.PI * 2 - 0.1)).toBeCloseTo(-0.2, 10);
  });

  it("chooses a round scale length that fits", () => {
    expect(niceScaleLength(7)).toBe(5);
    expect(niceScaleLength(2.5)).toBe(2);
    expect(niceScaleLength(130)).toBe(100);
    expect(niceScaleLength(0.3)).toBeCloseTo(0.2, 10);
  });
});

describe("formatScaleLabel", () => {
  it("shows parsecs and light years with sensible precision", () => {
    expect(formatScaleLabel(10)).toBe("10 pc · 33 ly");
    expect(formatScaleLabel(1)).toBe("1 pc · 3.3 ly");
    expect(formatScaleLabel(0.2)).toBe("0.2 pc · 0.65 ly");
  });
});
