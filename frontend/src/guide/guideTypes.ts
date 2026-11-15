export type GuideAction =
  | { kind: "epoch"; epochIndex: number }
  | { kind: "detector"; detector: number }
  | { kind: "spectrum" }
  | { kind: "catalogue"; sourceIdentifier: string }
  | { kind: "timeMachine" };

export type AnswerPart =
  { kind: "text"; text: string } | { kind: "citation"; label: string; action: GuideAction };

export interface AnswerParagraph {
  parts: AnswerPart[];
}

export type ConfidenceLevel = "high" | "medium" | "low";

export interface Confidence {
  level: ConfidenceLevel;
  reason: string;
}

export interface GuideAnswer {
  paragraphs: AnswerParagraph[];
  confidence: Confidence;
}

export function textPart(text: string): AnswerPart {
  return { kind: "text", text };
}

export function citationPart(label: string, action: GuideAction): AnswerPart {
  return { kind: "citation", label, action };
}

export function paragraph(...parts: Array<AnswerPart | string>): AnswerParagraph {
  return {
    parts: parts.map((part) => (typeof part === "string" ? textPart(part) : part)),
  };
}

export function epochCitation(epochNumber: number, epochIndex: number): AnswerPart {
  return citationPart(`epoch ${epochNumber}`, { kind: "epoch", epochIndex });
}

export function detectorCitation(detector: number): AnswerPart {
  return citationPart(`D${detector}`, { kind: "detector", detector });
}

export function spectrumCitation(): AnswerPart {
  return citationPart("spectrum", { kind: "spectrum" });
}

export function catalogueCitation(sourceIdentifier: string): AnswerPart {
  return citationPart("catalogue", { kind: "catalogue", sourceIdentifier });
}

export function timeMachineCitation(): AnswerPart {
  return citationPart("open time machine", { kind: "timeMachine" });
}

export function joinWithCitations(
  detectors: number[],
  separator = ", ",
  finalSeparator = " and ",
): AnswerPart[] {
  const parts: AnswerPart[] = [];
  detectors.forEach((detector, index) => {
    if (index > 0) {
      parts.push(textPart(index === detectors.length - 1 ? finalSeparator : separator));
    }
    parts.push(detectorCitation(detector));
  });
  return parts;
}
