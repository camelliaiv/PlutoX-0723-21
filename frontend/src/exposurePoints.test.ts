import { describe, expect, it } from "vitest";
import {
  collectEpochNumbers,
  collectExposurePoints,
  pointsOfDetector,
  sortByDate,
  sortByWavelength,
} from "./exposurePoints";
import { makeExposure, makeFrame, makePrepared } from "./pixelScaleFixtures";

const firstFrame = makeFrame(1, "2025-08-15T00:00:00", "2025-10-01T00:00:00");
const secondFrame = makeFrame(2, "2026-03-11T00:00:00", "2026-05-05T00:00:00");

const preparedByDetector = new Map([
  [
    2,
    makePrepared(
      [firstFrame, secondFrame],
      [
        makeExposure({ epoch_number: 1, wavelength_micrometers: 1.4, modified_julian_date: 60910 }),
        makeExposure({ epoch_number: 2, wavelength_micrometers: 1.2, modified_julian_date: 61100 }),
        makeExposure({ epoch_number: 2, flux_millijansky: null }),
        makeExposure({ epoch_number: 2, wavelength_micrometers: Number.NaN }),
        makeExposure({ epoch_number: 9 }),
      ],
      "mJy",
    ),
  ],
  [
    1,
    makePrepared(
      [secondFrame],
      [makeExposure({ epoch_number: 2, flux_error_millijansky: null, saturated_fraction: null })],
      "mJy",
    ),
  ],
]);

describe("exposurePoints", () => {
  it("lists every epoch number of every loaded detector once, in order", () => {
    expect(collectEpochNumbers(preparedByDetector)).toEqual([1, 2]);
  });

  it("keeps only exposures with usable values and counts the rest as skipped", () => {
    const collection = collectExposurePoints(preparedByDetector);
    expect(collection.points).toHaveLength(3);
    expect(collection.totalExposureCount).toBe(6);
    expect(collection.skippedExposureCount).toBe(3);
    expect(collection.fluxUnit).toBe("mJy");
  });

  it("orders points by detector and maps each to its frame and epoch rank", () => {
    const { points } = collectExposurePoints(preparedByDetector);
    expect(points.map((point) => point.detector)).toEqual([1, 2, 2]);
    expect(points[0]).toMatchObject({ frameIndex: 0, epochRank: 1, epochNumber: 2 });
    expect(points[1]).toMatchObject({ frameIndex: 0, epochRank: 0 });
    expect(points[2]).toMatchObject({ frameIndex: 1, epochRank: 1 });
  });

  it("leaves a missing error or saturated fraction empty instead of inventing a value", () => {
    const [point] = collectExposurePoints(preparedByDetector).points;
    expect(point?.fluxError).toBeNull();
    expect(point?.saturatedFraction).toBeNull();
  });

  it("filters and sorts points", () => {
    const { points } = collectExposurePoints(preparedByDetector);
    const ofDetectorTwo = pointsOfDetector(points, 2);
    expect(ofDetectorTwo).toHaveLength(2);
    expect(sortByWavelength(ofDetectorTwo).map((point) => point.wavelengthMicrometers)).toEqual([
      1.2, 1.4,
    ]);
    expect(sortByDate(ofDetectorTwo).map((point) => point.modifiedJulianDate)).toEqual([
      60910, 61100,
    ]);
  });

  it("returns an empty collection when nothing is loaded", () => {
    expect(collectExposurePoints(new Map())).toEqual({
      points: [],
      epochNumbers: [],
      totalExposureCount: 0,
      skippedExposureCount: 0,
      fluxUnit: "",
    });
  });
});
