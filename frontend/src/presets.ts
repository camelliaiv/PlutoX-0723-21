import type { SkyCoordinatesInput } from "./urlState";

export interface ChallengeTarget {
  name: string;
  coordinates: SkyCoordinatesInput;
  coordinateSource: string;
}

const CATALOGUE_POSITION = "J2000 catalogue position";

export const CHALLENGE_TARGETS: ChallengeTarget[] = [
  {
    name: "Barnard's Star",
    coordinates: { rightAscension: "17h57m48.50s", declination: "+04d41m36.2s" },
    coordinateSource: CATALOGUE_POSITION,
  },
  {
    name: "WISE 0855−0714",
    coordinates: { rightAscension: "08h55m10.831s", declination: "-07d14m42.53s" },
    coordinateSource: "challenge coordinates",
  },
  {
    name: "Epsilon Indi B",
    coordinates: { rightAscension: "22h04m10.52s", declination: "-56d46m57.7s" },
    coordinateSource: CATALOGUE_POSITION,
  },
  {
    name: "RW Aurigae",
    coordinates: { rightAscension: "05h07m49.54s", declination: "+30d24m05.1s" },
    coordinateSource: CATALOGUE_POSITION,
  },
  {
    name: "R Draconis",
    coordinates: { rightAscension: "16h32m40.17s", declination: "+66d45m17.9s" },
    coordinateSource: CATALOGUE_POSITION,
  },
];
