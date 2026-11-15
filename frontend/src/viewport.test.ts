import { describe, expect, it } from "vitest";
import {
  canvasToImage,
  centreAfterZoom,
  chooseScaleBar,
  clampCentre,
  computePlayerLayout,
  formatScaleBarLabel,
  imageToCanvas,
  nextZoom,
  parseZoom,
  pixelIndicesAt,
} from "./viewport";

describe("zoom levels", () => {
  it("parses only listed integer levels", () => {
    expect(parseZoom("4")).toBe(4);
    expect(parseZoom("5")).toBeNull();
    expect(parseZoom("2.5")).toBeNull();
    expect(parseZoom(null)).toBeNull();
  });

  it("steps through the levels and stops at both ends", () => {
    expect(nextZoom(1, 1)).toBe(2);
    expect(nextZoom(4, 1)).toBe(6);
    expect(nextZoom(8, 1)).toBe(8);
    expect(nextZoom(1, -1)).toBe(1);
    expect(nextZoom(6, -1)).toBe(4);
  });
});

describe("computePlayerLayout", () => {
  it("uses whole pixel blocks inside the ring", () => {
    const layout = computePlayerLayout(900, 1000, false, 32);
    expect(layout.ringSize).toBe(670);
    expect(layout.canvasSize % 32).toBe(0);
    expect(layout.canvasSize).toBe(384);
  });

  it("never goes below the minimum ring size or above the maximum", () => {
    expect(computePlayerLayout(100, 300, false, 32).ringSize).toBe(260);
    expect(computePlayerLayout(2000, 3000, false, 32).ringSize).toBe(760);
  });

  it("fills more of the ring on narrow screens", () => {
    const wide = computePlayerLayout(600, 1000, false, 32);
    const narrow = computePlayerLayout(600, 1000, true, 32);
    expect(narrow.canvasSize).toBeGreaterThanOrEqual(wide.canvasSize);
  });
});

describe("view transforms", () => {
  const centre = { x: 16, y: 16 };

  it("maps the image centre to the middle of the canvas", () => {
    expect(imageToCanvas(centre, centre, 320, 32, 1)).toEqual({ x: 160, y: 160 });
  });

  it("scales with the zoom", () => {
    expect(imageToCanvas({ x: 17, y: 16 }, centre, 320, 32, 4)).toEqual({ x: 200, y: 160 });
  });

  it("is reversed by canvasToImage", () => {
    const canvasPoint = imageToCanvas({ x: 20.25, y: 9.5 }, { x: 14, y: 18 }, 320, 32, 3);
    const back = canvasToImage(canvasPoint, { x: 14, y: 18 }, 320, 32, 3);
    expect(back.x).toBeCloseTo(20.25, 10);
    expect(back.y).toBeCloseTo(9.5, 10);
  });

  it("keeps the visible window inside the image", () => {
    expect(clampCentre({ x: 0, y: 40 }, 32, 2)).toEqual({ x: 8, y: 24 });
    expect(clampCentre({ x: 5, y: 5 }, 32, 1)).toEqual({ x: 16, y: 16 });
  });

  it("keeps the point under the cursor fixed while zooming", () => {
    const anchor = { x: 20, y: 12 };
    const anchorOnCanvas = { x: 220, y: 100 };
    const newCentre = centreAfterZoom(anchor, anchorOnCanvas, 320, 32, 2);
    const after = canvasToImage(anchorOnCanvas, newCentre, 320, 32, 2);
    expect(after.x).toBeCloseTo(20, 10);
    expect(after.y).toBeCloseTo(12, 10);
  });
});

describe("scale bar", () => {
  it("picks the longest length that fits in a share of the canvas", () => {
    expect(chooseScaleBar(2, 384)?.arcseconds).toBe(60);
    expect(chooseScaleBar(2, 384)?.lengthPixels).toBe(120);
  });

  it("returns null when nothing fits", () => {
    expect(chooseScaleBar(100, 384)).toBeNull();
  });

  it("labels seconds and minutes of arc", () => {
    expect(formatScaleBarLabel(30)).toBe("30″");
    expect(formatScaleBarLabel(120)).toBe("2′");
  });
});

describe("pixelIndicesAt", () => {
  it("converts image coordinates to a column and a row counted from the south", () => {
    expect(pixelIndicesAt({ x: 0.2, y: 31.9 }, 32)).toEqual({ column: 0, row: 0 });
    expect(pixelIndicesAt({ x: 5.5, y: 0.5 }, 32)).toEqual({ column: 5, row: 31 });
  });

  it("returns null outside the image", () => {
    expect(pixelIndicesAt({ x: -0.1, y: 3 }, 32)).toBeNull();
    expect(pixelIndicesAt({ x: 3, y: 32.5 }, 32)).toBeNull();
  });
});
