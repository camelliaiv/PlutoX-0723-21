import { LIGHT_YEARS_PER_PARSEC } from "../sky/skyMath";
import type { GuideContext } from "./guideContext";
import {
  paragraph,
  timeMachineCitation,
  type AnswerParagraph,
  type GuideAnswer,
} from "./guideTypes";

const NEGLIGIBLE_SHIFT_PIXELS = 0.05;
const NEARBY_DISTANCE_PARSECS = 10;

export function formatSignedNumber(value: number, digits: number): string {
  const sign = value < 0 ? "−" : "+";
  return `${sign}${Math.abs(value).toFixed(digits)}`;
}

export function formatDistance(distanceParsecs: number): string {
  const isNearby = distanceParsecs < NEARBY_DISTANCE_PARSECS;
  const parsecs = distanceParsecs.toFixed(isNearby ? 3 : 1);
  const lightYears = (distanceParsecs * LIGHT_YEARS_PER_PARSEC).toFixed(isNearby ? 2 : 0);
  return `${parsecs} pc (about ${lightYears} light-years)`;
}

export function describeShiftArcseconds(
  columnShift: number,
  rowShift: number,
  pixelScaleArcseconds: number,
): string {
  const parts: string[] = [];
  if (Math.abs(rowShift) > NEGLIGIBLE_SHIFT_PIXELS) {
    const direction = rowShift > 0 ? "north" : "south";
    parts.push(`${Math.abs(rowShift * pixelScaleArcseconds).toFixed(1)}″ ${direction}`);
  }
  if (Math.abs(columnShift) > NEGLIGIBLE_SHIFT_PIXELS) {
    const direction = columnShift > 0 ? "west" : "east";
    parts.push(`${Math.abs(columnShift * pixelScaleArcseconds).toFixed(1)}″ ${direction}`);
  }
  return parts.length > 0 ? parts.join(" and ") : "no shift";
}

export function describeCatalogueUnavailable(context: GuideContext): string {
  if (context.kind === "free") {
    return "Catalogue facts are not available for custom coordinates.";
  }
  return "The catalogue facts could not be loaded.";
}

export function framesNotLoadedParagraph(context: GuideContext): AnswerParagraph {
  return context.kind === "none"
    ? paragraph("No frames are loaded.")
    : paragraph(`Frames for ${context.targetName} are not loaded yet. `, timeMachineCitation());
}

export function noTargetAnswer(): GuideAnswer {
  return {
    paragraphs: [paragraph("No target is selected. Choose one in the sky or in the time machine.")],
    confidence: { level: "low", reason: "Low: nothing is selected, so there is nothing to read." },
  };
}
