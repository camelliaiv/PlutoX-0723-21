import { DETECTOR_BANDS } from "./detectors";
import { collectEpochNumbers } from "./exposurePoints";
import type { PreparedFrames } from "./preparedFrames";

export type MatrixCellState = "frame" | "no-frame" | "not-loaded";

export interface MatrixCell {
  detector: number;
  state: MatrixCellState;
  frameIndex: number | null;
}

export interface MatrixRow {
  epochNumber: number;
  epochRank: number;
  startDate: string;
  endDate: string;
  cells: MatrixCell[];
}

export interface MatrixLayout {
  rows: MatrixRow[];
}

function describeCell(
  detector: number,
  epochNumber: number,
  preparedByDetector: ReadonlyMap<number, PreparedFrames>,
): MatrixCell {
  const prepared = preparedByDetector.get(detector);
  if (!prepared) {
    return { detector, state: "not-loaded", frameIndex: null };
  }
  const frameIndex = prepared.response.frames.findIndex(
    (frame) => frame.epoch_number === epochNumber,
  );
  return frameIndex < 0
    ? { detector, state: "no-frame", frameIndex: null }
    : { detector, state: "frame", frameIndex };
}

function epochDateRange(
  epochNumber: number,
  preparedByDetector: ReadonlyMap<number, PreparedFrames>,
): { startDate: string; endDate: string } {
  const frames = [...preparedByDetector.values()].flatMap((prepared) =>
    prepared.response.frames.filter((frame) => frame.epoch_number === epochNumber),
  );
  const starts = frames.map((frame) => frame.start_date).sort();
  const ends = frames.map((frame) => frame.end_date).sort();
  return { startDate: starts[0] ?? "", endDate: ends[ends.length - 1] ?? "" };
}

export function buildMatrixLayout(
  preparedByDetector: ReadonlyMap<number, PreparedFrames>,
): MatrixLayout {
  const rows = collectEpochNumbers(preparedByDetector).map((epochNumber, epochRank) => ({
    epochNumber,
    epochRank,
    ...epochDateRange(epochNumber, preparedByDetector),
    cells: DETECTOR_BANDS.map((band) => describeCell(band.number, epochNumber, preparedByDetector)),
  }));
  return { rows };
}

export function frameIndexInRow(row: MatrixRow, detector: number): number | null {
  return row.cells.find((cell) => cell.detector === detector)?.frameIndex ?? null;
}
