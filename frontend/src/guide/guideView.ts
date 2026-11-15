import { fetchTargets, type TargetFacts } from "../api";
import { createElement, requireElement } from "../dom";
import type { FramesCache } from "../framesCache";
import type { TimeMachine } from "../timeMachine";
import { buildGuideContext, type GuideContext } from "./guideContext";
import { GUIDE_QUESTIONS, type QuestionIdentifier } from "./guideQuestions";
import type { AnswerPart, GuideAction, GuideAnswer } from "./guideTypes";

export interface GuideViewOptions {
  framesCache: FramesCache;
  timeMachine: Pick<TimeMachine, "currentView" | "currentSelection">;
  onNavigate(action: GuideAction, targetSlug: string | null): void;
}

export interface GuideView {
  setTarget(targetSlug: string | null): void;
  refresh(): void;
  prepare(): void;
}

const PROMPT_TEXT = "Pick a question.";

function createCitationButton(
  part: Extract<AnswerPart, { kind: "citation" }>,
  onActivate: (action: GuideAction) => void,
): HTMLButtonElement {
  const button = createElement("button", `[${part.label}]`);
  button.type = "button";
  button.className = "guide-citation";
  button.addEventListener("click", () => onActivate(part.action));
  return button;
}

function createConfidenceLabel(answer: GuideAnswer): HTMLElement {
  const label = createElement("span", answer.confidence.reason);
  label.className = `guide-confidence guide-confidence-${answer.confidence.level}`;
  return label;
}

export function createGuideView(options: GuideViewOptions): GuideView {
  const targetLine = requireElement<HTMLElement>("#guide-target");
  const questionList = requireElement<HTMLElement>("#guide-questions");
  const answerRegion = requireElement<HTMLElement>("#guide-answer");

  let targetSlug: string | null = null;
  let targetFacts: ReadonlyMap<string, TargetFacts> | null = null;
  let isFetchingFacts = false;
  let selectedQuestion: QuestionIdentifier | null = null;
  let renderedSignature = "";

  const questionButtons = new Map<QuestionIdentifier, HTMLButtonElement>();
  for (const question of GUIDE_QUESTIONS) {
    const button = createElement("button", question.label);
    button.type = "button";
    button.className = "guide-question";
    button.setAttribute("aria-pressed", "false");
    button.addEventListener("click", () => {
      selectedQuestion = question.identifier;
      renderedSignature = "";
      refresh();
    });
    questionButtons.set(question.identifier, button);
    questionList.append(button);
  }

  function currentContext(): GuideContext {
    const view = options.timeMachine.currentView();
    return buildGuideContext({
      targetSlug,
      hasFreeCoordinates:
        targetSlug === null &&
        view.targetSlug === null &&
        view.coordinates.rightAscension !== "" &&
        view.coordinates.declination !== "",
      targetFacts,
      loadedFrames: options.framesCache.all(),
      areFramesForTarget: view.targetSlug === targetSlug,
      selectedDetector: options.timeMachine.currentSelection().detector,
    });
  }

  function showSourceIdentifier(sourceIdentifier: string): void {
    answerRegion.querySelector(".guide-source-note")?.remove();
    const note = createElement("p", `Catalogue source: ${sourceIdentifier}`);
    note.className = "guide-source-note mono";
    answerRegion.insertBefore(note, answerRegion.lastElementChild);
  }

  function activate(action: GuideAction): void {
    if (action.kind === "catalogue") {
      showSourceIdentifier(action.sourceIdentifier);
      return;
    }
    options.onNavigate(action, targetSlug);
  }

  function renderAnswer(answer: GuideAnswer): void {
    const elements: HTMLElement[] = answer.paragraphs.map((answerParagraph) => {
      const element = createElement("p");
      for (const part of answerParagraph.parts) {
        element.append(
          part.kind === "text"
            ? document.createTextNode(part.text)
            : createCitationButton(part, activate),
        );
      }
      return element;
    });
    answerRegion.replaceChildren(...elements, createConfidenceLabel(answer));
  }

  function refresh(): void {
    const context = currentContext();
    targetLine.textContent = `About: ${context.targetName}`;
    for (const [identifier, button] of questionButtons) {
      button.setAttribute("aria-pressed", String(identifier === selectedQuestion));
    }
    const question = GUIDE_QUESTIONS.find((item) => item.identifier === selectedQuestion);
    if (!question) {
      answerRegion.textContent = PROMPT_TEXT;
      renderedSignature = "";
      return;
    }
    const answer = question.answer(context);
    const signature = JSON.stringify([context.targetName, question.identifier, answer]);
    if (signature !== renderedSignature) {
      renderedSignature = signature;
      renderAnswer(answer);
    }
  }

  function loadTargetFacts(): void {
    if (targetFacts !== null || isFetchingFacts) {
      return;
    }
    isFetchingFacts = true;
    fetchTargets(new AbortController().signal)
      .then((response) => {
        targetFacts = new Map(response.targets.map((facts) => [facts.slug, facts]));
      })
      .catch(() => undefined)
      .finally(() => {
        isFetchingFacts = false;
        refresh();
      });
  }

  loadTargetFacts();
  refresh();

  return {
    setTarget(newTargetSlug): void {
      targetSlug = newTargetSlug;
      refresh();
    },
    refresh,
    prepare(): void {
      loadTargetFacts();
      refresh();
    },
  };
}
