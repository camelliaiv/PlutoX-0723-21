import { describe, expect, it } from "vitest";
import {
  buildLightCurveModel,
  buildSpectrumModel,
  describePointStyle,
  fillOpacityFor,
  plotBounds,
  SPECTRUM_PADDING,
  type ChartGeometry,
} from "./chartModels";
import type { ExposurePoint } from "./exposurePoints";
import { makeFrame } from "./pixelScaleFixtures";

const geometry: ChartGeometry = { width: 600, height: 300, padding: SPECTRUM_PADDING };

function makePoint(overrides: Partial<ExposurePoint> = {}): ExposurePoint {
  return {
    detector: 2,
    epochNumber: 1,
    epochRank: 0,
    frameIndex: 0,
    observationId: "observation",
    dataRelease: "spherex_dr1",
    modifiedJulianDate: 60900,
    wavelengthMicrometers: 1.4,
    flux: 10,
    fluxError: 1,
    saturatedFraction: 0,
    ...overrides,
  };
}

const selection = { detector: 2, frameIndex: 0 };

describe("chartModels", () => {
  it("leaves the padding around the plot area", () => {
    expect(plotBounds(geometry)).toEqual({ left: 52, right: 588, top: 22, bottom: 266 });
  });

  it("draws a saturated exposure hollow and an unsaturated one filled", () => {
    expect(fillOpacityFor(0)).toBe(1);
    expect(fillOpacityFor(1)).toBeCloseTo(0.08);
    expect(fillOpacityFor(null)).toBe(1);
  });

  it("emphasises the selected point and dims other detectors in the spectrum", () => {
    const selected = describePointStyle(makePoint(), selection, "spectrum");
    const sameDetector = describePointStyle(makePoint({ frameIndex: 1 }), selection, "spectrum");
    const otherDetector = describePointStyle(makePoint({ detector: 3 }), selection, "spectrum");
    expect(selected).toMatchObject({ isSelected: true, opacity: 1 });
    expect(sameDetector.opacity).toBeLessThan(1);
    expect(otherDetector.opacity).toBeLessThan(sameDetector.opacity);
    expect(selected.radius).toBeGreaterThan(sameDetector.radius);
  });

  it("places spectrum points by wavelength and flux and draws the current detector last", () => {
    const model = buildSpectrumModel({
      points: [
        makePoint({ detector: 2, wavelengthMicrometers: 1.4 }),
        makePoint({ detector: 5, wavelengthMicrometers: 4.1, flux: 40 }),
      ],
      epochCount: 3,
      geometry,
      isLogarithmic: false,
      selection: { detector: 5, frameIndex: 0 },
      fluxUnit: "mJy",
    });
    expect(model.plotted.map((plotted) => plotted.point.detector)).toEqual([2, 5]);
    const [first, second] = model.plotted;
    expect(second?.x).toBeGreaterThan(first?.x ?? 0);
    expect(second?.y).toBeLessThan(first?.y ?? 0);
    expect(model.bands).toHaveLength(6);
    expect(model.bands.filter((band) => band.isHighlighted)).toHaveLength(1);
    expect(model.yTitle).toBe("flux (mJy)");
    expect(model.xTicks.map((tick) => tick.label)).toEqual(["1", "2", "3", "4", "5"]);
  });

  it("counts and leaves out points that cannot sit on a logarithmic axis", () => {
    const model = buildSpectrumModel({
      points: [makePoint({ flux: -2 }), makePoint({ flux: 5 })],
      epochCount: 3,
      geometry,
      isLogarithmic: true,
      selection,
      fluxUnit: "mJy",
    });
    expect(model.plotted).toHaveLength(1);
    expect(model.hiddenPointCount).toBe(1);
  });

  it("has nothing to plot without points", () => {
    const model = buildSpectrumModel({
      points: [],
      epochCount: 0,
      geometry,
      isLogarithmic: false,
      selection,
      fluxUnit: "mJy",
    });
    expect(model.plotted).toEqual([]);
    expect(model.yTicks).toEqual([]);
  });

  it("builds a light curve with one band per epoch and points ordered in time", () => {
    const frames = [
      makeFrame(1, "2025-08-15T00:00:00", "2025-10-01T00:00:00"),
      makeFrame(2, "2026-03-11T00:00:00", "2026-05-05T00:00:00"),
    ];
    const model = buildLightCurveModel({
      points: [
        makePoint({ modifiedJulianDate: 60910 }),
        makePoint({ modifiedJulianDate: 61100, epochNumber: 2, epochRank: 1, frameIndex: 1 }),
      ],
      frames,
      epochNumbers: [1, 2],
      geometry,
      isLogarithmic: false,
      selection: { detector: 2, frameIndex: 1 },
      fluxUnit: "mJy",
    });
    expect(model.bands.map((band) => band.isHighlighted)).toEqual([false, true]);
    expect(model.xTicks.map((tick) => tick.label)).toEqual(["15 Aug 2025", "11 Mar 2026"]);
    const [early, late] = model.plotted;
    expect(late?.x).toBeGreaterThan(early?.x ?? 0);
    expect(late?.isSelected).toBe(true);
    expect(model.xTitle).toBe("date");
    expect(model.bands[0]?.right).toBeLessThan(model.bands[1]?.left ?? 0);
  });
});
