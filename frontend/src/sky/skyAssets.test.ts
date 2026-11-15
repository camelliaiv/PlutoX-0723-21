import { describe, expect, it } from "vitest";
import { loadingFraction, parseSkyManifest, parseStarRecords } from "./skyAssets";

const MANIFEST = {
  stars: { file: "stars.bin", count: 3, bright_gaia_count: 2, nearby_count: 1 },
  bright_stars: {
    file: "bright_stars.bin",
    count: 1,
    catalogue_count: 5,
    skipped_duplicate_count: 4,
  },
  milky_way: { file: "milky_way_4k.jpg", width: 4096, height: 2048 },
  credits: { milky_way: "Map credit", hipparcos: "Hipparcos credit", gaia: "Gaia credit" },
};

describe("skyAssets", () => {
  it("reads the manifest fields the sky needs", () => {
    const manifest = parseSkyManifest(MANIFEST);
    expect(manifest.stars.count).toBe(3);
    expect(manifest.brightStars.skippedDuplicateCount).toBe(4);
    expect(manifest.milkyWay.width).toBe(4096);
    expect(manifest.credits.hipparcos).toBe("Hipparcos credit");
  });

  it("rejects a manifest with a missing section or a wrong type", () => {
    expect(() => parseSkyManifest(null)).toThrow();
    expect(() => parseSkyManifest({ ...MANIFEST, stars: undefined })).toThrow();
    expect(() =>
      parseSkyManifest({ ...MANIFEST, milky_way: { file: "map.jpg", width: "4096" } }),
    ).toThrow();
  });

  it("decodes little-endian float32 records", () => {
    const content = new ArrayBuffer(2 * 5 * 4);
    const view = new DataView(content);
    const values = [10.5, -20.25, 3, 4.5, 99, 1, 2, -1, 8, 0.5];
    values.forEach((value, index) => view.setFloat32(index * 4, value, true));
    expect(Array.from(parseStarRecords(content, 2))).toEqual(values);
  });

  it("rejects a star file of the wrong size", () => {
    expect(() => parseStarRecords(new ArrayBuffer(12), 1)).toThrow();
  });

  it("reports the loaded fraction over all files", () => {
    expect(loadingFraction([])).toBe(0);
    expect(
      loadingFraction([
        { loadedBytes: 50, totalBytes: 100 },
        { loadedBytes: 100, totalBytes: 100 },
      ]),
    ).toBe(0.75);
    expect(loadingFraction([{ loadedBytes: 30, totalBytes: 0 }])).toBe(1);
  });
});
