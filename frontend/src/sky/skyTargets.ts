import { findChallengeTarget } from "../presets";
import { cameraLookingAt, type CameraState } from "./skyCamera";
import { clamp, equatorialToCartesian, LIGHT_YEARS_PER_PARSEC, type Vector3 } from "./skyMath";

export const DIRECTION_ONLY_DISTANCE_TEXT = "distance not in Gaia DR3";

const DIRECTION_ONLY_SHELL_PARSECS = 8;
const DIRECTION_ONLY_VIEW_DISTANCE_PARSECS = 4;
const MILLIARCSECONDS_PER_ARCSECOND = 1000;

export interface SkyTarget {
  slug: string;
  name: string;
  rightAscensionDegrees: number;
  declinationDegrees: number;
  distanceParsecs: number | null;
  distanceSource: string;
  note: string;
  defaultDetector: number;
  position: Vector3;
  viewDistanceParsecs: number;
}

interface TargetDefinition {
  slug: string;
  rightAscensionDegrees: number;
  declinationDegrees: number;
  gaiaDistanceMeasureMilliarcseconds: number | null;
  distanceSource: string;
  note: string;
  viewDistanceParsecs?: number;
}

const TARGET_DEFINITIONS: readonly TargetDefinition[] = [
  {
    slug: "barnards_star",
    rightAscensionDegrees: 269.44850252543836,
    declinationDegrees: 4.739420051112412,
    gaiaDistanceMeasureMilliarcseconds: 546.975939730948,
    distanceSource: "Gaia DR3 4472832130942575872",
    note: "Position and distance from Gaia DR3.",
    viewDistanceParsecs: 1.4,
  },
  {
    slug: "epsilon_indi_b",
    rightAscensionDegrees: 331.0767776,
    declinationDegrees: -56.793953,
    gaiaDistanceMeasureMilliarcseconds: 274.8431,
    distanceSource: "Gaia DR3 6412595290592307840 (Epsilon Indi A, same system)",
    note: "Position from CatWISE2020, proper motion derived from AllWISE.",
    viewDistanceParsecs: 2.2,
  },
  {
    slug: "wise_0855_0714",
    rightAscensionDegrees: 133.7831722,
    declinationDegrees: -7.2442516,
    gaiaDistanceMeasureMilliarcseconds: null,
    distanceSource: "not in Gaia DR3",
    note: "Position propagated from the CatWISE2020 proper motion. Only its direction is shown.",
  },
  {
    slug: "rw_aurigae",
    rightAscensionDegrees: 76.95608119552952,
    declinationDegrees: 30.401204589097233,
    gaiaDistanceMeasureMilliarcseconds: 6.406249329219477,
    distanceSource: "Gaia DR3 156430822114424576",
    note: "Position and distance from Gaia DR3.",
  },
  {
    slug: "r_draconis",
    rightAscensionDegrees: 248.1673783672889,
    declinationDegrees: 66.75500674547219,
    gaiaDistanceMeasureMilliarcseconds: 1.2509180143740992,
    distanceSource: "Gaia DR3 1648328016354496384",
    note: "Position and distance from Gaia DR3.",
  },
];

function buildTarget(definition: TargetDefinition): SkyTarget {
  const challengeTarget = findChallengeTarget(definition.slug);
  if (!challengeTarget) {
    throw new Error(`The challenge target ${definition.slug} is missing.`);
  }
  const distanceParsecs =
    definition.gaiaDistanceMeasureMilliarcseconds === null
      ? null
      : MILLIARCSECONDS_PER_ARCSECOND / definition.gaiaDistanceMeasureMilliarcseconds;
  const defaultViewDistance =
    distanceParsecs === null
      ? DIRECTION_ONLY_VIEW_DISTANCE_PARSECS
      : clamp(distanceParsecs * 0.4, 1.5, 500);
  return {
    slug: definition.slug,
    name: challengeTarget.name,
    rightAscensionDegrees: definition.rightAscensionDegrees,
    declinationDegrees: definition.declinationDegrees,
    distanceParsecs,
    distanceSource: definition.distanceSource,
    note: definition.note,
    defaultDetector: challengeTarget.defaultDetector,
    position: equatorialToCartesian(
      definition.rightAscensionDegrees,
      definition.declinationDegrees,
      distanceParsecs ?? DIRECTION_ONLY_SHELL_PARSECS,
    ),
    viewDistanceParsecs: definition.viewDistanceParsecs ?? defaultViewDistance,
  };
}

export const SKY_TARGETS: readonly SkyTarget[] = TARGET_DEFINITIONS.map(buildTarget);

export function findSkyTarget(slug: string): SkyTarget | null {
  return SKY_TARGETS.find((target) => target.slug === slug) ?? null;
}

export function cameraForTarget(target: SkyTarget): CameraState {
  return cameraLookingAt(target.position, target.viewDistanceParsecs);
}

export function formatDistance(
  distanceParsecs: number | null,
  parsecDecimals: number,
  lightYearDecimals: number,
): string {
  if (distanceParsecs === null) {
    return DIRECTION_ONLY_DISTANCE_TEXT;
  }
  const lightYears = distanceParsecs * LIGHT_YEARS_PER_PARSEC;
  return `${distanceParsecs.toFixed(parsecDecimals)} pc · ${lightYears.toFixed(lightYearDecimals)} ly`;
}
