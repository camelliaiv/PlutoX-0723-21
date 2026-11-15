export type RedGreenBlueAlpha = readonly [number, number, number, number];
export type ColorMapName = "inferno" | "gray";
export type GradientName = ColorMapName | "difference";

export type RedGreenBlue = readonly [number, number, number];
export type ColorStop = readonly [position: number, color: RedGreenBlue];

export const MISSING_PIXEL_COLOR: RedGreenBlueAlpha = [58, 74, 82, 255];

const LOOKUP_TABLE_SIZE = 256;
const OPAQUE = 255;

const INFERNO_STOPS: readonly ColorStop[] = [
  [0, [0, 0, 4]],
  [0.125, [22, 11, 57]],
  [0.25, [66, 10, 104]],
  [0.375, [106, 23, 110]],
  [0.5, [147, 38, 103]],
  [0.625, [221, 81, 58]],
  [0.75, [243, 120, 25]],
  [0.875, [252, 165, 10]],
  [1, [252, 255, 164]],
];

const GRAY_STOPS: readonly ColorStop[] = [
  [0, [0, 0, 0]],
  [1, [255, 255, 255]],
];

const DIVERGING_STOPS: readonly ColorStop[] = [
  [0, [47, 123, 255]],
  [0.25, [21, 54, 111]],
  [0.5, [20, 22, 31]],
  [0.75, [138, 74, 18]],
  [1, [255, 179, 71]],
];

export function interpolateStops(stops: readonly ColorStop[], position: number): RedGreenBlue {
  for (let index = 1; index < stops.length; index += 1) {
    const upper = stops[index];
    const lower = stops[index - 1];
    if (upper && lower && position <= upper[0]) {
      const fraction = (position - lower[0]) / (upper[0] - lower[0]);
      return [
        Math.round(lower[1][0] + (upper[1][0] - lower[1][0]) * fraction),
        Math.round(lower[1][1] + (upper[1][1] - lower[1][1]) * fraction),
        Math.round(lower[1][2] + (upper[1][2] - lower[1][2]) * fraction),
      ];
    }
  }
  return stops[stops.length - 1]?.[1] ?? [0, 0, 0];
}

function buildLookupTable(stops: readonly ColorStop[]): RedGreenBlue[] {
  return Array.from({ length: LOOKUP_TABLE_SIZE }, (_, index) =>
    interpolateStops(stops, index / (LOOKUP_TABLE_SIZE - 1)),
  );
}

const LOOKUP_TABLES: Record<GradientName, RedGreenBlue[]> = {
  inferno: buildLookupTable(INFERNO_STOPS),
  gray: buildLookupTable(GRAY_STOPS),
  difference: buildLookupTable(DIVERGING_STOPS),
};

function lookUp(gradient: GradientName, position: number): RedGreenBlueAlpha {
  const clamped = Math.min(1, Math.max(0, position));
  const index = Math.round(clamped * (LOOKUP_TABLE_SIZE - 1));
  const [red, green, blue] = LOOKUP_TABLES[gradient][index] ?? [0, 0, 0];
  return [red, green, blue, OPAQUE];
}

export function mapIntensityToColor(intensity: number, colorMap: ColorMapName): RedGreenBlueAlpha {
  return lookUp(colorMap, intensity);
}

export function mapSignedToColor(signed: number): RedGreenBlueAlpha {
  return lookUp("difference", (signed + 1) / 2);
}

export function sampleGradient(gradient: GradientName, sampleCount: number): RedGreenBlueAlpha[] {
  return Array.from({ length: sampleCount }, (_, index) =>
    lookUp(gradient, sampleCount === 1 ? 0 : index / (sampleCount - 1)),
  );
}
