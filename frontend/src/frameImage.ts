import type { DisplayRange, Frame } from "./api";

export type RedGreenBlueAlpha = readonly [number, number, number, number];

export const ASINH_SOFTNESS = 10;
export const MISSING_PIXEL_COLOR: RedGreenBlueAlpha = [38, 24, 58, 255];
export const SATURATION_TINT_COLOR: readonly [number, number, number] = [255, 48, 48];
export const SATURATION_TINT_OPACITY = 0.5;

const MAXIMUM_GRAY_LEVEL = 255;
const DISPLAY_SIZE_PIXELS = 384;

export function stretchIntensity(value: number | null, range: DisplayRange): number | null {
  if (value === null) {
    return null;
  }
  const span = range.maximum - range.minimum;
  if (span <= 0) {
    return 0;
  }
  const normalized = Math.min(1, Math.max(0, (value - range.minimum) / span));
  return Math.asinh(normalized * ASINH_SOFTNESS) / Math.asinh(ASINH_SOFTNESS);
}

export function orientNorthUp<Value>(rowsFromSouth: Value[][]): Value[][] {
  return [...rowsFromSouth].reverse();
}

export function integerScaleFor(sizePixels: number): number {
  return Math.max(1, Math.floor(DISPLAY_SIZE_PIXELS / sizePixels));
}

export function scaleBarLengthPixels(
  arcseconds: number,
  pixelScaleArcseconds: number,
  integerScale: number,
): number {
  return Math.round((arcseconds / pixelScaleArcseconds) * integerScale);
}

function blendTint(grayLevel: number, tintChannel: number): number {
  return Math.round(
    grayLevel * (1 - SATURATION_TINT_OPACITY) + tintChannel * SATURATION_TINT_OPACITY,
  );
}

function colorOfPixel(
  intensity: number | null,
  saturatedFraction: number,
  showSaturation: boolean,
): RedGreenBlueAlpha {
  if (intensity === null) {
    return MISSING_PIXEL_COLOR;
  }
  const grayLevel = Math.round(intensity * MAXIMUM_GRAY_LEVEL);
  if (!showSaturation || saturatedFraction <= 0) {
    return [grayLevel, grayLevel, grayLevel, MAXIMUM_GRAY_LEVEL];
  }
  const [red, green, blue] = SATURATION_TINT_COLOR;
  return [
    blendTint(grayLevel, red),
    blendTint(grayLevel, green),
    blendTint(grayLevel, blue),
    MAXIMUM_GRAY_LEVEL,
  ];
}

export function buildFramePixels(
  frame: Frame,
  range: DisplayRange | null,
  showSaturation: boolean,
): Uint8ClampedArray<ArrayBuffer> {
  const imageRows = orientNorthUp(frame.image);
  const saturationRows = orientNorthUp(frame.saturated_fraction);
  const pixels = new Uint8ClampedArray(imageRows.length * (imageRows[0]?.length ?? 0) * 4);
  let offset = 0;
  imageRows.forEach((imageRow, rowIndex) => {
    imageRow.forEach((value, columnIndex) => {
      const intensity = range === null ? null : stretchIntensity(value, range);
      const saturatedFraction = saturationRows[rowIndex]?.[columnIndex] ?? 0;
      pixels.set(colorOfPixel(intensity, saturatedFraction, showSaturation), offset);
      offset += 4;
    });
  });
  return pixels;
}
