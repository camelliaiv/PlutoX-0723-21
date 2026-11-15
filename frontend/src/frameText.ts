import type { Frame, FramesResponse } from "./api";
import { formatWavelengthRange } from "./detectors";
import { formatDate, formatEpochDates } from "./dateText";
import type { DisplayMode } from "./frameModes";

const RELEASE_TITLES: Record<string, string> = {
  spherex_dr1: "Data Release 1",
  spherex_qr3: "Quick Release 3",
};

function describeRelease(release: string): string {
  return RELEASE_TITLES[release] ?? release;
}

export function describeReleases(releases: string[]): string {
  return releases.map(describeRelease).join(", ");
}

function describeExposures(frame: Frame): string {
  const exposureWord = frame.exposure_count === 1 ? "exposure" : "exposures";
  const used = `${frame.exposure_count} ${exposureWord} used`;
  return frame.skipped_exposure_count > 0
    ? `${used}, ${frame.skipped_exposure_count} skipped`
    : used;
}

export function formatFrameLabel(frame: Frame): string {
  const wavelengths = formatWavelengthRange(
    frame.wavelength_min_micrometers,
    frame.wavelength_max_micrometers,
  );
  return [
    `Epoch ${frame.epoch_number}`,
    `${formatDate(frame.start_date)} – ${formatDate(frame.end_date)} (UTC)`,
    `Detector D${frame.detector}`,
    `${wavelengths} at target`,
    describeExposures(frame),
    describeReleases(frame.data_releases),
  ].join(" · ");
}

export function formatFrameSource(response: FramesResponse): string {
  const releases = [...new Set(response.frames.flatMap((frame) => frame.data_releases))].sort();
  const sourceLabel =
    releases.length > 0 ? ` from SPHEREx ${releases.map(describeRelease).join(" + ")}` : "";
  const computed = formatDate(response.computed_at);
  return response.served_from_cache
    ? `Precomputed frames, computed ${computed}${sourceLabel}.`
    : `Computed live on ${computed}${sourceLabel}.`;
}

export function formatReferencePosition(response: FramesResponse): string {
  const { right_ascension, declination } = response.reference_position;
  return (
    `Frames are centred on RA ${right_ascension.toFixed(4)}°, Dec ${declination.toFixed(4)}° ` +
    `(position at ${formatDate(response.reference_date)}); unit: ${response.unit}.`
  );
}

export function hasSaturatedPixels(frame: Frame): boolean {
  return frame.saturated_fraction.some((row) =>
    row.some((fraction) => fraction !== null && fraction > 0),
  );
}

export function describeSaturation(frames: Frame[]): string | null {
  if (!frames.some(hasSaturatedPixels)) {
    return null;
  }
  return (
    "Some pixels are saturated: the star is too bright for this detector. " +
    "Positions remain usable; brightness here is not."
  );
}

export const SATURATED_PIXEL_THRESHOLD = 0.5;

export function countSaturatedPixels(frame: Frame): number {
  return frame.saturated_fraction.reduce(
    (total, row) =>
      total +
      row.filter((fraction) => fraction !== null && fraction >= SATURATED_PIXEL_THRESHOLD).length,
    0,
  );
}

export function formatPlayerBadge(
  frame: Frame,
  mode: DisplayMode,
  epochIndex: number,
  epochCount: number,
): string {
  const detector = `D${frame.detector}`;
  switch (mode) {
    case "stack":
      return `${detector} · Stack of ${epochCount} epochs`;
    case "difference":
      return `${detector} · Epoch ${epochIndex + 1} minus epoch 1`;
    default:
      return `${detector} · Epoch ${epochIndex + 1} · ${formatEpochDates(frame.start_date, frame.end_date)}`;
  }
}

const MODE_NAMES: Record<DisplayMode, string> = {
  frame: "Frame",
  difference: "Difference",
  stack: "Stack",
};

export function formatFramePlayerLabel(
  frame: Frame,
  mode: DisplayMode,
  epochIndex: number,
  epochCount: number,
): string {
  const { column, row } = frame.predicted_position;
  return (
    `Real SPHEREx image, epoch ${epochIndex + 1} of ${epochCount}. ${formatFrameLabel(frame)}. ` +
    `Mode: ${MODE_NAMES[mode]}. Predicted position at column ${column.toFixed(1)}, ` +
    `row ${row.toFixed(1)}. North up, east left.`
  );
}
