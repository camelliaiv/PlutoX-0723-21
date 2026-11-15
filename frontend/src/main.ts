import "./style.css";
import type { ChallengeAction } from "./challengeItems";
import { createChallengePanel } from "./challengePanel";
import { buildShareLink, planChallengeAction } from "./challengePlan";
import { requireElement } from "./dom";
import { createFramesCache } from "./framesCache";
import { createGuideView } from "./guide/guideView";
import type { GuideAction } from "./guide/guideTypes";
import { createLogo } from "./logo";
import { createPixelScaleView } from "./pixelScaleView";
import { createSheets } from "./sheets";
import { createSkyView } from "./sky/skyView";
import { createTimeMachine } from "./timeMachine";
import { buildViewQuery, readViewFromUrl, type ViewState } from "./urlState";
import { createViewSwitch } from "./viewSwitch";
import { DEFAULT_APP_VIEW, readAppViewFromUrl, withAppView, type AppView } from "./viewState";
import { createWelcome } from "./welcome";

const logoButton = requireElement<HTMLButtonElement>("#logo-button");
const appShell = requireElement<HTMLElement>("#app-shell");

let activeAppView: AppView = readAppViewFromUrl(location.search);

function writeUrl(view: ViewState): void {
  history.replaceState(
    null,
    "",
    location.pathname + withAppView(buildViewQuery(view), activeAppView),
  );
}

const framesCache = createFramesCache();
const timeMachine = createTimeMachine({
  framesCache,
  onViewChange: writeUrl,
  onCoordinateSearch: (rightAscensionText, declinationText) =>
    skyView.showUserPosition(rightAscensionText, declinationText),
  onStateChange: () => {
    pixelScaleView.refresh();
    followTimeMachineTarget();
    guideView.refresh();
  },
});
const pixelScaleView = createPixelScaleView({
  framesCache,
  timeMachine,
  onShowInTimeMachine: showTimeMachine,
});
const guideView = createGuideView({
  framesCache,
  timeMachine,
  onNavigate: navigateFromGuide,
});
let lastTimeMachineTargetSlug: string | null = null;

function followTimeMachineTarget(): void {
  const targetSlug = timeMachine.currentView().targetSlug;
  if (targetSlug !== lastTimeMachineTargetSlug) {
    lastTimeMachineTargetSlug = targetSlug;
    guideView.setTarget(targetSlug);
  }
}

framesCache.subscribe(() => guideView.refresh());

const welcome = createWelcome(appShell);
const skyView = createSkyView({
  onOpenInTimeMachine: openInTimeMachine,
  onTargetSelected: (targetSlug) => guideView.setTarget(targetSlug),
});

function applyAppView(appView: AppView): void {
  activeAppView = appView;
  skyView.setActive(appView === "sky");
  timeMachine.setActive(appView === "time");
  pixelScaleView.setActive(appView === "pixel");
}

const viewSwitch = createViewSwitch((appView) => {
  applyAppView(appView);
  writeUrl(timeMachine.currentView());
});

function showAppView(appView: AppView): void {
  applyAppView(appView);
  viewSwitch.select(appView);
}

function showTimeMachine(): void {
  showAppView("time");
  writeUrl(timeMachine.currentView());
  window.scrollTo(0, 0);
}

function openInTimeMachine(targetSlug: string): void {
  timeMachine.openTarget(targetSlug);
  showAppView("time");
  writeUrl(timeMachine.currentView());
  window.scrollTo(0, 0);
}

function navigateFromGuide(action: GuideAction, targetSlug: string | null): void {
  switch (action.kind) {
    case "epoch":
      timeMachine.selectFrame(timeMachine.currentSelection().detector, action.epochIndex);
      showTimeMachine();
      break;
    case "detector":
      timeMachine.selectFrame(action.detector, timeMachine.currentSelection().epochIndex);
      showTimeMachine();
      break;
    case "spectrum":
      showAppView("pixel");
      writeUrl(timeMachine.currentView());
      window.scrollTo(0, 0);
      break;
    case "timeMachine":
      if (targetSlug === null) {
        showTimeMachine();
      } else {
        openInTimeMachine(targetSlug);
      }
      break;
    case "catalogue":
      break;
  }
}

function playWelcome(): void {
  skyView.beginIntro();
  welcome.play((dismissal) => {
    skyView.endIntro();
    if (dismissal === "keyboard") {
      viewSwitch.focusSelectedTab();
    }
  });
}

function restartApp(): void {
  timeMachine.reset();
  lastTimeMachineTargetSlug = null;
  guideView.setTarget(null);
  history.replaceState(null, "", location.pathname);
  skyView.restart();
  showAppView(DEFAULT_APP_VIEW);
  window.scrollTo(0, 0);
  playWelcome();
}

logoButton.append(createLogo("header"));
logoButton.addEventListener("click", restartApp);

const sheets = createSheets({ onGuideOpen: () => guideView.prepare() });

async function copyShareLink(): Promise<string> {
  const link = buildShareLink(location.origin + location.pathname, timeMachine.currentView());
  try {
    await navigator.clipboard.writeText(link);
    return `Link copied: ${link}`;
  } catch {
    return `Copying was not possible. The link is: ${link}`;
  }
}

async function runChallengeAction(action: ChallengeAction): Promise<string> {
  const plan = planChallengeAction(action);
  if (plan.copyLink) {
    return copyShareLink();
  }
  if (plan.timeMachineTargetSlug !== null) {
    timeMachine.openTarget(plan.timeMachineTargetSlug, plan.epochIndex);
  }
  if (Object.keys(plan.settingsChange).length > 0) {
    timeMachine.applySettings(plan.settingsChange);
  }
  if (plan.skyTargetSlug !== null) {
    showAppView("sky");
    writeUrl(timeMachine.currentView());
    skyView.flyToTarget(plan.skyTargetSlug);
  } else if (plan.appView === "pixel") {
    showAppView("pixel");
    writeUrl(timeMachine.currentView());
    window.scrollTo(0, 0);
  } else {
    showTimeMachine();
  }
  if (plan.focusCoordinates) {
    requireElement<HTMLInputElement>("#right-ascension-input").focus();
  }
  if (plan.closePanel) {
    sheets.closeAll();
  }
  return plan.announcement;
}

createChallengePanel({ onAction: runChallengeAction });
timeMachine.restore(readViewFromUrl(location.search));
showAppView(activeAppView);
playWelcome();
