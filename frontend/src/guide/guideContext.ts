import type { Frame, FramesResponse, TargetFacts } from "../api";
import { meanSaturationOfDetector } from "../factsText";
import { countSaturatedPixels } from "../frameText";
import type { PreparedFrames } from "../preparedFrames";
import { findChallengeTarget } from "../presets";
import { findScienceNotes, type ScienceNotes } from "./scienceNotes";

export type GuideSubjectKind = "challenge" | "free" | "none";

export interface DetectorSummary {
  detector: number;
  response: FramesResponse;
  frames: Frame[];
  exposureCount: number;
  meanSaturatedFraction: number | null;
  saturatedPixelCount: number;
}

export interface GuideContext {
  kind: GuideSubjectKind;
  targetSlug: string | null;
  targetName: string;
  facts: TargetFacts | null;
  notes: ScienceNotes | null;
  detectors: DetectorSummary[];
  selectedDetector: number;
  isCatalogueLoaded: boolean;
}

export interface GuideContextInput {
  targetSlug: string | null;
  hasFreeCoordinates: boolean;
  targetFacts: ReadonlyMap<string, TargetFacts> | null;
  loadedFrames: ReadonlyMap<number, PreparedFrames>;
  areFramesForTarget: boolean;
  selectedDetector: number;
}

export const FREE_COORDINATES_NAME = "Custom coordinates";
export const NO_TARGET_NAME = "No target selected";

function summarizeDetector(detector: number, prepared: PreparedFrames): DetectorSummary {
  const { response } = prepared;
  return {
    detector,
    response,
    frames: response.frames,
    exposureCount: response.frames.reduce((total, frame) => total + frame.exposure_count, 0),
    meanSaturatedFraction: meanSaturationOfDetector(response),
    saturatedPixelCount: Math.max(0, ...response.frames.map(countSaturatedPixels)),
  };
}

function summarizeLoadedDetectors(
  loadedFrames: ReadonlyMap<number, PreparedFrames>,
): DetectorSummary[] {
  return [...loadedFrames.entries()]
    .filter(([, prepared]) => prepared.response.frames.length > 0)
    .sort(([first], [second]) => first - second)
    .map(([detector, prepared]) => summarizeDetector(detector, prepared));
}

export function buildGuideContext(input: GuideContextInput): GuideContext {
  const challengeTarget = findChallengeTarget(input.targetSlug);
  const detectors = input.areFramesForTarget ? summarizeLoadedDetectors(input.loadedFrames) : [];
  const kind: GuideSubjectKind = challengeTarget
    ? "challenge"
    : input.hasFreeCoordinates || detectors.length > 0
      ? "free"
      : "none";
  const names: Record<GuideSubjectKind, string> = {
    challenge: challengeTarget?.name ?? "",
    free: FREE_COORDINATES_NAME,
    none: NO_TARGET_NAME,
  };
  return {
    kind,
    targetSlug: challengeTarget?.slug ?? null,
    targetName: names[kind],
    facts: challengeTarget ? (input.targetFacts?.get(challengeTarget.slug) ?? null) : null,
    notes: findScienceNotes(challengeTarget?.slug ?? null),
    detectors,
    selectedDetector: input.selectedDetector,
    isCatalogueLoaded: input.targetFacts !== null,
  };
}

export function framesOfSelectedDetector(context: GuideContext): DetectorSummary | null {
  return (
    context.detectors.find((summary) => summary.detector === context.selectedDetector) ??
    context.detectors[0] ??
    null
  );
}
