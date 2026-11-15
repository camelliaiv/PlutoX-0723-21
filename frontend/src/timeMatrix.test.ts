import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createElement } from "./dom";
import { DEFAULT_PLAYER_SETTINGS } from "./playerSettings";
import { makeFrame, makePrepared } from "./pixelScaleFixtures";
import { createTimeMatrix } from "./timeMatrix";

const first = makeFrame(1, "2025-08-15T00:00:00", "2025-10-01T00:00:00");
const second = makeFrame(2, "2026-03-11T00:00:00", "2026-05-05T00:00:00");
const preparedByDetector = new Map([
  [1, makePrepared([first, second], [])],
  [2, makePrepared([first], [])],
]);

describe("time matrix", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
      putImageData: () => undefined,
    } as never);
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("draws a button for every real frame and a placeholder for every other cell", () => {
    const container = createElement("div");
    const matrix = createTimeMatrix(container, { onSelectFrame: () => undefined });
    matrix.render(preparedByDetector, DEFAULT_PLAYER_SETTINGS, { detector: 1, frameIndex: 0 });
    expect(container.querySelectorAll(".matrix-header")).toHaveLength(6);
    expect(container.querySelectorAll(".matrix-cell")).toHaveLength(3);
    expect(container.querySelectorAll(".matrix-empty")).toHaveLength(9);
    expect(container.querySelectorAll(".matrix-row-label")).toHaveLength(2);
  });

  it("reports the clicked frame and marks the selected cell", () => {
    const container = createElement("div");
    const onSelectFrame = vi.fn();
    const matrix = createTimeMatrix(container, { onSelectFrame });
    matrix.render(preparedByDetector, DEFAULT_PLAYER_SETTINGS, { detector: 1, frameIndex: 0 });
    container
      .querySelector<HTMLElement>('.matrix-cell[data-detector="1"][data-frame-index="1"]')
      ?.click();
    expect(onSelectFrame).toHaveBeenCalledWith(1, 1);
    matrix.highlight({ detector: 1, frameIndex: 1 });
    const current = container.querySelectorAll(".matrix-cell-current");
    expect(current).toHaveLength(1);
    expect((current[0] as HTMLElement).dataset["frameIndex"]).toBe("1");
  });

  it("keeps the epoch when a detector header is chosen", () => {
    const container = createElement("div");
    const onSelectFrame = vi.fn();
    const matrix = createTimeMatrix(container, { onSelectFrame });
    matrix.render(preparedByDetector, DEFAULT_PLAYER_SETTINGS, { detector: 1, frameIndex: 0 });
    container.querySelector<HTMLElement>('.matrix-header[data-detector="2"]')?.click();
    expect(onSelectFrame).toHaveBeenCalledWith(2, 0);
  });
});
