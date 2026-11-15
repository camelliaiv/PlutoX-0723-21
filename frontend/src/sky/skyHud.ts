import { describeDetectorBand, DETECTOR_BANDS } from "../detectors";
import { createElement } from "../dom";
import type { SkyManifest } from "./skyAssets";
import { formatDistance, SKY_TARGETS, type SkyTarget } from "./skyTargets";

export const FIRST_VISIT_HINT =
  "Explore the sky. Travel through observations. Discover what changes.";

const GAIA_MAGNITUDE_LIMIT = "8.5";
const NEARBY_DISTANCE_PARSECS_TEXT = "17";
const NARROW_HINT_VISIBLE_MILLISECONDS = 4000;
const HINT_VISIBLE_MILLISECONDS = 7000;
const TOUR_IDLE_TEXT = "▶ Tour the five targets";
const TOUR_RUNNING_TEXT = "■ Stop tour";

export interface SkyHudHandlers {
  onSelectTarget(slug: string): void;
  onToggleTour(): void;
  onResetView(): void;
  onOpenInTimeMachine(slug: string): void;
  onCloseCard(): void;
}

export interface TooltipContent {
  title: string;
  lines: string[];
  note?: string;
  monospaceLines: boolean;
}

export interface SkyHud {
  element: HTMLElement;
  setScale(label: string, widthPixels: number): void;
  setReadout(text: string): void;
  setLoading(fraction: number | null): void;
  showLoadingError(message: string, onRetry: () => void): void;
  showCard(target: SkyTarget): void;
  hideCard(): void;
  setSelectedChip(slug: string | null): void;
  setTourRunning(running: boolean): void;
  showFirstVisitHint(): void;
  hideFirstVisitHint(): void;
  setAboutOpen(open: boolean): void;
  isAboutOpen(): boolean;
  showTooltip(content: TooltipContent, clientX: number, clientY: number): void;
  hideTooltip(): void;
  announce(message: string): void;
  describeAbout(manifest: SkyManifest): void;
}

function createButton(text: string, className: string, handler: () => void): HTMLButtonElement {
  const button = createElement("button", text);
  button.type = "button";
  button.className = className;
  button.addEventListener("click", handler);
  return button;
}

function createCloseButton(label: string, handler: () => void): HTMLButtonElement {
  const button = createButton("×", "glass-button card-close", handler);
  button.setAttribute("aria-label", label);
  return button;
}

function buildChips(
  container: HTMLElement,
  onSelect: (slug: string) => void,
): Map<string, HTMLButtonElement> {
  const chips = new Map<string, HTMLButtonElement>();
  for (const target of SKY_TARGETS) {
    const chip = createButton("", "target-chip", () => onSelect(target.slug));
    chip.setAttribute("aria-pressed", "false");
    const dot = createElement("span");
    dot.className = "target-chip-dot";
    const distance = createElement(
      "small",
      target.distanceParsecs === null ? "? pc" : `${target.distanceParsecs.toFixed(1)} pc`,
    );
    chip.append(dot, document.createTextNode(`${target.name} `), distance);
    chips.set(target.slug, chip);
    container.append(chip);
  }
  return chips;
}

function appendDefinition(list: HTMLElement, term: string, description: string): void {
  const termElement = createElement("dt", term);
  const descriptionElement = createElement("dd", description);
  list.append(termElement, descriptionElement);
}

