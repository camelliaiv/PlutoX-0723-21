import { describe, expect, it } from "vitest";
import {
  colourFromTemperature,
  temperatureFromBlueMinusVisual,
  temperatureFromGaiaColour,
} from "./starColour";

describe("starColour", () => {
  it("maps Gaia colours to temperatures through the table", () => {
    expect(temperatureFromGaiaColour(0.82)).toBeCloseTo(5772, 3);
    expect(temperatureFromGaiaColour(-1)).toBe(20000);
    expect(temperatureFromGaiaColour(10)).toBeCloseTo(2800, 3);
    const between = temperatureFromGaiaColour(0.685);
    expect(between).toBeLessThan(6900);
    expect(between).toBeGreaterThan(5772);
  });

  it("has no temperature for a missing colour", () => {
    expect(temperatureFromGaiaColour(99)).toBe(0);
    expect(temperatureFromBlueMinusVisual(99)).toBe(0);
  });

  it("gives the Sun-like colour index a solar temperature", () => {
    expect(temperatureFromBlueMinusVisual(0.65)).toBeGreaterThan(5500);
    expect(temperatureFromBlueMinusVisual(0.65)).toBeLessThan(6100);
  });

  it("colours hot stars blue and cool stars orange", () => {
    const hot = colourFromTemperature(15000);
    const cool = colourFromTemperature(3200);
    expect(hot[2]).toBeGreaterThan(hot[0]);
    expect(cool[0]).toBeGreaterThan(cool[2]);
  });

  it("shows stars without a colour as white", () => {
    expect(colourFromTemperature(0)).toEqual([255, 255, 255]);
  });
});
