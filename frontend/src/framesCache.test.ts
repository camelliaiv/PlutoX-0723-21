import { afterEach, describe, expect, it, vi } from "vitest";
import type { FramesResponse } from "./api";
import { createFramesCache, fetchMissingDetectors } from "./framesCache";
import { prepareFrames } from "./preparedFrames";

function makeResponse(detector: number): FramesResponse {
  return {
    reference_position: { right_ascension: 1, declination: 2 },
    reference_date: "2025-12-01T00:00:00",
    grid: {
      size_pixels: 1,
      pixel_scale_arcseconds: 6.15,
      center: { right_ascension: 1, declination: 2 },
      orientation: "north up",
    },
    unit: "MJy/sr",
    display_range: null,
    citations: [],
    frames: [],
    exposures: [],
    flux_unit: `unit ${detector}`,
    notes: [],
    served_from_cache: true,
    computed_at: "2026-11-15T10:20:30+00:00",
  };
}

const noCoordinates = { rightAscension: "", declination: "" };

describe("frames cache", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("keeps stored detectors and tells subscribers", () => {
    const cache = createFramesCache();
    const listener = vi.fn();
    cache.subscribe(listener);
    cache.store(3, prepareFrames(makeResponse(3)));
    expect(cache.get(3)?.response.flux_unit).toBe("unit 3");
    expect(cache.all().size).toBe(1);
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("empties itself and aborts the previous signal when the subject changes", () => {
    const cache = createFramesCache();
    cache.switchSubject("first");
    cache.store(1, prepareFrames(makeResponse(1)));
    const firstSignal = cache.signal();
    cache.switchSubject("first");
    expect(cache.all().size).toBe(1);
    cache.switchSubject("second");
    expect(cache.all().size).toBe(0);
    expect(firstSignal.aborted).toBe(true);
    expect(cache.signal().aborted).toBe(false);
  });

  it("fetches only the detectors that are neither stored nor pending", async () => {
    const requestedUrls: string[] = [];
    vi.stubGlobal(
      "fetch",
      vi.fn((url: string) => {
        requestedUrls.push(url);
        return Promise.resolve(new Response(JSON.stringify(makeResponse(1))));
      }),
    );
    const cache = createFramesCache();
    cache.store(2, prepareFrames(makeResponse(2)));
    fetchMissingDetectors(cache, { targetSlug: "barnards_star", coordinates: noCoordinates });
    fetchMissingDetectors(cache, { targetSlug: "barnards_star", coordinates: noCoordinates });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(requestedUrls).toHaveLength(5);
    expect(requestedUrls.some((url) => url.includes("detector=2"))).toBe(false);
    expect(cache.all().size).toBe(6);
  });

  it("leaves a detector empty when its request fails", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );
    const cache = createFramesCache();
    fetchMissingDetectors(cache, { targetSlug: "barnards_star", coordinates: noCoordinates });
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(cache.all().size).toBe(0);
    expect(cache.isPending(1)).toBe(false);
  });
});
