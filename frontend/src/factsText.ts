import type { ExposureMeasurement, Frame, FramesResponse } from "./api";
import { formatDate, formatEpochDates } from "./dateText";
import { formatWavelengthRange } from "./detectors";
import { countSaturatedPixels, describeReleases } from "./frameText";

export interface FactRow {
  label: string;
  value: string;
}

const ARCSECONDS_PER_ARCMINUTE = 60;

export function describeFieldRows(response: FramesResponse): FactRow[] {
  const { reference_position: position, grid } = response;
  const fieldArcminutes =
    (grid.size_pixels * grid.pixel_scale_arcseconds) / ARCSECONDS_PER_ARCMINUTE;
  return [
    {
      label: "RA / Dec",
      value: `${position.right_ascension.toFixed(4)}° / ${position.declination.toFixed(4)}°`,
    },
    { label: "Position date", value: formatDate(response.reference_date) },
    {
      label: "Field of view",
      value:
        `${grid.size_pixels}×${grid.size_pixels} px · ${grid.pixel_scale_arcseconds}″/px · ` +
        `${fieldArcminutes.toFixed(2)}′`,
    },
  ];
}

export function describeFrameRows(
  frame: Frame,
  epochPosition: number,
  epochCount: number,
): FactRow[] {
  return [
    {
      label: "Epoch",
      value:
        `${epochPosition} of ${epochCount} · ` + formatEpochDates(frame.start_date, frame.end_date),
    },
    {
      label: "Wavelength",
      value: formatWavelengthRange(
        frame.wavelength_min_micrometers,
        frame.wavelength_max_micrometers,
      ),
    },
    {
      label: "Exposures",
      value: `${frame.exposure_count} used, ${frame.skipped_exposure_count} skipped`,
    },
    { label: "Release", value: describeReleases(frame.data_releases) },
    {
      label: "Predicted pixel",
      value: `${frame.predicted_position.column.toFixed(2)}, ${frame.predicted_position.row.toFixed(2)}`,
    },
    {
      label: "Saturated pixels",
      value: `${countSaturatedPixels(frame)} (at least half of the exposures)`,
    },
  ];
}

function meanSaturatedFraction(exposures: ExposureMeasurement[]): number | null {
  const fractions = exposures
    .map((exposure) => exposure.saturated_fraction)
    .filter((fraction): fraction is number => fraction !== null);
  return fractions.length > 0
    ? fractions.reduce((total, fraction) => total + fraction, 0) / fractions.length
    : null;
}

function maximumNonFiniteFraction(exposures: ExposureMeasurement[]): number | null {
  const fractions = exposures
    .map((exposure) => exposure.non_finite_fraction)
    .filter((fraction): fraction is number => fraction !== null);
  return fractions.length > 0 ? Math.max(...fractions) : null;
}

export function describeMetadata(response: FramesResponse, frame: Frame): string[] {
  const observationWord = frame.observation_ids.length === 1 ? "observation" : "observations";
  const lines = [
    `Unit: ${response.unit}`,
    "Orientation: north up, east left",
    `${frame.observation_ids.length} ${observationWord} in this epoch, for example ` +
      (frame.observation_ids[0] ?? "none"),
  ];
  const saturation = meanSaturatedFraction(response.exposures);
  if (saturation !== null) {
    lines.push(`Mean saturated fraction of the exposures: ${saturation.toFixed(2)}`);
  }
  const nonFinite = maximumNonFiniteFraction(response.exposures);
  if (nonFinite !== null) {
    lines.push(`Largest non-finite fraction of an exposure: ${nonFinite.toFixed(2)}`);
  }
  lines.push("Pixels without coverage are drawn grey-green");
  return lines;
}

export function meanSaturationOfDetector(response: FramesResponse): number | null {
  return meanSaturatedFraction(response.exposures);
}
