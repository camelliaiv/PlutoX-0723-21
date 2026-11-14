export interface SkyCoordinatesInput {
  rightAscension: string;
  declination: string;
}

export interface ViewState {
  targetSlug: string | null;
  detector: number | null;
  coordinates: SkyCoordinatesInput;
}

const TARGET_PARAMETER = "target";
const DETECTOR_PARAMETER = "detector";
const RIGHT_ASCENSION_PARAMETER = "ra";
const DECLINATION_PARAMETER = "dec";
const FIRST_DETECTOR = 1;
const LAST_DETECTOR = 6;

export function parseDetector(text: string | null): number | null {
  if (text === null || !/^\d+$/.test(text)) {
    return null;
  }
  const detector = Number(text);
  return detector >= FIRST_DETECTOR && detector <= LAST_DETECTOR ? detector : null;
}

export function readViewFromUrl(queryString: string): ViewState {
  const parameters = new URLSearchParams(queryString);
  const targetSlug = (parameters.get(TARGET_PARAMETER) ?? "").trim();
  return {
    targetSlug: targetSlug || null,
    detector: parseDetector(parameters.get(DETECTOR_PARAMETER)),
    coordinates: {
      rightAscension: (parameters.get(RIGHT_ASCENSION_PARAMETER) ?? "").trim(),
      declination: (parameters.get(DECLINATION_PARAMETER) ?? "").trim(),
    },
  };
}

export function buildViewQuery(view: ViewState): string {
  const parameters = new URLSearchParams();
  if (view.targetSlug) {
    parameters.set(TARGET_PARAMETER, view.targetSlug);
  } else {
    if (view.coordinates.rightAscension) {
      parameters.set(RIGHT_ASCENSION_PARAMETER, view.coordinates.rightAscension);
    }
    if (view.coordinates.declination) {
      parameters.set(DECLINATION_PARAMETER, view.coordinates.declination);
    }
  }
  if (view.detector !== null) {
    parameters.set(DETECTOR_PARAMETER, String(view.detector));
  }
  const queryString = parameters.toString();
  return queryString ? `?${queryString}` : "";
}
