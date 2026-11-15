import type { Frame, PredictedPosition } from "./api";

export const PIXEL_CENTER_OFFSET = 0.5;

export interface ImagePoint {
  x: number;
  y: number;
}

export interface TrackPoint {
  epochIndex: number;
  point: ImagePoint;
}

export function predictedPositionToImagePoint(
  position: Pick<PredictedPosition, "column" | "row">,
  sizePixels: number,
): ImagePoint | null {
  const { column, row } = position;
  if (!Number.isFinite(column) || !Number.isFinite(row)) {
    return null;
  }
  const isOutside = [column, row].some((index) => index < -1 || index > sizePixels);
  if (isOutside) {
    return null;
  }
  return {
    x: column + PIXEL_CENTER_OFFSET,
    y: sizePixels - 1 - row + PIXEL_CENTER_OFFSET,
  };
}

export function trackPoints(frames: Frame[], sizePixels: number): TrackPoint[] {
  const points: TrackPoint[] = [];
  frames.forEach((frame, epochIndex) => {
    const point = predictedPositionToImagePoint(frame.predicted_position, sizePixels);
    if (point) {
      points.push({ epochIndex, point });
    }
  });
  return points;
}
