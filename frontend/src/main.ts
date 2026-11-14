import "./style.css";
import { fetchObservations } from "./api";
import { CHALLENGE_TARGETS } from "./presets";
import { createElement } from "./dom";
import { renderResults } from "./render";
import {
  buildCoordinatesQuery,
  readCoordinatesFromUrl,
  type SkyCoordinatesInput,
} from "./urlState";

function requireElement<ElementType extends Element>(selector: string): ElementType {
  const element = document.querySelector<ElementType>(selector);
  if (!element) {
    throw new Error(`Required page element ${selector} is missing.`);
  }
  return element;
}

const searchForm = requireElement<HTMLFormElement>("#search-form");
const rightAscensionInput = requireElement<HTMLInputElement>("#right-ascension-input");
const declinationInput = requireElement<HTMLInputElement>("#declination-input");
const searchButton = requireElement<HTMLButtonElement>("#search-button");
const presetTargets = requireElement<HTMLDivElement>("#preset-targets");
const resultsPanel = requireElement<HTMLDivElement>("#results-panel");

let activeSearch: AbortController | null = null;

function showStatus(message: string): void {
  const statusMessage = createElement("p", message);
  statusMessage.className = "status";
  resultsPanel.replaceChildren(statusMessage);
}

function showError(message: string): void {
  const errorMessage = createElement("p", message);
  errorMessage.className = "error";
  errorMessage.setAttribute("role", "alert");
  resultsPanel.replaceChildren(errorMessage);
}

async function search(): Promise<void> {
  activeSearch?.abort();
  const currentSearch = new AbortController();
  activeSearch = currentSearch;

  const coordinates: SkyCoordinatesInput = {
    rightAscension: rightAscensionInput.value.trim(),
    declination: declinationInput.value.trim(),
  };
  history.replaceState(null, "", location.pathname + buildCoordinatesQuery(coordinates));
  showStatus("Querying IRSA…");
  searchButton.disabled = true;

  try {
    const response = await fetchObservations(coordinates, currentSearch.signal);
    resultsPanel.replaceChildren(renderResults(response));
  } catch (error) {
    if (!currentSearch.signal.aborted) {
      showError(error instanceof Error ? error.message : String(error));
    }
  } finally {
    if (activeSearch === currentSearch) {
      searchButton.disabled = false;
      activeSearch = null;
    }
  }
}

for (const challengeTarget of CHALLENGE_TARGETS) {
  const targetButton = createElement("button", challengeTarget.name);
  targetButton.type = "button";
  targetButton.className = "target-button";
  targetButton.title = challengeTarget.coordinateSource;
  targetButton.addEventListener("click", () => {
    rightAscensionInput.value = challengeTarget.coordinates.rightAscension;
    declinationInput.value = challengeTarget.coordinates.declination;
    void search();
  });
  presetTargets.append(targetButton);
}

searchForm.addEventListener("submit", (event) => {
  event.preventDefault();
  void search();
});

const coordinatesFromUrl = readCoordinatesFromUrl(location.search);
rightAscensionInput.value = coordinatesFromUrl.rightAscension;
declinationInput.value = coordinatesFromUrl.declination;
if (coordinatesFromUrl.rightAscension && coordinatesFromUrl.declination) {
  void search();
}
