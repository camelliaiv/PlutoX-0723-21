export interface SkyCoordinatesInput {
  rightAscension: string;
  declination: string;
}

const RIGHT_ASCENSION_PARAMETER = "ra";
const DECLINATION_PARAMETER = "dec";

export function readCoordinatesFromUrl(queryString: string): SkyCoordinatesInput {
  const parameters = new URLSearchParams(queryString);
  return {
    rightAscension: (parameters.get(RIGHT_ASCENSION_PARAMETER) ?? "").trim(),
    declination: (parameters.get(DECLINATION_PARAMETER) ?? "").trim(),
  };
}

export function buildCoordinatesQuery(coordinates: SkyCoordinatesInput): string {
  const parameters = new URLSearchParams();
  if (coordinates.rightAscension) {
    parameters.set(RIGHT_ASCENSION_PARAMETER, coordinates.rightAscension);
  }
  if (coordinates.declination) {
    parameters.set(DECLINATION_PARAMETER, coordinates.declination);
  }
  const queryString = parameters.toString();
  return queryString ? `?${queryString}` : "";
}
