import { DETECTOR_BANDS } from "./detectors";
import { isFiniteNumber } from "./frameModes";
import type { PreparedFrames } from "./preparedFrames";

export interface ExposurePoint {
  detector: number;
  epochNumber: number;
  epochRank: number;
  frameIndex: number;
  observationId: string;
  dataRelease: string;
  modifiedJulianDate: number;
  wavelengthMicrometers: number;
  flux: number;
  fluxError: number | null;
  saturatedFraction: number | null;
}

export interface ExposureCollection {
  points: ExposurePoint[];
  epochNumbers: number[];
  totalExposureCount: number;
  skippedExposureCount: number;
  fluxUnit: string;
}

export function collectEpochNumbers(
  preparedByDetector: ReadonlyMap<number, PreparedFrames>,
): number[] {
  const epochNumbers = new Set<number>();
  for (const prepared of preparedByDetector.values()) {
    for (const frame of prepared.response.frames) {
      epochNumbers.add(frame.epoch_number);
    }
  }
  return [...epochNumbers].sort((first, second) => first - second);
}

export function collectExposurePoints(
  preparedByDetector: ReadonlyMap<number, PreparedFrames>,
): ExposureCollection {
  const epochNumbers = collectEpochNumbers(preparedByDetector);
  const points: ExposurePoint[] = [];
  let totalExposureCount = 0;
  let fluxUnit = "";
  for (const band of DETECTOR_BANDS) {
    const response = preparedByDetector.get(band.number)?.response;
    if (!response) {
      continue;
    }
    fluxUnit ||= response.flux_unit;
    for (const exposure of response.exposures) {
      totalExposureCount += 1;
      const frameIndex = response.frames.findIndex(
        (frame) => frame.epoch_number === exposure.epoch_number,
      );
      if (
        frameIndex < 0 ||
        !isFiniteNumber(exposure.flux_millijansky) ||
        !isFiniteNumber(exposure.wavelength_micrometers) ||
        !isFiniteNumber(exposure.modified_julian_date)
      ) {
        continue;
      }
      points.push({
        detector: band.number,
        epochNumber: exposure.epoch_number,
        epochRank: epochNumbers.indexOf(exposure.epoch_number),
        frameIndex,
        observationId: exposure.observation_id,
        dataRelease: exposure.data_release,
        modifiedJulianDate: exposure.modified_julian_date,
        wavelengthMicrometers: exposure.wavelength_micrometers,
        flux: exposure.flux_millijansky,
        fluxError: isFiniteNumber(exposure.flux_error_millijansky)
          ? exposure.flux_error_millijansky
          : null,
        saturatedFraction: isFiniteNumber(exposure.saturated_fraction)
          ? exposure.saturated_fraction
          : null,
      });
    }
  }
  return {
    points,
    epochNumbers,
    totalExposureCount,
    skippedExposureCount: totalExposureCount - points.length,
    fluxUnit,
  };
}

export function pointsOfDetector(
  points: readonly ExposurePoint[],
  detector: number,
): ExposurePoint[] {
  return points.filter((point) => point.detector === detector);
}

export function sortByWavelength(points: readonly ExposurePoint[]): ExposurePoint[] {
  return [...points].sort(
    (first, second) => first.wavelengthMicrometers - second.wavelengthMicrometers,
  );
}

export function sortByDate(points: readonly ExposurePoint[]): ExposurePoint[] {
  return [...points].sort(
    (first, second) =>
      first.modifiedJulianDate - second.modifiedJulianDate ||
      first.wavelengthMicrometers - second.wavelengthMicrometers,
  );
}
