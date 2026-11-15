import { describe, expect, it } from "vitest";
import type { GuideContext } from "./guideContext";
import {
  BARNARDS_STAR_FACTS,
  EPSILON_INDI_B_FACTS,
  WISE_FACTS,
  makeChallengeContext,
  makeEmptyContext,
  makeFreeContext,
} from "./guideFixtures";
import { GUIDE_QUESTIONS, type QuestionIdentifier } from "./guideQuestions";
import type { GuideAnswer } from "./guideTypes";

function answerText(answer: GuideAnswer): string {
  return answer.paragraphs
    .flatMap((answerParagraph) =>
      answerParagraph.parts.map((part) => (part.kind === "text" ? part.text : `[${part.label}]`)),
    )
    .join("");
}

function ask(identifier: QuestionIdentifier, context: GuideContext): GuideAnswer {
  const question = GUIDE_QUESTIONS.find((item) => item.identifier === identifier);
  if (!question) {
    throw new Error(`Unknown question ${identifier}`);
  }
  return question.answer(context);
}

describe("guide questions", () => {
  it("offers the eight questions in the planned wording", () => {
    expect(GUIDE_QUESTIONS.map((question) => question.label)).toEqual([
      "What is this object?",
      "How far away is it?",
      "How fast does it move across the sky?",
      "Which detector shows it best?",
      "Is it saturated?",
      "How many SPHEREx observations are there?",
      "Where do the data come from?",
      "What can these data not tell us?",
    ]);
  });

  it("answers every question for every kind of subject without claiming a discovery", () => {
    const contexts = [
      makeChallengeContext(BARNARDS_STAR_FACTS, { 1: 0.9, 5: 0.1, 6: 0 }),
      makeChallengeContext(BARNARDS_STAR_FACTS),
      makeChallengeContext(null),
      makeChallengeContext(WISE_FACTS, { 5: 0 }),
      makeChallengeContext(EPSILON_INDI_B_FACTS, { 2: 0, 3: 0 }),
      makeFreeContext(true),
      makeFreeContext(false),
      makeEmptyContext(),
    ];
    for (const context of contexts) {
      for (const question of GUIDE_QUESTIONS) {
        const answer = question.answer(context);
        const text = answerText(answer);
        expect(text.length).toBeGreaterThan(10);
        expect(answer.confidence.reason).toMatch(/^(High|Medium|Low): /);
        expect(text).not.toMatch(/discovered|we found|new planet/i);
      }
    }
  });
});

describe("object answers", () => {
  it("states the catalogue position and source of a challenge target", () => {
    const answer = ask("what", makeChallengeContext(BARNARDS_STAR_FACTS));
    expect(answerText(answer)).toContain("Gaia DR3 4472832130942575872");
    expect(answerText(answer)).toContain("269.4485");
    expect(answer.confidence.level).toBe("high");
  });

  it("gives the distance with its source and says when there is none", () => {
    const known = ask("distance", makeChallengeContext(BARNARDS_STAR_FACTS));
    expect(answerText(known)).toContain("1.828 pc");
    expect(answerText(known)).toContain("light-years");
    const unknown = ask("distance", makeChallengeContext(WISE_FACTS));
    expect(answerText(unknown)).toContain("not in Gaia DR3");
    const sameSystem = ask("distance", makeChallengeContext(EPSILON_INDI_B_FACTS));
    expect(answerText(sameSystem)).toContain("Epsilon Indi A, same system");
  });

  it("separates the catalogue prediction from the measured check for Barnard's Star", () => {
    const answer = ask("speed", makeChallengeContext(BARNARDS_STAR_FACTS, { 5: 0.1 }));
    const text = answerText(answer);
    expect(text).toContain("10.39″ per year");
    expect(text).toContain("12.3″ north");
    expect(text).toContain("catalogue prediction, not a measurement from the pixels");
    expect(text).toContain("about 10.4″ over about 1 year");
    expect(answer.confidence.level).toBe("medium");
  });

  it("says what is missing for custom coordinates and for a missing catalogue", () => {
    const free = ask("speed", makeFreeContext(true));
    expect(answerText(free)).toContain("Catalogue facts are not available");
    expect(free.confidence.level).toBe("low");
    expect(answerText(ask("distance", makeFreeContext(true)))).toContain("not available");
    expect(answerText(ask("what", makeFreeContext(true)))).toContain("centred on RA");
    const missing = ask("distance", makeChallengeContext(null));
    expect(answerText(missing)).toContain("could not be loaded");
  });

  it("asks for a target when none is selected", () => {
    expect(answerText(ask("what", makeEmptyContext()))).toContain("No target is selected");
  });
});

describe("frame answers", () => {
  const context = makeChallengeContext(BARNARDS_STAR_FACTS, { 1: 0.9, 5: 0, 6: 0.2 });

  it("ranks detectors by saturation and cites them", () => {
    const answer = ask("best", context);
    const text = answerText(answer);
    expect(text).toContain("[D5] is least affected");
    expect(text).toContain("then [D6]");
    expect(answer.confidence.level).toBe("medium");
  });

  it("lists the saturated detectors from the flags", () => {
    const answer = ask("saturation", context);
    expect(answerText(answer)).toContain("saturation in [D1]");
    expect(answerText(answer)).toContain("[D5] 0.00");
    expect(answer.confidence.level).toBe("high");
  });

  it("counts exposures and epochs from the loaded frames", () => {
    const text = answerText(ask("count", context));
    expect(text).toContain("27 exposures in 6 frames across 3 of 6 detectors");
    expect(text).toContain("[epoch 1]");
    expect(text).toContain("[spectrum]");
  });

  it("names the data sources and the catalogue entry", () => {
    const answer = ask("source", context);
    const text = answerText(answer);
    expect(text).toContain("NASA/IPAC IRSA");
    expect(text).toContain("Data Release 1");
    expect(text).toContain("Gaia DR3 4472832130942575872");
    expect(answer.confidence.level).toBe("high");
  });

  it("states the limits and the per-target notes", () => {
    const text = answerText(ask("limits", context));
    expect(text).toContain("never claims a discovery");
    expect(text).toContain("lower bound");
  });

  it("falls back to the science notes when no frames are loaded", () => {
    const withoutFrames = makeChallengeContext(BARNARDS_STAR_FACTS);
    expect(answerText(ask("saturation", withoutFrames))).toContain("D1–D4");
    expect(ask("saturation", withoutFrames).confidence.level).toBe("medium");
    expect(answerText(ask("count", withoutFrames))).toContain("not available");
    expect(answerText(ask("best", makeFreeContext(false)))).toContain("not available");
  });

  it("reports Epsilon Indi B observations from the science notes", () => {
    const text = answerText(ask("count", makeChallengeContext(EPSILON_INDI_B_FACTS)));
    expect(text).toContain("four epochs, in D2, D3, D5 and D6");
  });

  it("answers the saturation question for WISE 0855 from the notes and the loaded frames", () => {
    const withoutFrames = answerText(ask("saturation", makeChallengeContext(WISE_FACTS)));
    expect(withoutFrames).toContain("no saturated pixels in almost all sampled exposures");
    const withFrames = answerText(ask("saturation", makeChallengeContext(WISE_FACTS, { 5: 0 })));
    expect(withFrames).toContain("The loaded frames flag no saturated pixels.");
    expect(withFrames).toContain("Essentially unsaturated in the science checks");
  });

  it("does not rank detectors when none is saturated", () => {
    const unsaturated = makeChallengeContext(EPSILON_INDI_B_FACTS, { 2: 0, 3: 0 });
    expect(answerText(ask("best", unsaturated))).toContain("do not separate");
  });
});
