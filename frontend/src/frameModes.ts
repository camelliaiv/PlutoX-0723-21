import type { Frame } from "./api";

export type PixelGrid = (number | null)[][];
export type DisplayMode = "frame" | "difference" | "stack";

export interface ValueRange {
  minimum: number;
  maximum: number;
}

export interface ModeImages {
  stack: PixelGrid;
  stackSaturation: PixelGrid;
  stackRange: ValueRange;
  differences: PixelGrid[];
  differenceLimit: number;
}

const SEQUENTIAL_LOWER_PERCENTILE = 0.5;
const UPPER_PERCENTILE = 99.5;

export function isFiniteNumber(value: number | null | undefined): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function percentile(values: number[], percentage: number): number {
  if (values.length === 0) {
    return 0;
  }
  const sorted = [...values].sort((first, second) => first - second);
  const position = (percentage / 100) * (sorted.length - 1);
  const lowerIndex = Math.floor(position);
  const lower = sorted[lowerIndex] ?? 0;
  const upper = sorted[Math.ceil(position)] ?? lower;
  return lower + (upper - lower) * (position - lowerIndex);
}

export function buildDifferenceImage(image: PixelGrid, referenceImage: PixelGrid): PixelGrid {
  const hasSameSize =
    image.length === referenceImage.length &&
    image.every((row, index) => row.length === referenceImage[index]?.length);
  if (!hasSameSize) {
    throw new Error("Frames have different sizes.");
  }
  return image.map((row, rowIndex) =>
    row.map((value, columnIndex) => {
      const reference = referenceImage[rowIndex]?.[columnIndex];
      return isFiniteNumber(value) && isFiniteNumber(reference) ? value - reference : null;
    }),
  );
}

export function buildStackImage(frames: Frame[]): PixelGrid {
  const firstImage = frames[0]?.image ?? [];
  return firstImage.map((row, rowIndex) =>
    row.map((_, columnIndex) => {
      let weightSum = 0;
      let weightedValueSum = 0;
      for (const frame of frames) {
        const value = frame.image[rowIndex]?.[columnIndex];
        const variance = frame.variance[rowIndex]?.[columnIndex];
        if (isFiniteNumber(value) && isFiniteNumber(variance) && variance > 0) {
          weightSum += 1 / variance;
          weightedValueSum += value / variance;
        }
      }
      return weightSum > 0 ? weightedValueSum / weightSum : null;
    }),
  );
}

export function buildStackSaturation(frames: Frame[]): PixelGrid {
  const firstImage = frames[0]?.image ?? [];
  return firstImage.map((row, rowIndex) =>
    row.map((_, columnIndex) =>
      Math.max(0, ...frames.map((frame) => frame.saturated_fraction[rowIndex]?.[columnIndex] ?? 0)),
    ),
  );
}

export function symmetricRange(differenceImages: PixelGrid[]): number {
  const magnitudes = differenceImages.flatMap((image) =>
    image.flatMap((row) => row.filter(isFiniteNumber).map(Math.abs)),
  );
  const limit = percentile(magnitudes, UPPER_PERCENTILE);
  return limit > 0 ? limit : 1;
}

export function sequentialRange(image: PixelGrid): ValueRange {
  const values = image.flatMap((row) => row.filter(isFiniteNumber));
  const minimum = percentile(values, SEQUENTIAL_LOWER_PERCENTILE);
  const maximum = percentile(values, UPPER_PERCENTILE);
  return maximum > minimum ? { minimum, maximum } : { minimum, maximum: minimum + 1 };
}

export function buildModeImages(frames: Frame[]): ModeImages {
  const stack = buildStackImage(frames);
  const firstImage = frames[0]?.image ?? [];
  const differences = frames.map((frame) => buildDifferenceImage(frame.image, firstImage));
  return {
    stack,
    stackSaturation: buildStackSaturation(frames),
    stackRange: sequentialRange(stack),
    differences,
    differenceLimit: symmetricRange(differences.slice(1)),
  };
}
