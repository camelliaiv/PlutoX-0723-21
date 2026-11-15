import { describe, expect, it } from "vitest";
import type { Frame } from "./api";
import { buildTimeline } from "./timeline";

function frameBetween(start: string, end: string): Frame {
  return { start_date: start, end_date: end } as Frame;
}

describe("buildTimeline", () => {
  const frames = [
    frameBetween("2025-01-01T00:00:00", "2025-01-11T00:00:00"),
    frameBetween("2025-01-21T00:00:00", "2025-02-10T00:00:00"),
  ];

  it("places each epoch between the earliest start and the latest end", () => {
    const [first, second] = buildTimeline(frames);
    expect(first?.startPercent).toBe(0);
    expect(first?.widthPercent).toBeCloseTo((10 / 40) * 100, 10);
    expect(second?.startPercent).toBeCloseTo((20 / 40) * 100, 10);
    expect((second?.startPercent ?? 0) + (second?.widthPercent ?? 0)).toBeCloseTo(100, 10);
  });

  it("marks the middle of each epoch", () => {
    expect(buildTimeline(frames)[0]?.centrePercent).toBeCloseTo(12.5, 10);
  });

  it("keeps a very short epoch wide enough to click", () => {
    const shortFrames = [
      frameBetween("2025-01-01T00:00:00", "2025-01-01T00:00:00"),
      frameBetween("2026-01-01T00:00:00", "2026-01-02T00:00:00"),
    ];
    expect(buildTimeline(shortFrames)[0]?.widthPercent).toBe(1.6);
  });

  it("returns nothing without frames and places a single instant at the start", () => {
    expect(buildTimeline([])).toEqual([]);
    const single = buildTimeline([frameBetween("2025-01-01T00:00:00", "2025-01-01T00:00:00")]);
    expect(single[0]?.startPercent).toBe(0);
  });
});
