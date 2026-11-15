import { describe, expect, it } from "vitest";
import {
  buildFluxAxis,
  errorBarEnds,
  formatTick,
  linearScale,
  linearTicks,
  logarithmicScale,
  logarithmicTicks,
} from "./chartScales";

describe("chartScales", () => {
  it("maps a linear domain onto a pixel range, also upside down", () => {
    const scale = linearScale(0, 10, 100, 0);
    expect(scale(0)).toBe(100);
    expect(scale(5)).toBe(50);
    expect(scale(10)).toBe(0);
  });

  it("maps equal powers of ten to equal pixel distances", () => {
    const scale = logarithmicScale(1, 1000, 300, 0);
    expect(scale(1)).toBeCloseTo(300);
    expect(scale(10)).toBeCloseTo(200);
    expect(scale(1000)).toBeCloseTo(0);
  });

  it("chooses round linear tick values inside the domain", () => {
    expect(linearTicks(0, 100)).toEqual([0, 20, 40, 60, 80, 100]);
    expect(linearTicks(0, 1)).toEqual([0, 0.2, 0.4, 0.6, 0.8, 1]);
  });

  it("chooses one, two and five times each power of ten for a logarithmic axis", () => {
    expect(logarithmicTicks(0.8, 60)).toEqual([1, 2, 5, 10, 20, 50]);
  });

  it("writes ticks with at most three significant digits and k for thousands", () => {
    expect(formatTick(0.2)).toBe("0.2");
    expect(formatTick(12.3456)).toBe("12.3");
    expect(formatTick(2500)).toBe("2.5k");
  });

  it("builds a linear axis that includes zero and leaves headroom", () => {
    const axis = buildFluxAxis([10, 50], false, 200, 0);
    expect(axis?.toPixel(0)).toBeCloseTo(200);
    expect(axis?.toPixel(50)).toBeGreaterThan(0);
    expect(axis?.ticks[0]).toBe(0);
  });

  it("extends a linear axis below zero for negative fluxes", () => {
    const axis = buildFluxAxis([-5, 20], false, 200, 0);
    expect(axis?.toPixel(-5)).toBeCloseTo(200);
  });

  it("keeps a flat all-zero linear axis valid", () => {
    const axis = buildFluxAxis([0, 0], false, 200, 0);
    expect(axis?.ticks.length).toBeGreaterThan(0);
    expect(Number.isFinite(axis?.toPixel(0))).toBe(true);
  });

  it("ignores values that are not positive on a logarithmic axis", () => {
    const axis = buildFluxAxis([-3, 0, 10, 1000], true, 200, 0);
    expect(axis?.isLogarithmic).toBe(true);
    expect(axis?.toPixel(10)).toBeGreaterThan(axis?.toPixel(1000) ?? 0);
  });

  it("has no axis when no value can be drawn", () => {
    expect(buildFluxAxis([], false, 200, 0)).toBeNull();
    expect(buildFluxAxis([-1, 0], true, 200, 0)).toBeNull();
  });

  it("clips a logarithmic error bar at the bottom when it reaches zero or below", () => {
    const axis = buildFluxAxis([1, 100], true, 200, 0);
    expect(axis).not.toBeNull();
    if (axis) {
      const ends = errorBarEnds(2, 5, axis);
      expect(ends?.bottomPixel).toBe(200);
      expect(ends?.topPixel).toBeLessThan(axis.toPixel(2));
      expect(errorBarEnds(2, null, axis)).toBeNull();
    }
  });
});
