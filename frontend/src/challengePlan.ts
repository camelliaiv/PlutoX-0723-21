import type { ChallengeAction } from "./challengeItems";
import type { PlayerSettings } from "./playerSettings";
import { buildViewQuery, type ViewState } from "./urlState";
import { withAppView, type AppView } from "./viewState";

export interface ChallengePlan {
  appView: AppView;
  skyTargetSlug: string | null;
  timeMachineTargetSlug: string | null;
  epochIndex: number;
  settingsChange: Partial<PlayerSettings>;
  focusCoordinates: boolean;
  copyLink: boolean;
  closePanel: boolean;
  announcement: string;
}

const DEFAULT_LINK_TARGET_SLUG = "barnards_star";

const EMPTY_PLAN: ChallengePlan = {
  appView: "time",
  skyTargetSlug: null,
  timeMachineTargetSlug: null,
  epochIndex: 0,
  settingsChange: {},
  focusCoordinates: false,
  copyLink: false,
  closePanel: true,
  announcement: "",
};

export function planChallengeAction(action: ChallengeAction): ChallengePlan {
  switch (action.kind) {
    case "flyToTarget":
      return {
        ...EMPTY_PLAN,
        appView: "sky",
        skyTargetSlug: action.targetSlug,
        announcement: "Flying to the target in the 3D sky.",
      };
    case "openTimeMachine":
      return {
        ...EMPTY_PLAN,
        timeMachineTargetSlug: action.targetSlug,
        announcement: "Opened the Time machine.",
      };
    case "showMode":
      return {
        ...EMPTY_PLAN,
        timeMachineTargetSlug: action.targetSlug,
        epochIndex: action.epochIndex,
        settingsChange: { mode: action.mode },
        announcement: `Opened the Time machine in ${action.mode} mode.`,
      };
    case "showSaturationTint":
      return {
        ...EMPTY_PLAN,
        timeMachineTargetSlug: action.targetSlug,
        settingsChange: { showSaturation: true },
        announcement: "Opened the Time machine with saturated pixels tinted.",
      };
    case "showSpectrum":
      return { ...EMPTY_PLAN, appView: "pixel", announcement: "Opened the Pixel scale view." };
    case "focusCoordinates":
      return {
        ...EMPTY_PLAN,
        focusCoordinates: true,
        announcement: "Opened the Time machine search form.",
      };
    case "copyLink":
      return { ...EMPTY_PLAN, copyLink: true, closePanel: false };
  }
}

export function buildShareLink(pageAddress: string, view: ViewState): string {
  const hasSubject =
    view.targetSlug !== null ||
    (view.coordinates.rightAscension !== "" && view.coordinates.declination !== "");
  const subjectView: ViewState = hasSubject
    ? view
    : { ...view, targetSlug: DEFAULT_LINK_TARGET_SLUG };
  return `${pageAddress}${withAppView(buildViewQuery(subjectView), "time")}`;
}
