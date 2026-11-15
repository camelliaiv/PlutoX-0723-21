import { STAR_RECORD_VALUE_COUNT } from "./skyAssets";
import { COLOUR_BYTES_PER_STAR, RENDER_VALUES_PER_STAR, type SkyCatalogue } from "./skyCatalogue";
import { scale, type Vector3 } from "./skyMath";

export interface FallbackStar {
  position: Vector3;
  magnitude: number;
  brightnessBoost: number;
  colour: string;
}

const FAINTEST_FALLBACK_MAGNITUDE = 6.8;
const NEARBY_DISTANCE_PARSECS = 25;
const BACKGROUND_SHELL_RADIUS = 3000;
const BACKGROUND_REFERENCE_DISTANCE = 300;
const GAIA_MAGNITUDE_LIMIT = 8.5;
const BRIGHTNESS_BOOST = 4.5;

export function buildFallbackStars(catalogue: SkyCatalogue): FallbackStar[] {
  const stars: FallbackStar[] = [];
  for (let index = 0; index < catalogue.count; index++) {
    const recordStart = index * STAR_RECORD_VALUE_COUNT;
    const renderStart = index * RENDER_VALUES_PER_STAR;
    const catalogueMagnitude = catalogue.records[recordStart + 3] ?? 0;
    const distance = catalogue.records[recordStart + 2] ?? -1;
    const isNearby = distance > 0 && distance <= NEARBY_DISTANCE_PARSECS;
    if (catalogueMagnitude > FAINTEST_FALLBACK_MAGNITUDE && !isNearby) {
      continue;
    }
    const isBackground = catalogue.renderValues[renderStart + 4] === 1;
    const position: Vector3 = [
      catalogue.renderValues[renderStart] ?? 0,
      catalogue.renderValues[renderStart + 1] ?? 0,
      catalogue.renderValues[renderStart + 2] ?? 0,
    ];
    const colourStart = index * COLOUR_BYTES_PER_STAR;
    stars.push({
      position: isBackground ? scale(position, BACKGROUND_SHELL_RADIUS) : position,
      magnitude:
        (catalogue.renderValues[renderStart + 3] ?? 0) -
        (isBackground ? 5 * Math.log10(BACKGROUND_REFERENCE_DISTANCE) : 0),
      brightnessBoost:
        catalogueMagnitude <= GAIA_MAGNITUDE_LIMIT && !isNearby ? BRIGHTNESS_BOOST : 0,
      colour: `rgb(${catalogue.colours[colourStart]}, ${catalogue.colours[colourStart + 1]}, ${catalogue.colours[colourStart + 2]})`,
    });
  }
  return stars;
}
