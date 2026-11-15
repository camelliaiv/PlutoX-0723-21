import type { Frame } from "./api";
import { utcMilliseconds } from "./dateText";

export interface TimelineSegment {
  epochIndex: number;
  startPercent: number;
  widthPercent: number;
  centrePercent: number;
}

const MINIMUM_WIDTH_PERCENT = 1.6;
const FULL_SPAN_PERCENT = 100;

export function buildTimeline(frames: Frame[]): TimelineSegment[] {
  if (frames.length === 0) {
    return [];
  }
  const starts = frames.map((frame) => utcMilliseconds(frame.start_date));
  const ends = frames.map((frame) => utcMilliseconds(frame.end_date));
  const earliest = Math.min(...starts);
  const span = Math.max(...ends) - earliest;
  const toPercent = (milliseconds: number): number =>
    span > 0 ? ((milliseconds - earliest) / span) * FULL_SPAN_PERCENT : 0;
  return frames.map((_, epochIndex) => {
    const start = toPercent(starts[epochIndex] ?? earliest);
    const end = toPercent(ends[epochIndex] ?? earliest);
    return {
      epochIndex,
      startPercent: start,
      widthPercent: Math.max(end - start, MINIMUM_WIDTH_PERCENT),
      centrePercent: (start + end) / 2,
    };
  });
}