export function createSkyHud(handlers: SkyHudHandlers): SkyHud {
  const hud = createElement("div");
  hud.className = "sky-hud";

  const chipContainer = createElement("div");
  chipContainer.className = "sky-chips";
  chipContainer.setAttribute("role", "group");
  chipContainer.setAttribute("aria-label", "Fly to a challenge target");
  const chips = buildChips(chipContainer, handlers.onSelectTarget);

  const tourBar = createElement("div");
  tourBar.className = "sky-tour-bar";
  const tourButton = createButton(TOUR_IDLE_TEXT, "glass-button", handlers.onToggleTour);
  tourButton.setAttribute("aria-pressed", "false");
  const resetButton = createButton(
    "Reset view",
    "glass-button glass-button-quiet",
    handlers.onResetView,
  );
  tourBar.append(tourButton, resetButton);

  const scaleElement = createElement("div");
  scaleElement.className = "sky-scale";
  const scaleLabel = createElement("span");
  const scaleBar = createElement("i");
  scaleElement.append(scaleLabel, scaleBar);

  const hint = createElement("div");
  hint.className = "sky-hint";
  const hintText = createElement("span", "Drag to rotate · scroll or pinch to zoom");
  const readout = createElement("span");
  readout.className = "sky-readout";
  hint.append(hintText, createElement("br"), readout);

  const firstVisitHint = createElement("div", FIRST_VISIT_HINT);
  firstVisitHint.className = "sky-first-visit-hint glass-panel";
  firstVisitHint.setAttribute("role", "note");
  firstVisitHint.addEventListener("click", () => {
    firstVisitHint.classList.remove("sky-first-visit-hint-visible");
  });
  let hintTimer: number | null = null;

  const card = createElement("div");
  card.className = "sky-card glass-panel";
  card.hidden = true;
  card.setAttribute("role", "dialog");
  card.setAttribute("aria-label", "Target card");

  const about = createElement("div");
  about.className = "sky-about glass-panel";
  about.hidden = true;
  about.setAttribute("role", "dialog");
  about.setAttribute("aria-label", "About the sky");

  const credit = createElement("div");
  credit.className = "sky-credit";
  const aboutButton = createElement("button", "About the sky");
  aboutButton.type = "button";
  aboutButton.setAttribute("aria-expanded", "false");
  aboutButton.addEventListener("click", () => setAboutOpen(!isAboutOpen()));
  credit.append(
    document.createTextNode(
      "Milky Way image: ESA/Gaia/DPAC (CC BY-SA 3.0 IGO), A. Moitinho · Stars: Gaia DR3 · Brightest stars: Hipparcos, ESA · ",
    ),
    aboutButton,
  );

  const loading = createElement("div");
  loading.className = "sky-loading glass-panel";
  loading.setAttribute("role", "status");
  loading.hidden = true;
  const loadingText = createElement("p");
  const loadingBar = createElement("progress");
  loadingBar.max = 100;
  let loadingRetryHandler: () => void = () => undefined;
  const loadingRetry = createButton("Try again", "glass-button retry-button", () =>
    loadingRetryHandler(),
  );
  loadingRetry.hidden = true;
  loading.append(loadingText, loadingBar, loadingRetry);

  const tooltip = createElement("div");
  tooltip.className = "sky-tooltip";
  tooltip.setAttribute("role", "tooltip");

  const announcer = createElement("p");
  announcer.className = "visually-hidden";
  announcer.setAttribute("aria-live", "polite");

  hud.append(
    chipContainer,
    tourBar,
    scaleElement,
    hint,
    firstVisitHint,
    card,
    about,
    credit,
    loading,
    tooltip,
    announcer,
  );

  function isAboutOpen(): boolean {
    return !about.hidden;
  }

  function setAboutOpen(open: boolean): void {
    about.hidden = !open;
    aboutButton.setAttribute("aria-expanded", String(open));
  }

  return {
    element: hud,
    setScale(label: string, widthPixels: number): void {
      if (scaleLabel.textContent !== label) {
        scaleLabel.textContent = label;
      }
      scaleBar.style.width = `${widthPixels}px`;
    },
    setReadout(text: string): void {
      if (readout.textContent !== text) {
        readout.textContent = text;
      }
    },
    setLoading(fraction: number | null): void {
      loading.hidden = fraction === null;
      loadingBar.hidden = false;
      loadingRetry.hidden = true;
      loading.setAttribute("role", "status");
      if (fraction !== null) {
        const percent = Math.round(fraction * 100);
        loadingText.textContent = `Loading the sky: star catalogue and Milky Way image… ${percent} %`;
        loadingBar.value = percent;
      }
    },
    showLoadingError(message: string, onRetry: () => void): void {
      loading.hidden = false;
      loadingBar.hidden = true;
      loadingText.textContent = message;
      loading.setAttribute("role", "alert");
      loadingRetry.hidden = false;
      loadingRetryHandler = onRetry;
    },
    showCard(target: SkyTarget): void {
      const detector = DETECTOR_BANDS.find((band) => band.number === target.defaultDetector);
      const title = createElement("h2", target.name);
      const subtitle = createElement("div", "Challenge target");
      subtitle.className = "sky-card-source";
      const details = createElement("dl");
      appendDefinition(
        details,
        "Position",
        `${target.rightAscensionDegrees.toFixed(4)}°, ${target.declinationDegrees.toFixed(4)}°`,
      );
      appendDefinition(
        details,
        "Distance",
        target.distanceParsecs === null
          ? "not in Gaia DR3"
          : formatDistance(target.distanceParsecs, 3, 2),
      );
      appendDefinition(details, "Source", target.distanceSource);
      appendDefinition(
        details,
        "Detector",
        detector
          ? `${describeDetectorBand(detector)} default`
          : `D${target.defaultDetector} default`,
      );
      const note = createElement("p", target.note);
      note.className = "sky-card-note";
      const openButton = createButton(
        "Open in the time machine →",
        "glass-button glass-button-primary",
        () => handlers.onOpenInTimeMachine(target.slug),
      );
      card.replaceChildren(
        createCloseButton("Close card", handlers.onCloseCard),
        title,
        subtitle,
        details,
        note,
        openButton,
      );
      card.hidden = false;
    },
    hideCard(): void {
      card.hidden = true;
    },
    setSelectedChip(slug: string | null): void {
      for (const [chipSlug, chip] of chips) {
        chip.setAttribute("aria-pressed", String(chipSlug === slug));
      }
    },
    setTourRunning(running: boolean): void {
      tourButton.setAttribute("aria-pressed", String(running));
      tourButton.textContent = running ? TOUR_RUNNING_TEXT : TOUR_IDLE_TEXT;
    },
    showFirstVisitHint(): void {
      firstVisitHint.classList.add("sky-first-visit-hint-visible");
      if (hintTimer !== null) {
        window.clearTimeout(hintTimer);
      }
      hintTimer = window.setTimeout(
        () => firstVisitHint.classList.remove("sky-first-visit-hint-visible"),
        window.matchMedia("(max-width: 760px)").matches
          ? NARROW_HINT_VISIBLE_MILLISECONDS
          : HINT_VISIBLE_MILLISECONDS,
      );
    },
    hideFirstVisitHint(): void {
      if (hintTimer !== null) {
        window.clearTimeout(hintTimer);
        hintTimer = null;
      }
      firstVisitHint.classList.remove("sky-first-visit-hint-visible");
    },
    setAboutOpen,
    isAboutOpen,
    showTooltip(content: TooltipContent, clientX: number, clientY: number): void {
      const title = createElement("strong", content.title);
      const lines = content.lines.map((line) => {
        const lineElement = createElement("div", line);
        if (content.monospaceLines) {
          lineElement.className = "sky-tooltip-mono";
        }
        return lineElement;
      });
      tooltip.replaceChildren(title, ...lines);
      if (content.note) {
        const note = createElement("div", content.note);
        note.className = "sky-tooltip-note";
        tooltip.append(note);
      }
      tooltip.style.left = `${Math.min(clientX, window.innerWidth - 300)}px`;
      tooltip.style.top = `${clientY}px`;
      tooltip.classList.add("sky-tooltip-visible");
    },
    hideTooltip(): void {
      tooltip.classList.remove("sky-tooltip-visible");
    },
    announce(message: string): void {
      announcer.textContent = message;
    },
    describeAbout(manifest: SkyManifest): void {
      const added = manifest.brightStars.count;
      const paragraphs = [
        `The stars are the ${manifest.stars.brightGaiaCount.toLocaleString("en")} Gaia DR3 stars brighter than G = ${GAIA_MAGNITUDE_LIMIT}, plus ${manifest.stars.nearbyCount.toLocaleString("en")} nearby stars closer than about ${NEARBY_DISTANCE_PARSECS_TEXT} parsecs. Stars with a reliable distance sit at their true 3D position with the Sun at the origin, and their brightness is recomputed from absolute magnitude and distance for the current camera position, so flying toward a star brightens it. Stars without a reliable distance sit on a far background shell at their catalogue magnitude.`,
        `Star colours come from the Gaia BP-RP colour, converted to an approximate temperature and a blackbody colour, with the saturation reduced. Interstellar reddening is not corrected. Stars fainter than G = ${GAIA_MAGNITUDE_LIMIT} are not shown, except the nearby ones.`,
        "The Milky Way band is the ESA Gaia EDR3 all-sky colour map, shown unmodified except for overall brightness, wrapped around the sky in galactic coordinates and rotated into the equatorial frame.",
        `Gaia misses the very brightest stars, so ${added} stars from the Hipparcos catalogue are added. ${manifest.brightStars.skippedDuplicateCount} of the ${manifest.brightStars.catalogueCount} Hipparcos stars are skipped because Gaia already has the star within 2 arcminutes. Their colour comes from B-V through the Ballesteros (2012) temperature relation; their magnitude is the Hipparcos Hp magnitude and positions are epoch 1991.25.`,
      ];
      const heading = createElement("h3", "About the sky");
      const credits = createElement(
        "p",
        `Credit: ${manifest.credits.milkyWay}. ${manifest.credits.hipparcos}. ${manifest.credits.gaia}.`,
      );
      credits.className = "sky-about-credit";
      about.replaceChildren(
        createCloseButton("Close note", () => setAboutOpen(false)),
        heading,
        ...paragraphs.map((paragraph) => createElement("p", paragraph)),
        credits,
      );
    },
  };
}
