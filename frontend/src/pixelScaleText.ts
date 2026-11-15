import { formatEpochDates, formatModifiedJulianDate } from "./dateText";
import { describeDetectorBand, DETECTOR_BANDS, formatWavelengthRange } from "./detectors";
import type { ExposureCollection, ExposurePoint } from "./exposurePoints";

export interface TooltipText {
  title: string;
  lines: string[];
}

export const SATURATION_CAPTION =
  "Hollow points are saturated exposures: their brightness is not reliable.";

export const LIGHT_CURVE_SPREAD_CAPTION =
  "Within one epoch each exposure samples a different wavelength, so the vertical spread " +
  "inside an epoch reflects the spectrum, not variability. Compare epochs at matching wavelengths.";

export const SPECTRUM_INTERACTION_HINT =
  "Click a point to select its detector and epoch. With the keyboard, focus the chart, use the " +
  "left and right arrow keys to move between exposures of the current detector, and press Enter to select.";

const SIGNIFICANT_DIGITS = 3;
const SATURATION_DECIMALS = 2;

export function formatFluxValue(value: number): string {
  return String(Number(value.toPrecision(SIGNIFICANT_DIGITS)));
}

function formatFluxWithError(point: ExposurePoint, fluxUnit: string): string {
  const error = point.fluxError === null ? "" : ` ± ${formatFluxValue(point.fluxError)}`;
  return `${formatFluxValue(point.flux)}${error} ${fluxUnit}`;
}

function formatSaturation(point: ExposurePoint): string {
  return point.saturatedFraction === null
    ? "saturation not reported"
    : `saturated fraction ${point.saturatedFraction.toFixed(SATURATION_DECIMALS)}`;
}

export function describePoint(point: ExposurePoint, fluxUnit: string): string {
  return (
    `D${point.detector}, epoch ${point.epochNumber}, ` +
    `${formatModifiedJulianDate(point.modifiedJulianDate)}, ` +
    `${point.wavelengthMicrometers.toFixed(3)} µm, flux ${formatFluxWithError(point, fluxUnit)}, ` +
    formatSaturation(point)
  );
}

export function describeTooltip(point: ExposurePoint, fluxUnit: string): TooltipText {
  return {
    title: `D${point.detector} · epoch ${point.epochNumber}`,
    lines: [
      point.observationId,
      `${formatModifiedJulianDate(point.modifiedJulianDate)} · ${point.wavelengthMicrometers.toFixed(3)} µm`,
      formatFluxWithError(point, fluxUnit),
      `${formatSaturation(point)} · ${point.dataRelease}`,
    ],
  };
}

export function describeExposureTotals(collection: ExposureCollection): string {
  const shown = `${collection.points.length} exposures shown`;
  return collection.skippedExposureCount === 0
    ? shown
    : `${shown}, ${collection.skippedExposureCount} skipped because they have no flux value`;
}

export function describeSpectrumCaption(
  collection: ExposureCollection,
  hiddenPointCount: number,
): string {
  const logarithmicNote =
    hiddenPointCount === 0
      ? ""
      : ` ${hiddenPointCount} points with zero or negative flux cannot be drawn on a logarithmic axis.`;
  return (
    `Flux in ${collection.fluxUnit}. Each point is one real exposure; bars show the flux error. ` +
    `${describeExposureTotals(collection)}.${logarithmicNote} ${SATURATION_CAPTION}`
  );
}

export function describeLightCurveCaption(fluxUnit: string, hiddenPointCount: number): string {
  const logarithmicNote =
    hiddenPointCount === 0
      ? ""
      : ` ${hiddenPointCount} points with zero or negative flux cannot be drawn on a logarithmic axis.`;
  return `Flux in ${fluxUnit}, one point per exposure.${logarithmicNote} ${LIGHT_CURVE_SPREAD_CAPTION} ${SATURATION_CAPTION}`;
}

function describeRange(values: number[], format: (value: number) => string): string {
  return `${format(Math.min(...values))} to ${format(Math.max(...values))}`;
}

export function describeSpectrumSummary(collection: ExposureCollection): string {
  const { points, fluxUnit } = collection;
  if (points.length === 0) {
    return "Spectrum chart: no exposure with a flux value is available.";
  }
  const detectors = new Set(points.map((point) => point.detector)).size;
  return (
    `Spectrum chart of ${points.length} exposures from ${detectors} detectors, wavelength ` +
    `${describeRange(
      points.map((point) => point.wavelengthMicrometers),
      (value) => value.toFixed(2),
    )} µm, flux ${describeRange(
      points.map((point) => point.flux),
      formatFluxValue,
    )} ${fluxUnit}. ${SPECTRUM_INTERACTION_HINT}`
  );
}

export function describeLightCurveSummary(
  detector: number,
  points: readonly ExposurePoint[],
  fluxUnit: string,
): string {
  const band = DETECTOR_BANDS.find((candidate) => candidate.number === detector);
  const bandText = band ? describeDetectorBand(band) : `D${detector}`;
  if (points.length === 0) {
    return `Light curve for ${bandText}: no exposure with a flux value is available.`;
  }
  return (
    `Light curve for ${bandText} with ${points.length} exposures, dates ` +
    `${describeRange(
      points.map((point) => point.modifiedJulianDate),
      formatModifiedJulianDate,
    )}, flux ${describeRange(
      points.map((point) => point.flux),
      formatFluxValue,
    )} ${fluxUnit}. ${SPECTRUM_INTERACTION_HINT}`
  );
}

export function describeMatrixCell(
  detector: number,
  epochNumber: number,
  startDate: string,
  endDate: string,
): string {
  return `D${detector}, epoch ${epochNumber}, ${formatEpochDates(startDate, endDate)}`;
}

export interface SelectionDescription {
  detector: number;
  epochNumber: number;
  epochCount: number;
  startDate: string;
  endDate: string;
  minimumMicrometers: number;
  maximumMicrometers: number;
}

export function describeSelection(selection: SelectionDescription): string {
  return (
    `Selected: D${selection.detector} · epoch ${selection.epochNumber} of ${selection.epochCount} · ` +
    `${formatEpochDates(selection.startDate, selection.endDate)} · ` +
    formatWavelengthRange(selection.minimumMicrometers, selection.maximumMicrometers)
  );
}
