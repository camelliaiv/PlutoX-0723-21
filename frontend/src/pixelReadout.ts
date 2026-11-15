import type { Frame } from "./api";
import { isFiniteNumber, type DisplayMode, type ModeImages } from "./frameModes";

export const EMPTY_PIXEL_READOUT = "Hover a pixel to inspect it.";

function formatValue(value: number | null | undefined): string {
  return isFiniteNumber(value) ? value.toFixed(2) : "no data";
}

export function describePixelReadout(
  frame: Frame,
  epochIndex: number,
  mode: DisplayMode,
  modeImages: ModeImages,
  position: { column: number; row: number },
  unit: string,
): string {
  const { column, row } = position;
  const valueByMode = {
    frame: frame.image[row]?.[column],
    stack: modeImages.stack[row]?.[column],
    difference: modeImages.differences[epochIndex]?.[row]?.[column],
  };
  return [
    `pixel (${column}, ${row})`,
    `${formatValue(valueByMode[mode])} ${unit}`,
    `variance ${formatValue(frame.variance[row]?.[column])}`,
    `coverage ${frame.coverage[row]?.[column] ?? 0}`,
    `saturated ${formatValue(frame.saturated_fraction[row]?.[column])}`,
  ].join(" · ");
}
