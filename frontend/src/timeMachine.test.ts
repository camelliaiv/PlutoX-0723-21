import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Frame, FramesResponse } from "./api";
import { createFramesCache } from "./framesCache";
import { mountPageMarkup } from "./pageFixture";
import { createTimeMachine } from "./timeMachine";
import { createEmptyView } from "./urlState";

function makeFrame(epochNumber: number, startDate: string, column: number): Frame {
  return {
    epoch_number: epochNumber,
    start_date: startDate,
    end_date: startDate,
    detector: 5,
    exposure_count: 20,
    skipped_exposure_count: 0,
    wavelength_min_micrometers: 3.9,
    wavelength_max_micrometers: 4.4,
    observation_ids: ["observation"],
    data_releases: ["spherex_dr1"],
    image: [
      [1, 2],
      [3, 4],
    ],
    variance: [
      [1, 1],
      [1, 1],
    ],
    coverage: [
      [1, 1],
      [1, 1],
    ],
    saturated_fraction: [
      [0, 0],
      [0.9, 0],
    ],
    predicted_position: { column, row: 0.5, right_ascension: 0, declination: 0 },
  };
}

const response: FramesResponse = {
  reference_position: { right_ascension: 269.45, declination: 4.69 },
  reference_date: "2025-12-01T00:00:00",
  grid: {
    size_pixels: 2,
    pixel_scale_arcseconds: 6.15,
    center: { right_ascension: 269.45, declination: 4.69 },
    orientation: "north up",
  },
  unit: "MJy/sr",
  display_range: { minimum: 0, maximum: 5 },
  citations: ["Citation text"],
  frames: [
    makeFrame(1, "2025-08-15T00:00:00", 0.2),
    makeFrame(2, "2026-03-11T00:00:00", 0.6),
    makeFrame(3, "2026-05-05T00:00:00", 1.0),
  ],
  exposures: [],
  flux_unit: "mJy",
  notes: [],
  served_from_cache: true,
  computed_at: "2026-11-15T10:20:30+00:00",
};

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe("time machine", () => {
  beforeEach(() => {
    mountPageMarkup();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify(response)))),
    );
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(
      new Proxy({}, { get: () => () => ({ addColorStop: () => undefined }) }) as never,
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("lists the challenge targets and custom coordinates in the target selector", () => {
    createTimeMachine({
      framesCache: createFramesCache(),
      onViewChange: () => undefined,
      onStateChange: () => undefined,
    });
    const labels = Array.from(document.querySelectorAll("#target-select option")).map(
      (option) => option.textContent,
    );
    expect(labels).toHaveLength(6);
    expect(labels).toContain("Barnard's Star");
  });

  it("opens a target, shows the player and reports the view", async () => {
    const onViewChange = vi.fn();
    const timeMachine = createTimeMachine({
      framesCache: createFramesCache(),
      onViewChange,
      onStateChange: () => undefined,
    });
    timeMachine.setActive(true);
    timeMachine.openTarget("barnards_star");
    await settle();

    expect(document.querySelector<HTMLElement>("#time-grid")?.hidden).toBe(false);
    expect(document.querySelector("#time-title")?.textContent).toBe("Barnard's Star");
    expect(document.querySelectorAll(".rail-head")).toHaveLength(6);
    expect(document.querySelectorAll(".filmstrip-shot")).toHaveLength(3);
    expect(document.querySelector("#saturation-notice")?.textContent).toContain("saturated");
    expect(document.querySelector("#frame-source")?.textContent).toContain("Precomputed frames");
    expect(document.querySelector("#target-facts h2")?.textContent).toBe("Barnard's Star");
    expect(onViewChange).toHaveBeenCalled();
    expect(timeMachine.currentView().targetSlug).toBe("barnards_star");
    expect(timeMachine.currentView().detector).toBe(5);
  });

  it("shows an alert when the frames cannot be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );
    const timeMachine = createTimeMachine({
      framesCache: createFramesCache(),
      onViewChange: () => undefined,
      onStateChange: () => undefined,
    });
    timeMachine.restore({ ...createEmptyView(), targetSlug: "barnards_star" });
    await settle();
    expect(document.querySelector("#frames-status")?.getAttribute("role")).toBe("alert");
    expect(document.querySelector<HTMLElement>("#time-grid")?.hidden).toBe(true);
  });
});
