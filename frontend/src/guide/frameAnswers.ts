import { formatEpochDates } from "../dateText";
import { describeReleases, formatFrameSource } from "../frameText";
import { framesOfSelectedDetector, type DetectorSummary, type GuideContext } from "./guideContext";
import {
  catalogueCitation,
  detectorCitation,
  epochCitation,
  joinWithCitations,
  paragraph,
  spectrumCitation,
  textPart,
  type AnswerPart,
  type AnswerParagraph,
  type GuideAnswer,
} from "./guideTypes";
import {
  describeCatalogueUnavailable,
  framesNotLoadedParagraph,
  noTargetAnswer,
} from "./guideWording";

const DETECTOR_COUNT = 6;
const FRACTION_DIGITS = 2;

function compareBySaturation(first: DetectorSummary, second: DetectorSummary): number {
  const firstFraction = first.meanSaturatedFraction ?? Number.POSITIVE_INFINITY;
  const secondFraction = second.meanSaturatedFraction ?? Number.POSITIVE_INFINITY;
  return firstFraction - secondFraction || second.exposureCount - first.exposureCount;
}

function describeFraction(summary: DetectorSummary): string {
  return summary.meanSaturatedFraction === null
    ? "no value"
    : summary.meanSaturatedFraction.toFixed(FRACTION_DIGITS);
}

function noteParagraph(prefix: string, text: string, detectors: number[]): AnswerParagraph {
  const parts: AnswerPart[] = [textPart(`${prefix}${text}`)];
  if (detectors.length > 0) {
    parts.push(textPart(" See "), ...joinWithCitations(detectors), textPart("."));
  }
  return { parts };
}

export function answerBestDetector(context: GuideContext): GuideAnswer {
  if (context.kind === "none") {
    return noTargetAnswer();
  }
  const paragraphs: AnswerParagraph[] = [];
  const ranked = [...context.detectors].sort(compareBySaturation);
  const [best, second] = ranked;
  if (best && ranked.length === 1) {
    paragraphs.push(
      paragraph(
        `Only D${best.detector} is loaded so far, so the detectors cannot be compared yet.`,
      ),
    );
  } else if (best && second) {
    const unsaturated =
      (best.meanSaturatedFraction ?? 1) === 0 && second.meanSaturatedFraction === 0;
    paragraphs.push(
      unsaturated
        ? paragraph(
            `Among the ${ranked.length} detectors loaded, the saturation flags do not separate ` +
              "them; compare the signal in the ",
            spectrumCitation(),
            ".",
          )
        : paragraph(
            `Among the ${ranked.length} detectors loaded, `,
            detectorCitation(best.detector),
            ` is least affected by saturation (mean saturated fraction ${describeFraction(best)}), then `,
            detectorCitation(second.detector),
            ` (${describeFraction(second)}).`,
          ),
    );
  }
  const { notes } = context;
  if (notes?.saturation) {
    paragraphs.push(
      noteParagraph("A separate science check notes: ", notes.saturation, notes.detectors),
    );
  }
  if (notes?.visibility) {
    paragraphs.push(paragraph(notes.visibility));
  }
  if (paragraphs.length === 0) {
    return {
      paragraphs: [
        paragraph(
          context.kind === "free"
            ? `${describeCatalogueUnavailable(context)} No frames are loaded to compare.`
            : "No detector comparison is available yet.",
        ),
        framesNotLoadedParagraph(context),
      ],
      confidence: { level: "low", reason: "Low: no frames or checks are available." },
    };
  }
  return {
    paragraphs,
    confidence: {
      level: "medium",
      reason: best
        ? "Medium: ranked by saturation only; the best detector depends on what you measure."
        : "Medium: from separate science checks, not computed from loaded frames.",
    },
  };
}

export function answerSaturation(context: GuideContext): GuideAnswer {
  if (context.kind === "none") {
    return noTargetAnswer();
  }
  const paragraphs: AnswerParagraph[] = [];
  const saturated = context.detectors.filter(
    (summary) => (summary.meanSaturatedFraction ?? 0) > 0 || summary.saturatedPixelCount > 0,
  );
  if (context.detectors.length > 0) {
    const verdict: AnswerPart[] =
      saturated.length === 0
        ? [textPart("The loaded frames flag no saturated pixels.")]
        : [
            textPart("The loaded frames flag saturation in "),
            ...joinWithCitations(saturated.map((summary) => summary.detector)),
            textPart("."),
          ];
    paragraphs.push({ parts: verdict });
    const listing: AnswerPart[] = [textPart("Mean saturated fraction of the exposures: ")];
    context.detectors.forEach((summary, index) => {
      listing.push(
        textPart(index > 0 ? ", " : ""),
        detectorCitation(summary.detector),
        textPart(` ${describeFraction(summary)}`),
      );
    });
    listing.push(
      textPart(". A saturated core means brightness is a lower bound; the position stays usable."),
    );
    paragraphs.push({ parts: listing });
  }
  if (context.notes?.saturation) {
    paragraphs.push(
      noteParagraph(
        "A separate science check notes: ",
        context.notes.saturation,
        context.notes.detectors,
      ),
    );
  }
  if (paragraphs.length === 0) {
    return {
      paragraphs: [
        paragraph(
          context.kind === "free"
            ? `${describeCatalogueUnavailable(context)} No frames are loaded.`
            : "Saturation is not available yet.",
        ),
        framesNotLoadedParagraph(context),
      ],
      confidence: { level: "low", reason: "Low: no frames or checks are available." },
    };
  }
  return {
    paragraphs,
    confidence:
      context.detectors.length > 0
        ? { level: "high", reason: "High: read from the saturation flags of the loaded frames." }
        : { level: "medium", reason: "Medium: from separate science checks, not loaded frames." },
  };
}

