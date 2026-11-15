import { clamp, equatorialToCartesian, type Vector3 } from "./skyMath";

export interface UserPosition {
  rightAscensionDegrees: number;
  declinationDegrees: number;
  position: Vector3;
  label: string;
}

export const USER_POSITION_SHELL_PARSECS = 8;
export const USER_POSITION_VIEW_DISTANCE_PARSECS = 4;

const DEGREES_PER_HOUR = 15;
const SEXAGESIMAL_BASE = 60;
const FULL_CIRCLE_DEGREES = 360;
const MAXIMUM_DECLINATION_DEGREES = 90;
const NUMBER_PATTERN = /\d+(?:\.\d+)?|\.\d+/g;
const PLAIN_NUMBER_PATTERN = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/;

function parseSexagesimalParts(text: string): number[] | null {
  const matches = text.match(NUMBER_PATTERN);
  if (!matches || matches.length === 0 || matches.length > 3) {
    return null;
  }
  const parts = matches.map(Number);
  return parts.every((part) => Number.isFinite(part)) ? parts : null;
}

function combineParts(parts: number[]): number {
  return parts.reduce((total, part, index) => total + part / SEXAGESIMAL_BASE ** index, 0);
}

export function parseRightAscensionDegrees(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") {
    return null;
  }
  if (PLAIN_NUMBER_PATTERN.test(trimmed)) {
    const value = Number(trimmed);
    return value >= 0 && value < FULL_CIRCLE_DEGREES ? value : null;
  }
  if (!/[hH:\s]/.test(trimmed) || trimmed.startsWith("-")) {
    return null;
  }
  const parts = parseSexagesimalParts(trimmed);
  if (!parts) {
    return null;
  }
  const degrees = combineParts(parts) * DEGREES_PER_HOUR;
  return degrees >= 0 && degrees < FULL_CIRCLE_DEGREES ? degrees : null;
}

export function parseDeclinationDegrees(text: string): number | null {
  const trimmed = text.trim();
  if (trimmed === "") {
    return null;
  }
  if (PLAIN_NUMBER_PATTERN.test(trimmed)) {
    const value = Number(trimmed);
    return Math.abs(value) <= MAXIMUM_DECLINATION_DEGREES ? value : null;
  }
  const parts = parseSexagesimalParts(trimmed);
  if (!parts) {
    return null;
  }
  const magnitude = combineParts(parts);
  const value = trimmed.startsWith("-") ? -magnitude : magnitude;
  return Math.abs(value) <= MAXIMUM_DECLINATION_DEGREES ? value : null;
}

export function buildUserPosition(
  rightAscensionText: string,
  declinationText: string,
): UserPosition | null {
  const rightAscensionDegrees = parseRightAscensionDegrees(rightAscensionText);
  const declinationDegrees = parseDeclinationDegrees(declinationText);
  if (rightAscensionDegrees === null || declinationDegrees === null) {
    return null;
  }
  const safeDeclination = clamp(
    declinationDegrees,
    -MAXIMUM_DECLINATION_DEGREES,
    MAXIMUM_DECLINATION_DEGREES,
  );
  return {
    rightAscensionDegrees,
    declinationDegrees: safeDeclination,
    position: equatorialToCartesian(
      rightAscensionDegrees,
      safeDeclination,
      USER_POSITION_SHELL_PARSECS,
    ),
    label: `RA ${rightAscensionText.trim()} · Dec ${declinationText.trim()}`,
  };
}
