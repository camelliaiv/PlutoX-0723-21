import { formatDate } from "../dateText";
import { describePredictedMotion } from "../motionText";
import { framesOfSelectedDetector, type GuideContext } from "./guideContext";
import {
  catalogueCitation,
  epochCitation,
  paragraph,
  type AnswerParagraph,
  type GuideAnswer,
} from "./guideTypes";
import {
  describeCatalogueUnavailable,
  describeShiftArcseconds,
  formatDistance,
  formatSignedNumber,
  framesNotLoadedParagraph,
  noTargetAnswer,
} from "./guideWording";

const DEGREE_DIGITS = 4;
const SMALL_PROPER_MOTION_ARCSECONDS = 1;

function describeFreeCoordinates(context: GuideContext): GuideAnswer {
  const summary = framesOfSelectedDetector(context);
  if (!summary) {
    return {
      paragraphs: [
        paragraph(`These are custom coordinates. ${describeCatalogueUnavailable(context)}`),
        framesNotLoadedParagraph(context),
      ],
      confidence: { level: "low", reason: "Low: no frames are loaded for these coordinates." },
    };
  }
  const { right_ascension: rightAscension, declination } = summary.response.reference_position;
  return {
    paragraphs: [
      paragraph(
        `The frames are centred on RA ${rightAscension.toFixed(DEGREE_DIGITS)}°, Dec ` +
          `${declination.toFixed(DEGREE_DIGITS)}° (position at ${formatDate(summary.response.reference_date)}).`,
      ),
      paragraph(
        `${describeCatalogueUnavailable(context)} The guide cannot say what object lies there; ` +
          "the frames show real SPHEREx pixels around that position.",
      ),
    ],
    confidence: {
      level: "medium",
      reason: "Medium: the position is read from the loaded frames and nothing is identified.",
    },
  };
}

export function answerWhatIsIt(context: GuideContext): GuideAnswer {
  if (context.kind === "none") {
    return noTargetAnswer();
  }
  if (context.kind === "free") {
    return describeFreeCoordinates(context);
  }
  const { facts, notes } = context;
  if (!facts) {
    return {
      paragraphs: [
        paragraph(`${context.targetName} is one of the five challenge targets.`),
        paragraph(describeCatalogueUnavailable(context)),
      ],
      confidence: { level: "low", reason: "Low: the catalogue facts are not available." },
    };
  }
  const paragraphs: AnswerParagraph[] = [
    paragraph(
      `${facts.name} is one of the five challenge targets. Its catalogue position is RA ` +
        `${facts.right_ascension_degrees.toFixed(DEGREE_DIGITS)}°, Dec ` +
        `${facts.declination_degrees.toFixed(DEGREE_DIGITS)}° at the reference epoch ` +
        `${facts.reference_epoch}, from ${facts.catalogue_source_id}. `,
      catalogueCitation(facts.catalogue_source_id),
    ),
  ];
  if (notes?.visibility) {
    paragraphs.push(paragraph(notes.visibility));
  }
  return {
    paragraphs,
    confidence: { level: "high", reason: "High: read from the catalogue entry." },
  };
}

export function answerDistance(context: GuideContext): GuideAnswer {
  if (context.kind === "none") {
    return noTargetAnswer();
  }
  const { facts } = context;
  if (!facts) {
    return {
      paragraphs: [paragraph(`No distance is available. ${describeCatalogueUnavailable(context)}`)],
      confidence: { level: "low", reason: "Low: the catalogue facts are not available." },
    };
  }
  if (facts.distance_parsecs === null) {
    return {
      paragraphs: [
        paragraph(`No distance is available for ${facts.name}: ${facts.distance_source}.`),
        paragraph("Its position and motion come from CatWISE2020 instead."),
      ],
      confidence: {
        level: "high",
        reason: "High: the catalogue holds no distance for this target.",
      },
    };
  }
  return {
    paragraphs: [
      paragraph(
        `${facts.name} is ${formatDistance(facts.distance_parsecs)} from the Sun, from ` +
          `${facts.distance_source}. `,
        catalogueCitation(facts.distance_source),
      ),
    ],
    confidence: { level: "high", reason: "High: catalogue value." },
  };
}

function describeCatalogueMotion(context: GuideContext): AnswerParagraph | null {
  const { facts } = context;
  if (!facts) {
    return null;
  }
  const total = facts.total_proper_motion_arcseconds_per_year;
  const digits = total < SMALL_PROPER_MOTION_ARCSECONDS ? 3 : 2;
  const rightAscensionMotion = formatSignedNumber(
    facts.proper_motion_right_ascension_milliarcseconds_per_year,
    1,
  );
  const declinationMotion = formatSignedNumber(
    facts.proper_motion_declination_milliarcseconds_per_year,
    1,
  );
  return paragraph(
    `The catalogue proper motion is ${total.toFixed(digits)}″ per year ` +
      `(${rightAscensionMotion} mas per year in right ascension, ${declinationMotion} mas per ` +
      `year in declination) at the reference epoch ${facts.reference_epoch}, from ` +
      `${facts.catalogue_source_id}. `,
    catalogueCitation(facts.catalogue_source_id),
  );
}

function describePredictedShift(context: GuideContext): AnswerParagraph | null {
  const summary = framesOfSelectedDetector(context);
  if (!summary || context.kind !== "challenge") {
    return null;
  }
  const pixelScale = summary.response.grid.pixel_scale_arcseconds;
  const motion = describePredictedMotion(summary.frames, pixelScale);
  const first = summary.frames[0];
  const last = summary.frames[summary.frames.length - 1];
  if (!motion || !first || !last) {
    return null;
  }
  const shift = describeShiftArcseconds(motion.columnShift, motion.rowShift, pixelScale);
  return paragraph(
    `In D${summary.detector} the catalogue predicts a shift of ${motion.arcseconds.toFixed(1)}″ ` +
      `(${shift}) between `,
    epochCitation(first.epoch_number, 0),
    " and ",
    epochCitation(last.epoch_number, summary.frames.length - 1),
    `, over ${Math.round(motion.days)} days. This is a catalogue prediction, not a measurement ` +
      "from the pixels.",
  );
}

export function answerSpeed(context: GuideContext): GuideAnswer {
  if (context.kind === "none") {
    return noTargetAnswer();
  }
  if (context.kind === "free") {
    return {
      paragraphs: [
        paragraph(
          `${describeCatalogueUnavailable(context)} The frames are centred on a fixed position, ` +
            "so the guide cannot say how fast anything there moves.",
        ),
      ],
      confidence: {
        level: "low",
        reason: "Low: no proper motion is available for custom coordinates.",
      },
    };
  }
  const catalogueMotion = describeCatalogueMotion(context);
  const predictedShift = describePredictedShift(context);
  const noteMotion = context.notes?.motion;
  const paragraphs = [catalogueMotion, predictedShift].filter(
    (item): item is AnswerParagraph => item !== null,
  );
  if (noteMotion) {
    paragraphs.push(paragraph(`A separate science check: ${noteMotion}`));
  }
  if (paragraphs.length === 0) {
    return {
      paragraphs: [
        paragraph(describeCatalogueUnavailable(context)),
        framesNotLoadedParagraph(context),
      ],
      confidence: { level: "low", reason: "Low: no motion data is available." },
    };
  }
  if (predictedShift || noteMotion) {
    const reason = noteMotion
      ? "Medium: a catalogue prediction plus a separate science check."
      : "Medium: a catalogue prediction, not measured from the pixels.";
    return { paragraphs, confidence: { level: "medium", reason } };
  }
  return { paragraphs, confidence: { level: "high", reason: "High: catalogue value." } };
}
