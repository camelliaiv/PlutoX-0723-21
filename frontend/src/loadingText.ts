import { DETECTOR_BANDS, formatWavelengthRange } from "./detectors";
import type { SkyCoordinatesInput } from "./urlState";

export interface LoadingSubject {
  targetName: string | null;
  detector: number;
  coordinates: SkyCoordinatesInput;
}

export function describeDetectorRange(detector: number): string {
  const band = DETECTOR_BANDS.find((candidate) => candidate.number === detector);
  return band
    ? `D${detector}, ${formatWavelengthRange(band.minimumMicrometers, band.maximumMicrometers)}`
    : `D${detector}`;
}

export function describeLoading(subject: LoadingSubject): string {
  const detectorRange = describeDetectorRange(subject.detector);
  if (subject.targetName !== null) {
    return (
      `Loading precomputed frames for ${subject.targetName}, detector ${detectorRange}. ` +
      "This is usually near-instant."
    );
  }
  const { rightAscension, declination } = subject.coordinates;
  return (
    `Reading SPHEREx exposures for RA ${rightAscension}, Dec ${declination} ` +
    `(detector ${detectorRange}) from the public archive mirror. Free coordinates are computed ` +
    "live and can take 30 to 60 seconds; challenge targets are precomputed and load in about a second."
  );
}
