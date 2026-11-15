import type { Frame } from "./api";
import { daysBetween, utcMilliseconds } from "./dateText";

export interface PredictedMotion {
  columnShift: number;
  rowShift: number;
  pixels: number;
  arcseconds: number;
  days: number;
  arcsecondsPerYear: number;
  firstEpochNumber: number;
  lastEpochNumber: number;
}

const DAYS_PER_YEAR = 365.25;
const NEGLIGIBLE_SHIFT_PIXELS = 0.05;

function epochMiddle(frame: Frame): number {
  return (utcMilliseconds(frame.start_date) + utcMilliseconds(frame.end_date)) / 2;
}

export function describePredictedMotion(
  frames: Frame[],
  pixelScaleArcseconds: number,
): PredictedMotion | null {
  const first = frames[0];
  const last = frames[frames.length - 1];
  if (!first || !last || first === last) {
    return null;
  }
  const columnShift = last.predicted_position.column - first.predicted_position.column;
  const rowShift = last.predicted_position.row - first.predicted_position.row;
  const days = daysBetween(epochMiddle(first), epochMiddle(last));
  if (!Number.isFinite(columnShift) || !Number.isFinite(rowShift) || !(days > 0)) {
    return null;
  }
  const pixels = Math.hypot(columnShift, rowShift);
  const arcseconds = pixels * pixelScaleArcseconds;
  return {
    columnShift,
    rowShift,
    pixels,
    arcseconds,
    days,
    arcsecondsPerYear: (arcseconds / days) * DAYS_PER_YEAR,
    firstEpochNumber: first.epoch_number,
    lastEpochNumber: last.epoch_number,
  };
}

export function describeShiftDirection(columnShift: number, rowShift: number): string {
  const parts: string[] = [];
  if (Math.abs(rowShift) > NEGLIGIBLE_SHIFT_PIXELS) {
    parts.push(`${Math.abs(rowShift).toFixed(2)} px ${rowShift > 0 ? "north" : "south"}`);
  }
  if (Math.abs(columnShift) > NEGLIGIBLE_SHIFT_PIXELS) {
    parts.push(`${Math.abs(columnShift).toFixed(2)} px ${columnShift > 0 ? "west" : "east"}`);
  }
  return parts.length > 0 ? parts.join(", ") : "no shift";
}

export function formatPredictedMotion(motion: PredictedMotion): string {
  return (
    `${describeShiftDirection(motion.columnShift, motion.rowShift)}, ` +
    `${motion.pixels.toFixed(2)} px ≈ ${motion.arcseconds.toFixed(1)}″ between epoch ` +
    `${motion.firstEpochNumber} and epoch ${motion.lastEpochNumber} ` +
    `(${Math.round(motion.days)} days, ${motion.arcsecondsPerYear.toFixed(1)}″ per year).`
  );
}
