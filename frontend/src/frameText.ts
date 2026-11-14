import type { Frame, FramesResponse } from "./api";
import { formatWavelengthRange } from "./detectors";
import { formatDate } from "./render";

const RELEASE_TITLES: Record<string, string> = {
  spherex_dr1: "Data Release 1",
  spherex_qr3: "Quick Release 3",
};

export function describeReleases(releases: string[]): string {
  return releases.map((release) => RELEASE_TITLES[release] ?? release).join(", ");
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

export function formatFrameProvenance(frame: Frame): string {
  const count = frame.observation_ids.length;
  const observationWord = count === 1 ? "observation" : "observations";
  const releases = describeReleases(frame.data_releases);
  return `This frame combines ${count} ${observationWord} from SPHEREx ${releases}.`;
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
