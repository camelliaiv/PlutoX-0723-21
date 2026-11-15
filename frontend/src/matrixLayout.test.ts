import { describe, expect, it } from "vitest";
import { buildMatrixLayout, frameIndexInRow } from "./matrixLayout";
import { makeFrame, makePrepared } from "./pixelScaleFixtures";

const first = makeFrame(1, "2025-08-15T00:00:00", "2025-10-01T00:00:00");
const second = makeFrame(2, "2026-03-11T00:00:00", "2026-05-05T00:00:00");
const secondLonger = makeFrame(2, "2026-03-10T00:00:00", "2026-05-06T00:00:00");

const preparedByDetector = new Map([
  [1, makePrepared([first, second], [])],
  [3, makePrepared([second], [])],
  [5, makePrepared([first, secondLonger], [])],
]);

describe("matrixLayout", () => {
  it("has one row per epoch and one cell per detector", () => {
    const { rows } = buildMatrixLayout(preparedByDetector);
    expect(rows.map((row) => row.epochNumber)).toEqual([1, 2]);
    expect(rows.every((row) => row.cells.length === 6)).toBe(true);
    expect(rows.map((row) => row.epochRank)).toEqual([0, 1]);
  });

  it("tells a frame from a missing epoch and from a detector that is not loaded", () => {
    const [firstRow] = buildMatrixLayout(preparedByDetector).rows;
    expect(firstRow?.cells.map((cell) => cell.state)).toEqual([
      "frame",
      "not-loaded",
      "no-frame",
      "not-loaded",
      "frame",
      "not-loaded",
    ]);
  });

  it("points each cell at the frame index inside its own detector", () => {
    const secondRow = buildMatrixLayout(preparedByDetector).rows[1];
    expect(secondRow && frameIndexInRow(secondRow, 1)).toBe(1);
    expect(secondRow && frameIndexInRow(secondRow, 3)).toBe(0);
    expect(secondRow && frameIndexInRow(secondRow, 2)).toBeNull();
  });

  it("spans the earliest start and the latest end of an epoch across detectors", () => {
    const secondRow = buildMatrixLayout(preparedByDetector).rows[1];
    expect(secondRow?.startDate).toBe("2026-03-10T00:00:00");
    expect(secondRow?.endDate).toBe("2026-05-06T00:00:00");
  });

  it("has no rows before anything is loaded", () => {
    expect(buildMatrixLayout(new Map()).rows).toEqual([]);
  });
});
