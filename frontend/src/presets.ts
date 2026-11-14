import type { SkyCoordinatesInput } from "./urlState";

export interface ChallengeTarget {
  slug: string;
  name: string;
  coordinates: SkyCoordinatesInput;
  coordinateSource: string;
  defaultDetector: number;
  notice?: string;
}

export const FREE_COORDINATES_DETECTOR = 1;

const CATALOGUE_POSITION = "J2000 catalogue position";

const WISE_0855_NOTICE =
  "WISE 0855−0714 moves quickly: its position here is propagated from the CatWISE2020 proper " +
  "motion, and it lies about 2′ from the challenge-statement coordinates. In 2025–2026 it passes " +
  "a few arcseconds from a background field star that is bright at short wavelengths. WISE " +
  "0855−0714 itself is visible only at the longest wavelengths.";

export const CHALLENGE_TARGETS: ChallengeTarget[] = [
  {
    slug: "barnards_star",
    name: "Barnard's Star",
    coordinates: { rightAscension: "17h57m48.50s", declination: "+04d41m36.2s" },
    coordinateSource: CATALOGUE_POSITION,
    defaultDetector: 5,
  },
  {
    slug: "wise_0855_0714",
    name: "WISE 0855−0714",
    coordinates: { rightAscension: "08h55m10.831s", declination: "-07d14m42.53s" },
    coordinateSource: "challenge coordinates",
    defaultDetector: 5,
    notice: WISE_0855_NOTICE,
  },
  {
    slug: "epsilon_indi_b",
    name: "Epsilon Indi B",
    coordinates: { rightAscension: "22h04m10.52s", declination: "-56d46m57.7s" },
    coordinateSource: CATALOGUE_POSITION,
    defaultDetector: 3,
  },
  {
    slug: "rw_aurigae",
    name: "RW Aurigae",
    coordinates: { rightAscension: "05h07m49.54s", declination: "+30d24m05.1s" },
    coordinateSource: CATALOGUE_POSITION,
    defaultDetector: 1,
  },
  {
    slug: "r_draconis",
    name: "R Draconis",
    coordinates: { rightAscension: "16h32m40.17s", declination: "+66d45m17.9s" },
    coordinateSource: CATALOGUE_POSITION,
    defaultDetector: 5,
  },
];

export function findChallengeTarget(slug: string | null): ChallengeTarget | null {
  return CHALLENGE_TARGETS.find((challengeTarget) => challengeTarget.slug === slug) ?? null;
}

export function defaultDetectorFor(slug: string | null): number {
  return findChallengeTarget(slug)?.defaultDetector ?? FREE_COORDINATES_DETECTOR;
}
