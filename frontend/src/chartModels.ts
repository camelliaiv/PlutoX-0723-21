import type { Frame } from "./api";
import { CHART_HIGHLIGHT_COLOR, CHART_NEUTRAL_BAND_COLOR } from "./canvasColors";
import { buildFluxAxis, errorBarEnds, formatTick, linearScale, type FluxAxis } from "./chartScales";
import { formatShortDateWithYear, toModifiedJulianDate } from "./dateText";
import { DETECTOR_BANDS } from "./detectors";
import { epochColor } from "./epochRings";
import type { ExposurePoint } from "./exposurePoints";

export type ChartKind = "spectrum" | "lightCurve";

export interface ChartPadding {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface ChartGeometry {
  width: number;
  height: number;
  padding: ChartPadding;
}

export interface PlotBounds {
  left: number;
  right: number;
  top: number;
  bottom: number;
}

export interface ChartSelection {
  detector: number;
  frameIndex: number;
}

export interface PlottedPoint {
  point: ExposurePoint;
  x: number;
  y: number;
  errorTop: number | null;
  errorBottom: number | null;
  color: string;
  opacity: number;
  radius: number;
  fillOpacity: number;
  isSelected: boolean;
}

export interface ChartBand {
  left: number;
  right: number;
  label: string | null;
  color: string;
  opacity: number;
  isHighlighted: boolean;
}

export interface ChartTick {
  position: number;
  label: string;
}

export interface ChartModel {
  geometry: ChartGeometry;
  bounds: PlotBounds;
  bands: ChartBand[];
  xTicks: ChartTick[];
  yTicks: ChartTick[];
  xTitle: string;
  yTitle: string;
  plotted: PlottedPoint[];
  hiddenPointCount: number;
  isLogarithmic: boolean;
}

export interface SpectrumModelInput {
  points: readonly ExposurePoint[];
  epochCount: number;
  geometry: ChartGeometry;
  isLogarithmic: boolean;
  selection: ChartSelection;
  fluxUnit: string;
}

export interface LightCurveModelInput {
  points: readonly ExposurePoint[];
  frames: readonly Frame[];
  epochNumbers: readonly number[];
  geometry: ChartGeometry;
  isLogarithmic: boolean;
  selection: ChartSelection;
  fluxUnit: string;
}

export const SPECTRUM_HEIGHT = 300;
export const LIGHT_CURVE_HEIGHT = 240;
export const SPECTRUM_PADDING: ChartPadding = { left: 52, right: 30, top: 22, bottom: 34 };
export const LIGHT_CURVE_PADDING: ChartPadding = { left: 52, right: 30, top: 14, bottom: 34 };
export const MINIMUM_CHART_WIDTH = 280;

const SPECTRUM_WAVELENGTH_START = 0.7;
const SPECTRUM_WAVELENGTH_END = 5.05;
const WAVELENGTH_TICKS = [1, 2, 3, 4, 5];
const DETECTOR_EDGE_MARGIN = 0.01;
const LIGHT_CURVE_DATE_MARGIN_DAYS = 12;
const MINIMUM_BAND_WIDTH = 2;
const OTHER_DETECTOR_OPACITY = 0.4;
const CURRENT_DETECTOR_OPACITY = 0.8;
const OTHER_EPOCH_LIGHT_CURVE_OPACITY = 0.7;
const MINIMUM_FILL_OPACITY = 0.08;
const SPECTRUM_RADII = { selected: 4.2, regular: 3 };
const LIGHT_CURVE_RADII = { selected: 3.8, regular: 2.8 };
const SELECTED_BAND_OPACITY = 0.14;
const REGULAR_BAND_OPACITY = 0.05;
const HIGHLIGHTED_DETECTOR_BAND_OPACITY = 0.1;
const SHADED_DETECTOR_BAND_OPACITY = 0.025;

export function plotBounds(geometry: ChartGeometry): PlotBounds {
  const { width, height, padding } = geometry;
  return {
    left: padding.left,
    right: width - padding.right,
    top: padding.top,
    bottom: height - padding.bottom,
  };
}

export function fillOpacityFor(saturatedFraction: number | null): number {
  const clamped = Math.min(1, Math.max(0, saturatedFraction ?? 0));
  return MINIMUM_FILL_OPACITY + (1 - MINIMUM_FILL_OPACITY) * (1 - clamped);
}

function pointOpacity(isSelected: boolean, isCurrentDetector: boolean, kind: ChartKind): number {
  if (isSelected) {
    return 1;
  }
  if (kind === "lightCurve") {
    return OTHER_EPOCH_LIGHT_CURVE_OPACITY;
  }
  return isCurrentDetector ? CURRENT_DETECTOR_OPACITY : OTHER_DETECTOR_OPACITY;
}

export function describePointStyle(
  point: ExposurePoint,
  selection: ChartSelection,
  kind: ChartKind,
): Pick<PlottedPoint, "opacity" | "radius" | "fillOpacity" | "isSelected"> {
  const isCurrentDetector = point.detector === selection.detector;
  const isSelected = isCurrentDetector && point.frameIndex === selection.frameIndex;
  const radii = kind === "spectrum" ? SPECTRUM_RADII : LIGHT_CURVE_RADII;
  return {
    opacity: pointOpacity(isSelected, isCurrentDetector, kind),
    radius: isSelected ? radii.selected : radii.regular,
    fillOpacity: fillOpacityFor(point.saturatedFraction),
    isSelected,
  };
}

function plotPoints(
  points: readonly ExposurePoint[],
  axis: FluxAxis | null,
  toX: (point: ExposurePoint) => number,
  epochCount: number,
  selection: ChartSelection,
  kind: ChartKind,
): PlottedPoint[] {
  if (!axis) {
    return [];
  }
  return points
    .filter((point) => !axis.isLogarithmic || point.flux > 0)
    .map((point) => {
      const ends = errorBarEnds(point.flux, point.fluxError, axis);
      return {
        point,
        x: toX(point),
        y: axis.toPixel(point.flux),
        errorTop: ends?.topPixel ?? null,
        errorBottom: ends?.bottomPixel ?? null,
        color: epochColor(point.epochRank, epochCount),
        ...describePointStyle(point, selection, kind),
      };
    });
}

function buildYTicks(axis: FluxAxis | null): ChartTick[] {
  if (!axis) {
    return [];
  }
  return axis.ticks.map((tick) => ({ position: axis.toPixel(tick), label: formatTick(tick) }));
}

function countHiddenPoints(points: readonly ExposurePoint[], isLogarithmic: boolean): number {
  return isLogarithmic ? points.filter((point) => point.flux <= 0).length : 0;
}

function detectorBandOpacity(detector: number, isHighlighted: boolean): number {
  if (isHighlighted) {
    return HIGHLIGHTED_DETECTOR_BAND_OPACITY;
  }
  return detector % 2 === 1 ? SHADED_DETECTOR_BAND_OPACITY : 0;
}

export function buildSpectrumModel(input: SpectrumModelInput): ChartModel {
  const { geometry, points, selection } = input;
  const bounds = plotBounds(geometry);
  const toX = linearScale(
    SPECTRUM_WAVELENGTH_START,
    SPECTRUM_WAVELENGTH_END,
    bounds.left,
    bounds.right,
  );
  const axis = buildFluxAxis(
    points.map((point) => point.flux),
    input.isLogarithmic,
    bounds.bottom,
    bounds.top,
  );
  const orderedPoints = [
    ...points.filter((point) => point.detector !== selection.detector),
    ...points.filter((point) => point.detector === selection.detector),
  ];
  const bands = DETECTOR_BANDS.map((band) => {
    const isHighlighted = band.number === selection.detector;
    return {
      left: toX(band.minimumMicrometers - DETECTOR_EDGE_MARGIN),
      right: toX(band.maximumMicrometers + DETECTOR_EDGE_MARGIN),
      label: `D${band.number}`,
      color: isHighlighted ? CHART_HIGHLIGHT_COLOR : CHART_NEUTRAL_BAND_COLOR,
      opacity: detectorBandOpacity(band.number, isHighlighted),
      isHighlighted,
    };
  });
  return {
    geometry,
    bounds,
    bands,
    xTicks: WAVELENGTH_TICKS.map((wavelength) => ({
      position: toX(wavelength),
      label: String(wavelength),
    })),
    yTicks: buildYTicks(axis),
    xTitle: "wavelength (µm)",
    yTitle: `flux (${input.fluxUnit})`,
    plotted: plotPoints(
      orderedPoints,
      axis,
      (point) => toX(point.wavelengthMicrometers),
      input.epochCount,
      selection,
      "spectrum",
    ),
    hiddenPointCount: countHiddenPoints(points, input.isLogarithmic),
    isLogarithmic: input.isLogarithmic,
  };
}

export function buildLightCurveModel(input: LightCurveModelInput): ChartModel {
  const { geometry, points, frames, selection } = input;
  const bounds = plotBounds(geometry);
  const allDates = [
    ...frames.flatMap((frame) => [
      toModifiedJulianDate(frame.start_date),
      toModifiedJulianDate(frame.end_date),
    ]),
    ...points.map((point) => point.modifiedJulianDate),
  ];
  const toX = linearScale(
    Math.min(...allDates) - LIGHT_CURVE_DATE_MARGIN_DAYS,
    Math.max(...allDates) + LIGHT_CURVE_DATE_MARGIN_DAYS,
    bounds.left,
    bounds.right,
  );
  const axis = buildFluxAxis(
    points.map((point) => point.flux),
    input.isLogarithmic,
    bounds.bottom,
    bounds.top,
  );
  const epochCount = input.epochNumbers.length;
  const bands = frames.map((frame, frameIndex) => {
    const left = toX(toModifiedJulianDate(frame.start_date));
    const right = toX(toModifiedJulianDate(frame.end_date));
    const isHighlighted = frameIndex === selection.frameIndex;
    return {
      left,
      right: Math.max(right, left + MINIMUM_BAND_WIDTH),
      label: null,
      color: epochColor(input.epochNumbers.indexOf(frame.epoch_number), epochCount),
      opacity: isHighlighted ? SELECTED_BAND_OPACITY : REGULAR_BAND_OPACITY,
      isHighlighted,
    };
  });
  return {
    geometry,
    bounds,
    bands,
    xTicks: frames.map((frame, index) => {
      const band = bands[index];
      return {
        position: band ? (band.left + band.right) / 2 : 0,
        label: formatShortDateWithYear(frame.start_date),
      };
    }),
    yTicks: buildYTicks(axis),
    xTitle: "date",
    yTitle: `flux (${input.fluxUnit})`,
    plotted: plotPoints(
      points,
      axis,
      (point) => toX(point.modifiedJulianDate),
      epochCount,
      selection,
      "lightCurve",
    ),
    hiddenPointCount: countHiddenPoints(points, input.isLogarithmic),
    isLogarithmic: input.isLogarithmic,
  };
}
