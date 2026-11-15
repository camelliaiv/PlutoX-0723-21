import { describe, expect, it } from "vitest";
import { buildNotices, type NoticeContext } from "./playerNotices";

const base: NoticeContext = {
  targetNotice: undefined,
  responseNotes: [],
  mode: "frame",
  showMarker: false,
  isPredictedPositionOutside: false,
};

describe("buildNotices", () => {
  it("has no notices for a plain frame without a marker", () => {
    expect(buildNotices(base)).toEqual([]);
  });

  it("puts the target notice and the response notes first", () => {
    const notices = buildNotices({ ...base, targetNotice: "Target", responseNotes: ["Note"] });
    expect(notices).toEqual(["Target", "Note"]);
  });

  it("explains difference and stack modes", () => {
    expect(buildNotices({ ...base, mode: "difference" })[0]).toContain("minus the first epoch");
    expect(buildNotices({ ...base, mode: "stack" })[0]).toContain("weighted by their noise");
  });

  it("explains the marker, and says when it is outside the field", () => {
    const inside = buildNotices({ ...base, showMarker: true });
    expect(inside).toHaveLength(1);
    expect(inside[0]).toContain("not a measurement");
    const outside = buildNotices({ ...base, showMarker: true, isPredictedPositionOutside: true });
    expect(outside[1]).toBe("Predicted position is outside this field.");
  });
});
