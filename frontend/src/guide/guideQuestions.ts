import {
  answerBestDetector,
  answerDataSource,
  answerLimits,
  answerObservationCount,
  answerSaturation,
} from "./frameAnswers";
import type { GuideContext } from "./guideContext";
import type { GuideAnswer } from "./guideTypes";
import { answerDistance, answerSpeed, answerWhatIsIt } from "./objectAnswers";

export type QuestionIdentifier =
  "what" | "distance" | "speed" | "best" | "saturation" | "count" | "source" | "limits";

export interface GuideQuestion {
  identifier: QuestionIdentifier;
  label: string;
  answer(context: GuideContext): GuideAnswer;
}

export const GUIDE_QUESTIONS: readonly GuideQuestion[] = [
  { identifier: "what", label: "What is this object?", answer: answerWhatIsIt },
  { identifier: "distance", label: "How far away is it?", answer: answerDistance },
  { identifier: "speed", label: "How fast does it move across the sky?", answer: answerSpeed },
  { identifier: "best", label: "Which detector shows it best?", answer: answerBestDetector },
  { identifier: "saturation", label: "Is it saturated?", answer: answerSaturation },
  {
    identifier: "count",
    label: "How many SPHEREx observations are there?",
    answer: answerObservationCount,
  },
  { identifier: "source", label: "Where do the data come from?", answer: answerDataSource },
  { identifier: "limits", label: "What can these data not tell us?", answer: answerLimits },
];

export function findGuideQuestion(identifier: QuestionIdentifier): GuideQuestion | null {
  return GUIDE_QUESTIONS.find((question) => question.identifier === identifier) ?? null;
}
