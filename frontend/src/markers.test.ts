import { describe, expect, it } from "vitest";
import type { Frame } from "./api";
import { predictedPositionToImagePoint, trackPoints } from "./markers";

function frameAt(column: number, row: number): Frame {
  return { predicted_position: { column, row } } as Frame;
}

describe("predictedPositionToImagePoint", () => {
  it("puts the centre pixel of an odd grid at the middle of the image", () => {
    expect(predictedPositionToImagePoint({ column: 16, row: 16 }, 33)).toEqual({
      x: 16.5,
      y: 16.5,
    });
  });

  it("puts the pixel centres of an even grid half a pixel from the middle", () => {
    expect(predictedPositionToImagePoint({ column: 15.5, row: 15.5 }, 32)).toEqual({
      x: 16,
      y: 16,
    });
  });

  it("maps row 0 to the bottom because south is at the bottom", () => {
    const point = predictedPositionToImagePoint({ column: 0, row: 0 }, 32);
    expect(point).toEqual({ x: 0.5, y: 31.5 });
  });

  it("does not mirror columns", () => {
    const left = predictedPositionToImagePoint({ column: 2, row: 5 }, 32);
    const right = predictedPositionToImagePoint({ column: 9, row: 5 }, 32);
    expect(right?.x ?? 0).toBeGreaterThan(left?.x ?? 0);
  });

  it("returns null outside one pixel beyond the grid", () => {
    expect(predictedPositionToImagePoint({ column: -1.5, row: 3 }, 32)).toBeNull();
    expect(predictedPositionToImagePoint({ column: 3, row: 33 }, 32)).toBeNull();
    expect(predictedPositionToImagePoint({ column: -1, row: 32 }, 32)).not.toBeNull();
  });

  it("returns null for values that are not finite", () => {
    expect(predictedPositionToImagePoint({ column: Number.NaN, row: 3 }, 32)).toBeNull();
    expect(predictedPositionToImagePoint({ column: 3, row: Infinity }, 32)).toBeNull();
  });
});

describe("trackPoints", () => {
  it("skips epochs without a usable position and keeps the epoch order", () => {
    const frames = [frameAt(1, 1), frameAt(Number.NaN, 1), frameAt(200, 1), frameAt(3, 3)];
    expect(trackPoints(frames, 32).map((track) => track.epochIndex)).toEqual([0, 3]);
  });
});
