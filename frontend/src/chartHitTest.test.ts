import { describe, expect, it } from "vitest";
import { findNearestPosition, stepIndex } from "./chartHitTest";

const positions = [
  { x: 10, y: 10 },
  { x: 30, y: 10 },
  { x: 32, y: 10 },
];

describe("chartHitTest", () => {
  it("finds the nearest position within the distance", () => {
    expect(findNearestPosition(positions, { x: 12, y: 12 }, 8)).toBe(0);
    expect(findNearestPosition(positions, { x: 29, y: 10 }, 8)).toBe(1);
  });

  it("returns nothing when every position is too far away", () => {
    expect(findNearestPosition(positions, { x: 100, y: 100 }, 8)).toBeNull();
    expect(findNearestPosition([], { x: 0, y: 0 }, 8)).toBeNull();
  });

  it("prefers the position drawn last when two are equally near", () => {
    expect(findNearestPosition(positions, { x: 31, y: 10 }, 8)).toBe(2);
  });

  it("steps through items without leaving the list", () => {
    expect(stepIndex(null, 1, 5)).toBe(0);
    expect(stepIndex(null, -1, 5)).toBe(4);
    expect(stepIndex(2, 1, 5)).toBe(3);
    expect(stepIndex(4, 1, 5)).toBe(4);
    expect(stepIndex(0, -1, 5)).toBe(0);
    expect(stepIndex(0, 1, 0)).toBe(0);
  });
});
