import { describe, expect, it } from "vitest";
import type { ExposureCollection, ExposurePoint } from "./exposurePoints";
import {
  describeExposureTotals,
  describeLightCurveCaption,
  describeLightCurveSummary,
  describeMatrixCell,
  describePoint,
  describeSelection,
  describeSpectrumCaption,
  describeSpectrumSummary,
  describeTooltip,
  formatFluxValue,
} from "./pixelScaleText";

const point: ExposurePoint = {
  detector: 3,
  epochNumber: 2,
  epochRank: 1,
  frameIndex: 1,
  observationId: "observation 7",
  dataRelease: "spherex_dr1",
  modifiedJulianDate: 60902.5,
  wavelengthMicrometers: 1.9123,
  flux: 12.3456,
  fluxError: 0.4321,
  saturatedFraction: 0.5,
};

const collection: ExposureCollection = {
  points: [point],
  epochNumbers: [1, 2],
  totalExposureCount: 3,
  skippedExposureCount: 2,
  fluxUnit: "mJy",
};

describe("pixelScaleText", () => {
  it("rounds a flux to three significant digits", () => {
    expect(formatFluxValue(12.3456)).toBe("12.3");
    expect(formatFluxValue(0.012345)).toBe("0.0123");
  });

  it("describes a point with the unit exactly as given", () => {
    expect(describePoint(point, "mJy")).toBe(
      "D3, epoch 2, 2025-08-15, 1.912 µm, flux 12.3 ± 0.432 mJy, saturated fraction 0.50",
    );
  });

  it("says so when the error or saturation is not reported", () => {
    const text = describePoint({ ...point, fluxError: null, saturatedFraction: null }, "mJy");
    expect(text).toContain("flux 12.3 mJy");
    expect(text).toContain("saturation not reported");
  });

  it("builds a tooltip with the observation, date, flux and release", () => {
    const tooltip = describeTooltip(point, "mJy");
    expect(tooltip.title).toBe("D3 · epoch 2");
    expect(tooltip.lines).toContain("observation 7");
    expect(tooltip.lines.at(-1)).toContain("spherex_dr1");
  });

  it("reports skipped exposures instead of hiding them", () => {
    expect(describeExposureTotals(collection)).toContain("2 skipped");
    expect(describeExposureTotals({ ...collection, skippedExposureCount: 0 })).toBe(
      "1 exposures shown",
    );
  });

  it("explains saturation and the logarithmic limitation in the spectrum caption", () => {
    const caption = describeSpectrumCaption(collection, 4);
    expect(caption).toContain("Flux in mJy");
    expect(caption).toContain("Hollow points");
    expect(caption).toContain("4 points with zero or negative flux");
  });

  it("states that the spread inside an epoch is not variability in the light curve caption", () => {
    const caption = describeLightCurveCaption("mJy", 0);
    expect(caption).toContain("not variability");
    expect(caption).toContain("not reliable");
  });

  it("summarises each chart for assistive technology", () => {
    expect(describeSpectrumSummary(collection)).toContain("1 exposures from 1 detectors");
    expect(describeSpectrumSummary({ ...collection, points: [] })).toContain("no exposure");
    expect(describeLightCurveSummary(3, [point], "mJy")).toContain("D3 (1.63–2.41 µm)");
    expect(describeLightCurveSummary(3, [], "mJy")).toContain("no exposure");
  });

  it("describes a matrix cell and the current selection", () => {
    expect(describeMatrixCell(2, 1, "2025-08-15T00:00:00", "2025-10-01T00:00:00")).toBe(
      "D2, epoch 1, 15 Aug – 1 Oct 2025",
    );
    expect(
      describeSelection({
        detector: 5,
        epochNumber: 2,
        epochCount: 3,
        startDate: "2026-03-11T00:00:00",
        endDate: "2026-05-05T00:00:00",
        minimumMicrometers: 3.83,
        maximumMicrometers: 4.41,
      }),
    ).toBe("Selected: D5 · epoch 2 of 3 · 11 Mar – 5 May 2026 · 3.83–4.41 µm");
  });
});
