export type Vector3 = readonly [number, number, number];
export type Matrix3Rows = readonly [Vector3, Vector3, Vector3];

export const DEGREES_TO_RADIANS = Math.PI / 180;
export const LIGHT_YEARS_PER_PARSEC = 3.26156;

const GALACTIC_POLE_RIGHT_ASCENSION_DEGREES = 192.85948;
const GALACTIC_POLE_DECLINATION_DEGREES = 27.12825;
const NORTH_CELESTIAL_POLE_GALACTIC_LONGITUDE_DEGREES = 122.93192;

export function clamp(value: number, minimum: number, maximum: number): number {
  return Math.min(maximum, Math.max(minimum, value));
}

export function dot(first: Vector3, second: Vector3): number {
  return first[0] * second[0] + first[1] * second[1] + first[2] * second[2];
}

export function cross(first: Vector3, second: Vector3): Vector3 {
  return [
    first[1] * second[2] - first[2] * second[1],
    first[2] * second[0] - first[0] * second[2],
    first[0] * second[1] - first[1] * second[0],
  ];
}

export function vectorLength(vector: Vector3): number {
  return Math.hypot(vector[0], vector[1], vector[2]);
}

export function add(first: Vector3, second: Vector3): Vector3 {
  return [first[0] + second[0], first[1] + second[1], first[2] + second[2]];
}

export function subtract(first: Vector3, second: Vector3): Vector3 {
  return [first[0] - second[0], first[1] - second[1], first[2] - second[2]];
}

export function scale(vector: Vector3, factor: number): Vector3 {
  return [vector[0] * factor, vector[1] * factor, vector[2] * factor];
}

export function equatorialToCartesian(
  rightAscensionDegrees: number,
  declinationDegrees: number,
  distance: number,
): Vector3 {
  const rightAscension = rightAscensionDegrees * DEGREES_TO_RADIANS;
  const declination = declinationDegrees * DEGREES_TO_RADIANS;
  return [
    distance * Math.cos(declination) * Math.cos(rightAscension),
    distance * Math.cos(declination) * Math.sin(rightAscension),
    distance * Math.sin(declination),
  ];
}

export function equatorialToGalacticRows(): Matrix3Rows {
  const poleRightAscension = GALACTIC_POLE_RIGHT_ASCENSION_DEGREES * DEGREES_TO_RADIANS;
  const poleDeclination = GALACTIC_POLE_DECLINATION_DEGREES * DEGREES_TO_RADIANS;
  const poleLongitude = NORTH_CELESTIAL_POLE_GALACTIC_LONGITUDE_DEGREES * DEGREES_TO_RADIANS;
  const galacticPole: Vector3 = [
    Math.cos(poleDeclination) * Math.cos(poleRightAscension),
    Math.cos(poleDeclination) * Math.sin(poleRightAscension),
    Math.sin(poleDeclination),
  ];
  const celestialPole: Vector3 = [0, 0, 1];
  const towardsCelestialPole = scale(
    subtract(celestialPole, scale(galacticPole, Math.sin(poleDeclination))),
    1 / Math.cos(poleDeclination),
  );
  const perpendicular = cross(galacticPole, towardsCelestialPole);
  const galacticXAxis = subtract(
    scale(towardsCelestialPole, Math.cos(poleLongitude)),
    scale(perpendicular, Math.sin(poleLongitude)),
  );
  const galacticYAxis = cross(galacticPole, galacticXAxis);
  return [galacticXAxis, galacticYAxis, galacticPole];
}

export function matrixRowsToColumnMajor(rows: Matrix3Rows): number[] {
  return [
    rows[0][0],
    rows[1][0],
    rows[2][0],
    rows[0][1],
    rows[1][1],
    rows[2][1],
    rows[0][2],
    rows[1][2],
    rows[2][2],
  ];
}

export function easeInOutCubic(progress: number): number {
  return progress < 0.5 ? 4 * progress ** 3 : 1 - (-2 * progress + 2) ** 3 / 2;
}

export function shortestAngleDelta(from: number, to: number): number {
  const fullTurn = Math.PI * 2;
  let delta = (to - from) % fullTurn;
  if (delta > Math.PI) {
    delta -= fullTurn;
  }
  if (delta < -Math.PI) {
    delta += fullTurn;
  }
  return delta;
}

export function niceScaleLength(maximumLength: number): number {
  const decade = 10 ** Math.floor(Math.log10(maximumLength));
  for (const multiple of [5, 2, 1]) {
    if (multiple * decade <= maximumLength) {
      return multiple * decade;
    }
  }
  return decade;
}

export function formatScaleLabel(lengthParsecs: number): string {
  const lightYears = lengthParsecs * LIGHT_YEARS_PER_PARSEC;
  const parsecText = lengthParsecs >= 1 ? String(lengthParsecs) : lengthParsecs.toPrecision(1);
  const lightYearText =
    lightYears >= 10 ? String(Math.round(lightYears)) : lightYears.toPrecision(2);
  return `${parsecText} pc · ${lightYearText} ly`;
}
