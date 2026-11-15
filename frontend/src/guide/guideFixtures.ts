import type { ExposureMeasurement, Frame, TargetFacts } from "../api";
import { makeExposure, makeFrame, makePrepared } from "../pixelScaleFixtures";
import type { PreparedFrames } from "../preparedFrames";
import { buildGuideContext, type GuideContext } from "./guideContext";

export const BARNARDS_STAR_FACTS: TargetFacts = {
  slug: "barnards_star",
  name: "Barnard's Star",
  catalogue_source_id: "Gaia DR3 4472832130942575872",
  reference_epoch: "2016-01-01",
  right_ascension_degrees: 269.4485,
  declination_degrees: 4.7394,
  proper_motion_right_ascension_milliarcseconds_per_year: -801.55,
  proper_motion_declination_milliarcseconds_per_year: 10362.39,
  total_proper_motion_arcseconds_per_year: 10.393,
  distance_parsecs: 1.828,
  distance_source: "Gaia DR3 4472832130942575872",
};

export const WISE_FACTS: TargetFacts = {
  ...BARNARDS_STAR_FACTS,
  slug: "wise_0855_0714",
  name: "WISE 0855−0714",
  catalogue_source_id: "CatWISE2020 J085507.96-071439.3",
  total_proper_motion_arcseconds_per_year: 8.088,
  distance_parsecs: null,
  distance_source: "not in Gaia DR3",
};

export const EPSILON_INDI_B_FACTS: TargetFacts = {
  ...BARNARDS_STAR_FACTS,
  slug: "epsilon_indi_b",
  name: "Epsilon Indi B",
  distance_parsecs: 3.638,
  distance_source: "Gaia DR3 6412595290592307840 (Epsilon Indi A, same system)",
};

export function makeTwoEpochFrames(saturatedFraction: number): Frame[] {
  const first: Frame = {
    ...makeFrame(1, "2025-08-15T00:00:00", "2025-10-01T00:00:00"),
    detector: 5,
    exposure_count: 4,
    saturated_fraction: [[saturatedFraction]],
    predicted_position: { column: 0.5, row: 0.5, right_ascension: 0, declination: 0 },
  };
  const last: Frame = {
    ...makeFrame(2, "2026-08-15T00:00:00", "2026-10-01T00:00:00"),
    detector: 5,
    exposure_count: 5,
    saturated_fraction: [[saturatedFraction]],
    predicted_position: { column: 0.5, row: 2.5, right_ascension: 0, declination: 0 },
  };
  return [first, last];
}

export function makePreparedDetector(
  saturatedFraction: number,
  exposures: ExposureMeasurement[] = [makeExposure({ saturated_fraction: saturatedFraction })],
): PreparedFrames {
  return makePrepared(makeTwoEpochFrames(saturatedFraction), exposures);
}

export function makeChallengeContext(
  facts: TargetFacts | null,
  detectorFractions: Record<number, number> = {},
): GuideContext {
  const loadedFrames = new Map(
    Object.entries(detectorFractions).map(([detector, fraction]) => [
      Number(detector),
      makePreparedDetector(fraction),
    ]),
  );
  return buildGuideContext({
    targetSlug: facts?.slug ?? "barnards_star",
    hasFreeCoordinates: false,
    targetFacts: facts ? new Map([[facts.slug, facts]]) : new Map(),
    loadedFrames,
    areFramesForTarget: true,
    selectedDetector: 5,
  });
}

export function makeFreeContext(withFrames: boolean): GuideContext {
  return buildGuideContext({
    targetSlug: null,
    hasFreeCoordinates: true,
    targetFacts: new Map([[BARNARDS_STAR_FACTS.slug, BARNARDS_STAR_FACTS]]),
    loadedFrames: withFrames ? new Map([[5, makePreparedDetector(0)]]) : new Map(),
    areFramesForTarget: true,
    selectedDetector: 5,
  });
}

export function makeEmptyContext(): GuideContext {
  return buildGuideContext({
    targetSlug: null,
    hasFreeCoordinates: false,
    targetFacts: null,
    loadedFrames: new Map(),
    areFramesForTarget: true,
    selectedDetector: 5,
  });
}
