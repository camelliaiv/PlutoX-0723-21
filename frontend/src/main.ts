import "./style.css";
import { fetchFrames, fetchObservations } from "./api";
import { DETECTOR_BANDS, describeDetectorBand } from "./detectors";
import { createElement, requireElement } from "./dom";
import { createFramesPlayer } from "./framesPlayer";
import {
  CHALLENGE_TARGETS,
  defaultDetectorFor,
  findChallengeTarget,
  FREE_COORDINATES_DETECTOR,
} from "./presets";
import { renderResults } from "./render";
import { buildViewQuery, parseDetector, readViewFromUrl, type ViewState } from "./urlState";

const searchForm = requireElement<HTMLFormElement>("#search-form");
const rightAscensionInput = requireElement<HTMLInputElement>("#right-ascension-input");
const declinationInput = requireElement<HTMLInputElement>("#declination-input");
const searchButton = requireElement<HTMLButtonElement>("#search-button");
const presetTargets = requireElement<HTMLDivElement>("#preset-targets");
const detectorSelect = requireElement<HTMLSelectElement>("#detector-select");
const resultsPanel = requireElement<HTMLDivElement>("#results-panel");

const framesPlayer = createFramesPlayer();
let activeSearch: AbortController | null = null;
let activeTargetSlug: string | null = null;

function showObservationsError(message: string): void {
  const errorMessage = createElement("p", message);
  errorMessage.className = "error";
  errorMessage.setAttribute("role", "alert");
  resultsPanel.replaceChildren(errorMessage);
}

function currentView(): ViewState {
  return {
    targetSlug: activeTargetSlug,
    detector: parseDetector(detectorSelect.value),
    coordinates: {
      rightAscension: rightAscensionInput.value.trim(),
      declination: declinationInput.value.trim(),
    },
  };
}

async function loadObservations(view: ViewState, signal: AbortSignal): Promise<void> {
  const statusMessage = createElement("p", "Querying IRSA…");
  statusMessage.className = "status";
  resultsPanel.replaceChildren(statusMessage);
  try {
    resultsPanel.replaceChildren(renderResults(await fetchObservations(view.coordinates, signal)));
  } catch (error) {
    if (!signal.aborted) {
      showObservationsError(error instanceof Error ? error.message : String(error));
    }
  }
}

async function loadFrames(view: ViewState, signal: AbortSignal): Promise<void> {
  framesPlayer.showLoading();
  try {
    const response = await fetchFrames(
      {
        detector: view.detector ?? FREE_COORDINATES_DETECTOR,
        targetSlug: view.targetSlug,
        coordinates: view.coordinates,
      },
      signal,
    );
    framesPlayer.showFrames(response, findChallengeTarget(view.targetSlug)?.notice);
  } catch (error) {
    if (!signal.aborted) {
      framesPlayer.showError(error instanceof Error ? error.message : String(error));
    }
  }
}

async function search(): Promise<void> {
  activeSearch?.abort();
  const currentSearch = new AbortController();
  activeSearch = currentSearch;

  const view = currentView();
  history.replaceState(null, "", location.pathname + buildViewQuery(view));
  searchButton.disabled = true;
  detectorSelect.disabled = true;

  try {
    await Promise.all([
      loadObservations(view, currentSearch.signal),
      loadFrames(view, currentSearch.signal),
    ]);
  } finally {
    if (activeSearch === currentSearch) {
      searchButton.disabled = false;
      detectorSelect.disabled = false;
      activeSearch = null;
    }
  }
}

function selectTarget(targetSlug: string | null, detector: number): void {
  activeTargetSlug = targetSlug;
  detectorSelect.value = String(detector);
}

for (const band of DETECTOR_BANDS) {
  const option = createElement("option", describeDetectorBand(band));
  option.value = String(band.number);
  detectorSelect.append(option);
}
detectorSelect.value = String(FREE_COORDINATES_DETECTOR);

for (const challengeTarget of CHALLENGE_TARGETS) {
  const targetButton = createElement("button", challengeTarget.name);
  targetButton.type = "button";
  targetButton.className = "target-button";
  targetButton.title = challengeTarget.coordinateSource;
  targetButton.addEventListener("click", () => {
    rightAscensionInput.value = challengeTarget.coordinates.rightAscension;
    declinationInput.value = challengeTarget.coordinates.declination;
    selectTarget(challengeTarget.slug, challengeTarget.defaultDetector);
    void search();
  });
  presetTargets.append(targetButton);
}

for (const coordinateInput of [rightAscensionInput, declinationInput]) {
  coordinateInput.addEventListener("input", () => {
    if (activeTargetSlug !== null) {
      selectTarget(null, FREE_COORDINATES_DETECTOR);
    }
  });
}

detectorSelect.addEventListener("change", () => void search());

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void search();
});

const viewFromUrl = readViewFromUrl(location.search);
const targetFromUrl = findChallengeTarget(viewFromUrl.targetSlug);
if (targetFromUrl) {
  rightAscensionInput.value = targetFromUrl.coordinates.rightAscension;
  declinationInput.value = targetFromUrl.coordinates.declination;
  selectTarget(targetFromUrl.slug, viewFromUrl.detector ?? targetFromUrl.defaultDetector);
  void search();
} else {
  rightAscensionInput.value = viewFromUrl.coordinates.rightAscension;
  declinationInput.value = viewFromUrl.coordinates.declination;
  selectTarget(null, viewFromUrl.detector ?? defaultDetectorFor(null));
  if (viewFromUrl.coordinates.rightAscension && viewFromUrl.coordinates.declination) {
    void search();
  }
}
