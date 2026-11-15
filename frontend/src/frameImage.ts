import type { Frame } from "./api";
import {
  mapIntensityToColor,
  mapSignedToColor,
  MISSING_PIXEL_COLOR,
  type ColorMapName,
  type RedGreenBlueAlpha,
} from "./colorMaps";
import { isFiniteNumber, type DisplayMode, type ModeImages, type PixelGrid } from "./frameModes";

export type StretchName = "asinh" | "linear";

export interface RenderRequest {
  mode: DisplayMode;
  colorMap: ColorMapName;
  stretch: StretchName;
  showSaturation: boolean;
  epochIndex: number;
  displayRange: { minimum: number; maximum: number } | null;
}

export const ASINH_SOFTNESS = 10;
export const SATURATION_TINT_COLOR: readonly [number, number, number] = [255, 48, 48];
export const SATURATION_TINT_OPACITY = 0.5;

const MAXIMUM_CHANNEL = 255;

export function stretchIntensity(
  value: number | null,
  range: { minimum: number; maximum: number },
  stretch: StretchName = "asinh",
): number | null {
  if (!isFiniteNumber(value)) {
    return null;
  }
  const span = range.maximum - range.minimum;
  if (span <= 0) {
    return 0;
  }
  const normalized = Math.min(1, Math.max(0, (value - range.minimum) / span));
  return stretch === "linear"
    ? normalized
    : Math.asinh(normalized * ASINH_SOFTNESS) / Math.asinh(ASINH_SOFTNESS);
}

export function orientNorthUp<Value>(rowsFromSouth: Value[][]): Value[][] {
  return [...rowsFromSouth].reverse();
}

function blendTint(channel: number, tintChannel: number): number {
  return Math.round(
    channel * (1 - SATURATION_TINT_OPACITY) + tintChannel * SATURATION_TINT_OPACITY,
  );
}

export function applySaturationTint(color: RedGreenBlueAlpha): RedGreenBlueAlpha {
  const [red, green, blue] = SATURATION_TINT_COLOR;
  return [
    blendTint(color[0], red),
    blendTint(color[1], green),
    blendTint(color[2], blue),
    MAXIMUM_CHANNEL,
  ];
}

function colorOfPixel(
  value: number | null,
  saturatedFraction: number,
  request: RenderRequest,
  range: { minimum: number; maximum: number } | null,
  differenceLimit: number,
): RedGreenBlueAlpha {
  if (!isFiniteNumber(value)) {
    return MISSING_PIXEL_COLOR;
  }
  if (request.mode === "difference") {
    return mapSignedToColor(value / differenceLimit);
  }
  const intensity = range === null ? null : stretchIntensity(value, range, request.stretch);
  if (intensity === null) {
    return MISSING_PIXEL_COLOR;
  }
  const color = mapIntensityToColor(intensity, request.colorMap);
  return request.showSaturation && saturatedFraction > 0 ? applySaturationTint(color) : color;
}

export function selectModeGrids(
  frames: Frame[],
  modeImages: ModeImages,
  request: RenderRequest,
): { image: PixelGrid; saturation: PixelGrid; range: RenderRequest["displayRange"] } | null {
  const frame = frames[request.epochIndex];
  if (!frame) {
    return null;
  }
  switch (request.mode) {
    case "stack":
      return {
        image: modeImages.stack,
        saturation: modeImages.stackSaturation,
        range: modeImages.stackRange,
      };
    case "difference":
      return {
        image: modeImages.differences[request.epochIndex] ?? [],
        saturation: frame.saturated_fraction,
        range: null,
      };
    default:
      return {
        image: frame.image,
        saturation: frame.saturated_fraction,
        range: request.displayRange,
      };
  }
}

export function buildFramePixels(
  frames: Frame[],
  modeImages: ModeImages,
  request: RenderRequest,
): Uint8ClampedArray<ArrayBuffer> {
  const grids = selectModeGrids(frames, modeImages, request);
  if (!grids) {
    return new Uint8ClampedArray(0);
  }
  const imageRows = orientNorthUp(grids.image);
  const saturationRows = orientNorthUp(grids.saturation);
  const pixels = new Uint8ClampedArray(imageRows.length * (imageRows[0]?.length ?? 0) * 4);
  let offset = 0;
  imageRows.forEach((imageRow, rowIndex) => {
    imageRow.forEach((value, columnIndex) => {
      const saturatedFraction = saturationRows[rowIndex]?.[columnIndex] ?? 0;
      pixels.set(
        colorOfPixel(value, saturatedFraction, request, grids.range, modeImages.differenceLimit),
        offset,
      );
      offset += 4;
    });
  });
  return pixels;
}