function describeEpochs(summary: DetectorSummary): AnswerParagraph {
  const parts: AnswerPart[] = [textPart(`Epochs in D${summary.detector}: `)];
  summary.frames.forEach((frame, index) => {
    parts.push(
      textPart(index > 0 ? "; " : ""),
      epochCitation(frame.epoch_number, index),
      textPart(
        ` ${formatEpochDates(frame.start_date, frame.end_date)}, ${frame.exposure_count} exposures`,
      ),
    );
  });
  parts.push(textPart("."));
  return { parts };
}

export function answerObservationCount(context: GuideContext): GuideAnswer {
  if (context.kind === "none") {
    return noTargetAnswer();
  }
  const paragraphs: AnswerParagraph[] = [];
  const selected = framesOfSelectedDetector(context);
  if (selected) {
    const total = context.detectors.reduce((sum, summary) => sum + summary.exposureCount, 0);
    const frameTotal = context.detectors.reduce((sum, summary) => sum + summary.frames.length, 0);
    const counts: AnswerPart[] = [
      textPart(
        `${total} exposures in ${frameTotal} frames across ${context.detectors.length} of ` +
          `${DETECTOR_COUNT} detectors loaded: `,
      ),
    ];
    context.detectors.forEach((summary, index) => {
      counts.push(
        textPart(index > 0 ? ", " : ""),
        detectorCitation(summary.detector),
        textPart(` ${summary.exposureCount}`),
      );
    });
    counts.push(textPart(". Each exposure is plotted in the "), spectrumCitation(), textPart("."));
    paragraphs.push({ parts: counts }, describeEpochs(selected));
  }
  if (context.notes?.observations) {
    paragraphs.push(paragraph(context.notes.observations));
  }
  if (paragraphs.length === 0) {
    return {
      paragraphs: [
        paragraph(
          context.kind === "free"
            ? "No frames are loaded, so there is nothing to count."
            : "The number of observations is not available yet.",
        ),
        framesNotLoadedParagraph(context),
      ],
      confidence: { level: "low", reason: "Low: no frames are loaded." },
    };
  }
  return {
    paragraphs,
    confidence: selected
      ? { level: "high", reason: "High: counted from the loaded frames." }
      : { level: "medium", reason: "Medium: from a separate science check." },
  };
}

export function answerDataSource(context: GuideContext): GuideAnswer {
  if (context.kind === "none") {
    return noTargetAnswer();
  }
  const paragraphs: AnswerParagraph[] = [];
  const selected = framesOfSelectedDetector(context);
  if (selected) {
    const releases = [...new Set(selected.frames.flatMap((frame) => frame.data_releases))].sort();
    paragraphs.push(
      paragraph(
        `Images are SPHEREx spectral images from NASA/IPAC IRSA (${describeReleases(releases)}). ` +
          formatFrameSource(selected.response),
      ),
    );
    if (selected.response.citations.length > 0) {
      paragraphs.push(paragraph(`Citations: ${selected.response.citations.join("; ")}`));
    }
  }
  const { facts } = context;
  if (facts) {
    paragraphs.push(
      paragraph(
        `Position and proper motion: ${facts.catalogue_source_id}; distance: ${facts.distance_source}. `,
        catalogueCitation(facts.catalogue_source_id),
      ),
    );
  } else {
    paragraphs.push(paragraph(describeCatalogueUnavailable(context)));
  }
  if (!selected) {
    paragraphs.push(framesNotLoadedParagraph(context));
  }
  return {
    paragraphs,
    confidence:
      selected && facts
        ? { level: "high", reason: "High: read from the provenance fields of the data." }
        : { level: "medium", reason: "Medium: only part of the provenance is available." },
  };
}

export function answerLimits(context: GuideContext): GuideAnswer {
  if (context.kind === "none") {
    return noTargetAnswer();
  }
  const paragraphs: AnswerParagraph[] = [
    paragraph(
      "The frames show real SPHEREx pixels and catalogue positions. The guide does not identify " +
        "or classify anything new and never claims a discovery; a candidate would need " +
        "independent checks.",
    ),
  ];
  const selected = framesOfSelectedDetector(context);
  if (selected) {
    paragraphs.push(
      paragraph(
        `Each pixel covers ${selected.response.grid.pixel_scale_arcseconds}″ and there are ` +
          `${selected.frames.length} epochs, so small shifts are hard to resolve and the ` +
          "predicted-position marker is a catalogue prediction, not a fitted centre.",
      ),
    );
  }
  if (context.kind === "free") {
    paragraphs.push(paragraph(describeCatalogueUnavailable(context)));
  }
  for (const limit of context.notes?.limits ?? []) {
    paragraphs.push(paragraph(limit));
  }
  return {
    paragraphs,
    confidence: selected
      ? { level: "high", reason: "High: limits follow from the data and the science checks." }
      : { level: "medium", reason: "Medium: general limits only; no frames are loaded." },
  };
}
