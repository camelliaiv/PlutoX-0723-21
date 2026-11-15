import { STAR_RECORD_VALUE_COUNT } from "./skyAssets";
import { equatorialToCartesian } from "./skyMath";
import {
  colourFromTemperature,
  MISSING_COLOUR_INDEX,
  temperatureFromBlueMinusVisual,
  temperatureFromGaiaColour,
} from "./starColour";

export const RENDER_VALUES_PER_STAR = 5;
export const COLOUR_BYTES_PER_STAR = 4;

const MISSING_DISTANCE = -1;
const BACKGROUND_SHELL_RADIUS = 1;
const REFERENCE_DISTANCE_PARSECS = 10;

export type StarSource = "gaia" | "hipparcos";

export interface SkyCatalogue {
  count: number;
  renderValues: Float32Array;
  colours: Uint8Array;
  records: Float32Array;
  hipparcosStart: number;
}

export interface StarDescription {
  source: StarSource;
  rightAscensionDegrees: number;
  declinationDegrees: number;
  distanceParsecs: number | null;
  magnitude: number;
  colourIndex: number | null;
}

export function buildSkyCatalogue(stars: Float32Array, brightStars: Float32Array): SkyCatalogue {
  const gaiaCount = stars.length / STAR_RECORD_VALUE_COUNT;
  const count = gaiaCount + brightStars.length / STAR_RECORD_VALUE_COUNT;
  const records = new Float32Array(count * STAR_RECORD_VALUE_COUNT);
  records.set(stars);
  records.set(brightStars, stars.length);
  const renderValues = new Float32Array(count * RENDER_VALUES_PER_STAR);
  const colours = new Uint8Array(count * COLOUR_BYTES_PER_STAR);

  for (let index = 0; index < count; index++) {
    const recordStart = index * STAR_RECORD_VALUE_COUNT;
    const rightAscension = records[recordStart] ?? 0;
    const declination = records[recordStart + 1] ?? 0;
    const distance = records[recordStart + 2] ?? MISSING_DISTANCE;
    const magnitude = records[recordStart + 3] ?? 0;
    const colourIndex = records[recordStart + 4] ?? MISSING_COLOUR_INDEX;
    const hasDistance = distance > 0;
    const position = equatorialToCartesian(
      rightAscension,
      declination,
      hasDistance ? distance : BACKGROUND_SHELL_RADIUS,
    );
    const renderStart = index * RENDER_VALUES_PER_STAR;
    renderValues.set(position, renderStart);
    renderValues[renderStart + 3] = hasDistance
      ? magnitude - 5 * Math.log10(distance / REFERENCE_DISTANCE_PARSECS)
      : magnitude;
    renderValues[renderStart + 4] = hasDistance ? 0 : 1;

    const temperature =
      index < gaiaCount
        ? temperatureFromGaiaColour(colourIndex)
        : temperatureFromBlueMinusVisual(colourIndex);
    const colour = colourFromTemperature(temperature);
    colours.set([colour[0], colour[1], colour[2], 255], index * COLOUR_BYTES_PER_STAR);
  }
  return { count, renderValues, colours, records, hipparcosStart: gaiaCount };
}

export function describeStar(catalogue: SkyCatalogue, index: number): StarDescription {
  const recordStart = index * STAR_RECORD_VALUE_COUNT;
  const distance = catalogue.records[recordStart + 2] ?? MISSING_DISTANCE;
  const colourIndex = catalogue.records[recordStart + 4] ?? MISSING_COLOUR_INDEX;
  return {
    source: index >= catalogue.hipparcosStart ? "hipparcos" : "gaia",
    rightAscensionDegrees: catalogue.records[recordStart] ?? 0,
    declinationDegrees: catalogue.records[recordStart + 1] ?? 0,
    distanceParsecs: distance > 0 ? distance : null,
    magnitude: catalogue.records[recordStart + 3] ?? 0,
    colourIndex: colourIndex < MISSING_COLOUR_INDEX ? colourIndex : null,
  };
}
