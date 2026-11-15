import { clamp } from "./skyMath";

export type ColourBytes = readonly [number, number, number];

export const MISSING_COLOUR_INDEX = 99;

const COLOUR_INDEX_IS_MISSING_FROM = 98;
const COLOUR_SATURATION = 0.62;
const MINIMUM_TEMPERATURE_KELVIN = 1000;
const MAXIMUM_TEMPERATURE_KELVIN = 40000;
const WHITE: ColourBytes = [255, 255, 255];

const GAIA_COLOUR_TEMPERATURES: readonly (readonly [number, number])[] = [
  [-0.4, 20000],
  [-0.2, 12500],
  [0, 9700],
  [0.3, 8000],
  [0.55, 6900],
  [0.82, 5772],
  [1, 5200],
  [1.4, 4500],
  [1.85, 3850],
  [2.4, 3500],
  [3, 3200],
  [4, 2800],
];

export function temperatureFromGaiaColour(blueMinusRed: number): number {
  if (!(blueMinusRed < COLOUR_INDEX_IS_MISSING_FROM)) {
    return 0;
  }
  const [firstColour, firstTemperature] = GAIA_COLOUR_TEMPERATURES[0] ?? [0, 0];
  if (blueMinusRed <= firstColour) {
    return firstTemperature;
  }
  for (let index = 0; index < GAIA_COLOUR_TEMPERATURES.length - 1; index++) {
    const lower = GAIA_COLOUR_TEMPERATURES[index];
    const upper = GAIA_COLOUR_TEMPERATURES[index + 1];
    if (lower && upper && blueMinusRed <= upper[0]) {
      const fraction = (blueMinusRed - lower[0]) / (upper[0] - lower[0]);
      return Math.exp(Math.log(lower[1]) + (Math.log(upper[1]) - Math.log(lower[1])) * fraction);
    }
  }
  return GAIA_COLOUR_TEMPERATURES[GAIA_COLOUR_TEMPERATURES.length - 1]?.[1] ?? 0;
}

export function temperatureFromBlueMinusVisual(blueMinusVisual: number): number {
  if (!(blueMinusVisual < COLOUR_INDEX_IS_MISSING_FROM)) {
    return 0;
  }
  const colour = clamp(blueMinusVisual, -0.4, 2.2);
  return 4600 * (1 / (0.92 * colour + 1.7) + 1 / (0.92 * colour + 0.62));
}

function blackbodyColour(temperatureKelvin: number): [number, number, number] {
  const scaled =
    clamp(temperatureKelvin, MINIMUM_TEMPERATURE_KELVIN, MAXIMUM_TEMPERATURE_KELVIN) / 100;
  const red = scaled <= 66 ? 255 : 329.698727446 * (scaled - 60) ** -0.1332047592;
  const green =
    scaled <= 66
      ? 99.4708025861 * Math.log(scaled) - 161.1195681661
      : 288.1221695283 * (scaled - 60) ** -0.0755148492;
  let blue = 255;
  if (scaled < 66) {
    blue = scaled <= 19 ? 0 : 138.5177312231 * Math.log(scaled - 10) - 305.0447927307;
  }
  return [clamp(red, 0, 255) / 255, clamp(green, 0, 255) / 255, clamp(blue, 0, 255) / 255];
}

export function colourFromTemperature(temperatureKelvin: number): ColourBytes {
  if (temperatureKelvin <= 0) {
    return WHITE;
  }
  const colour = blackbodyColour(temperatureKelvin);
  const brightest = Math.max(...colour);
  const toByte = (channel: number): number =>
    Math.round(
      255 * clamp(1 - COLOUR_SATURATION + (COLOUR_SATURATION * channel) / brightest, 0, 1),
    );
  return [toByte(colour[0]), toByte(colour[1]), toByte(colour[2])];
}
