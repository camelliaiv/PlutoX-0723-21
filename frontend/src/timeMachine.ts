import { fetchFrames } from "./api";
import { ANNOTATION_COLOR } from "./canvasColors";
import { createElement, requireElement } from "./dom";
import { epochColor, ringStates } from "./epochRings";
import { createFilmstrip } from "./filmstrip";
import { fetchMissingDetectors, type FramesCache } from "./framesCache";
import { createPlayerCanvas, type PlayerCanvasState } from "./frameCanvas";
import { clearFrameLegend, showFrameLegend } from "./frameLegend";
import {
  describeSaturation,
  formatFramePlayerLabel,
  formatFrameSource,
  formatPlayerBadge,
  formatReferencePosition,
} from "./frameText";
import { describeLegend } from "./legendText";
import { describeLoading } from "./loadingText";
import { predictedPositionToImagePoint, type ImagePoint } from "./markers";
import {
  DEFAULT_SPEED_MULTIPLIER,
  intervalMilliseconds,
  keyboardActionFor,
  stepFrameIndex,
  type KeyboardAction,
} from "./playback";
import { createPlayerControls } from "./playerControls";
import { buildNotices } from "./playerNotices";
import { DEFAULT_PLAYER_SETTINGS, type PlayerSettings } from "./playerSettings";
import { describePixelReadout, EMPTY_PIXEL_READOUT } from "./pixelReadout";
import { buildPlayerPixels, prepareFrames, type PreparedFrames } from "./preparedFrames";
import {
  CHALLENGE_TARGETS,
  defaultDetectorFor,
  findChallengeTarget,
  FREE_COORDINATES_DETECTOR,
  type ChallengeTarget,
} from "./presets";
import { createTargetFacts } from "./targetFacts";
import type { ViewState } from "./urlState";
import {
  canvasToImage,
  centreAfterZoom,
  clampCentre,
  computePlayerLayout,
  nextZoom,
  pixelIndicesAt,
  type PlayerLayout,
} from "./viewport";
import { createWavelengthRail } from "./wavelengthRail";

export interface TimeMachineOptions {
  framesCache: FramesCache;
  onViewChange(view: ViewState): void;
  onStateChange(): void;
}

export interface FrameSelection {
  detector: number;
  epochIndex: number;
}

export interface LoadStatus {
  message: string;
  isError: boolean;
}

export interface TimeMachine {
  restore(view: ViewState): void;
  openTarget(targetSlug: string, epochIndex?: number): void;
  applySettings(change: Partial<PlayerSettings>): void;
  currentView(): ViewState;
  currentSelection(): FrameSelection;
  loadStatus(): LoadStatus | null;
  selectFrame(detector: number, epochIndex: number): void;
  requestAllDetectors(): void;
  reset(): void;
  setActive(isActive: boolean): void;
}

const DEFAULT_TARGET_SLUG = "barnards_star";
const CUSTOM_COORDINATES_VALUE = "";
const CUSTOM_COORDINATES_LABEL = "Custom coordinates";
const NO_FRAMES_MESSAGE =
  "No SPHEREx frames could be built for this selection. Try another detector or position.";
const RESIZE_DEBOUNCE_MILLISECONDS = 150;
const NARROW_SCREEN_PIXELS = 760;

export function createTimeMachine(options: TimeMachineOptions): TimeMachine {
  const { framesCache } = options;
  const targetSelect = requireElement<HTMLSelectElement>("#target-select");
  const searchForm = requireElement<HTMLFormElement>("#search-form");
  const rightAscensionInput = requireElement<HTMLInputElement>("#right-ascension-input");
  const declinationInput = requireElement<HTMLInputElement>("#declination-input");
  const title = requireElement<HTMLElement>("#time-title");
  const subtitle = requireElement<HTMLElement>("#time-subtitle");
  const statusMessage = requireElement<HTMLElement>("#frames-status");
  const timeGrid = requireElement<HTMLElement>("#time-grid");
  const stage = requireElement<HTMLElement>(".time-stage");
  const ringFrame = requireElement<HTMLElement>("#ring-frame");
  const blueRing = requireElement<SVGElement>("#ring-blue");
  const orangeRing = requireElement<SVGElement>("#ring-orange");
  const frameCanvasElement = requireElement<HTMLCanvasElement>("#frame-canvas");
  const frameLabel = requireElement<HTMLElement>("#frame-label");
  const pixelReadout = requireElement<HTMLElement>("#pixel-readout");
  const saturationNotice = requireElement<HTMLElement>("#saturation-notice");
  const noticesContainer = requireElement<HTMLElement>("#frame-notices");
  const sourceLine = requireElement<HTMLElement>("#frame-source");
  const referenceLine = requireElement<HTMLElement>("#frame-reference");

  const playerCanvas = createPlayerCanvas(frameCanvasElement);
  const targetFacts = createTargetFacts();
  const wavelengthRail = createWavelengthRail({
    onSelectDetector: (detector) => selectDetector(detector, 0),
    onSelectEpoch: (detector, epochIndex) => selectDetector(detector, epochIndex),
  });
  const filmstrip = createFilmstrip((epochIndex) => selectEpoch(epochIndex));
  const controls = createPlayerControls({
    onTogglePlay: () => togglePlayback(),
    onPrevious: () => stepEpoch(-1),
    onNext: () => stepEpoch(1),
    onSpeedChange: (speedMultiplier) => {
      speed = speedMultiplier;
      if (playbackTimer !== null) {
        startPlayback();
      }
    },
    onSettingsChange: (change) => applySettings(change),
    onZoom: (direction) => zoomBy(direction),
  });

  let settings: PlayerSettings = DEFAULT_PLAYER_SETTINGS;
  let activeTargetSlug: string | null = null;
  let detector = FREE_COORDINATES_DETECTOR;
  let epochIndex = 0;
  let requestedEpochIndex = 0;
  let speed = DEFAULT_SPEED_MULTIPLIER;
  let playbackTimer: number | null = null;
  let isActive = false;
  let hasFailed = false;
  let activeRequest: AbortController | null = null;
  let currentLoadStatus: LoadStatus | null = null;
  let layout: PlayerLayout | null = null;
  let centre: ImagePoint = { x: 0, y: 0 };
  let hoveredPixel: { column: number; row: number } | null = null;
  let resizeTimer: number | null = null;

  const customOption = createElement("option", CUSTOM_COORDINATES_LABEL);
  customOption.value = CUSTOM_COORDINATES_VALUE;
  targetSelect.append(customOption);
  for (const challengeTarget of CHALLENGE_TARGETS) {
    const option = createElement("option", challengeTarget.name);
    option.value = challengeTarget.slug;
    targetSelect.append(option);
  }

  function currentPrepared(): PreparedFrames | null {
    return framesCache.get(detector) ?? null;
  }

  function currentCoordinates(): ViewState["coordinates"] {
    return {
      rightAscension: rightAscensionInput.value.trim(),
      declination: declinationInput.value.trim(),
    };
  }

  function currentView(): ViewState {
    return {
      targetSlug: activeTargetSlug,
      detector,
      coordinates: currentCoordinates(),
      settings,
    };
  }

  function notifyViewChange(): void {
    options.onViewChange(currentView());
  }

  function describeSubject(): string {
    const { rightAscension, declination } = currentCoordinates();
    return activeTargetSlug ?? `${rightAscension}|${declination}`;
  }

  function showStatus(message: string, isError: boolean): void {
    currentLoadStatus = { message, isError };
    statusMessage.hidden = false;
    statusMessage.className = isError ? "error" : "status";
    statusMessage.setAttribute("role", isError ? "alert" : "status");
    statusMessage.textContent = message;
    options.onStateChange();
  }

  function hideStatus(announcement: string): void {
    currentLoadStatus = null;
    statusMessage.className = "visually-hidden";
    statusMessage.setAttribute("role", "status");
    statusMessage.textContent = announcement;
  }

  function stopPlayback(): void {
    if (playbackTimer !== null) {
      window.clearInterval(playbackTimer);
      playbackTimer = null;
    }
    controls.showPlaying(false);
  }

  function startPlayback(): void {
    if (playbackTimer !== null) {
      window.clearInterval(playbackTimer);
    }
    playbackTimer = window.setInterval(() => stepEpoch(1), intervalMilliseconds(speed));
    controls.showPlaying(true);
  }

  function togglePlayback(): void {
    if (playbackTimer === null && currentPrepared()) {
      startPlayback();
    } else {
      stopPlayback();
    }
  }

  function computeLayout(): void {
    const prepared = currentPrepared();
    const availableWidth = stage.clientWidth;
    if (!prepared || availableWidth === 0) {
      return;
    }
    layout = computePlayerLayout(
      availableWidth,
      window.innerHeight,
      window.innerWidth < NARROW_SCREEN_PIXELS,
      prepared.response.grid.size_pixels,
    );
    ringFrame.style.setProperty("--ring-size", `${layout.ringSize}px`);
    ringFrame.style.setProperty("--canvas-size", `${layout.canvasSize}px`);
    playerCanvas.resize(layout.canvasSize);
  }

  function resetView(sizePixels: number): void {
    centre = { x: sizePixels / 2, y: sizePixels / 2 };
    hoveredPixel = null;
  }

  function updateRings(prepared: PreparedFrames): void {
    const states = ringStates(settings.mode, epochIndex, prepared.response.frames.length);
    for (const [ring, state] of [
      [blueRing, states.blue],
      [orangeRing, states.orange],
    ] as const) {
      ring.classList.toggle("time-ring-glowing", state.isGlowing);
      ring.style.opacity = String(state.opacity);
    }
  }

  function drawPlayer(): void {
    const prepared = currentPrepared();
    const frame = prepared?.response.frames[epochIndex];
    if (!prepared || !frame || !layout) {
      return;
    }
    const { response } = prepared;
    const state: PlayerCanvasState = {
      frames: response.frames,
      sizePixels: response.grid.size_pixels,
      pixelScaleArcseconds: response.grid.pixel_scale_arcseconds,
      pixels: buildPlayerPixels(prepared, epochIndex, settings),
      settings,
      epochIndex,
      centre,
      canvasSize: layout.canvasSize,
      hoveredPixel,
    };
    playerCanvas.draw(state);
    updateRings(prepared);

    const badge = createElement(
      "span",
      formatPlayerBadge(frame, settings.mode, epochIndex, response.frames.length),
    );
    badge.className = "epoch-badge";
    const badgeColor =
      settings.mode === "stack" ? ANNOTATION_COLOR : epochColor(epochIndex, response.frames.length);
    badge.style.setProperty("--epoch-color", badgeColor);
    frameLabel.replaceChildren(badge);
    frameCanvasElement.setAttribute(
      "aria-label",
      formatFramePlayerLabel(frame, settings.mode, epochIndex, response.frames.length),
    );
    showFrameLegend(describeLegend(prepared, settings, epochIndex));
  }

  function renderNotices(prepared: PreparedFrames): void {
    const { response } = prepared;
    const sizePixels = response.grid.size_pixels;
    const isOutside = response.frames.some(
      (frame) => predictedPositionToImagePoint(frame.predicted_position, sizePixels) === null,
    );
    const notices = buildNotices({
      targetNotice: findChallengeTarget(activeTargetSlug)?.notice,
      responseNotes: response.notes,
      mode: settings.mode,
      showMarker: settings.showMarker,
      isPredictedPositionOutside: isOutside,
    });
    const list = createElement("ul");
    list.append(...notices.map((notice) => createElement("li", notice)));
    noticesContainer.replaceChildren(...(notices.length > 0 ? [list] : []));

    const saturationText = describeSaturation(response.frames);
    saturationNotice.hidden = saturationText === null;
    saturationNotice.textContent =
      saturationText === null ? "" : `Saturation notice · D${detector}. ${saturationText}`;
  }

  function renderThumbnails(prepared: PreparedFrames): void {
    wavelengthRail.render(framesCache.all(), settings, detector, epochIndex);
    filmstrip.render(prepared, settings, epochIndex);
  }

  function renderSelection(prepared: PreparedFrames): void {
    wavelengthRail.highlight(detector, epochIndex);
    filmstrip.highlight(epochIndex);
    targetFacts.render(findChallengeTarget(activeTargetSlug), prepared, epochIndex);
  }

  function renderHeadings(prepared: PreparedFrames): void {
    const { response } = prepared;
    const exposureTotal = response.frames.reduce((total, frame) => total + frame.exposure_count, 0);
    title.textContent = findChallengeTarget(activeTargetSlug)?.name ?? CUSTOM_COORDINATES_LABEL;
    subtitle.textContent = `${exposureTotal} real exposures · ${response.frames.length} frames · D${detector}`;
    sourceLine.textContent = formatFrameSource(response);
    referenceLine.textContent = formatReferencePosition(response);
    targetSelect.value = activeTargetSlug ?? CUSTOM_COORDINATES_VALUE;
  }

  function showCurrentDetector(): void {
    const prepared = currentPrepared();
    if (!prepared) {
      return;
    }
    if (prepared.response.frames.length === 0) {
      timeGrid.hidden = true;
      showStatus(NO_FRAMES_MESSAGE, false);
      return;
    }
    hideStatus(`Frames loaded: ${prepared.response.frames.length} epochs, detector D${detector}.`);
    timeGrid.hidden = false;
    epochIndex = Math.min(epochIndex, prepared.response.frames.length - 1);
    resetView(prepared.response.grid.size_pixels);
    controls.showSettings(settings);
    controls.showPlaying(playbackTimer !== null);
    renderHeadings(prepared);
    renderNotices(prepared);
    computeLayout();
    renderThumbnails(prepared);
    renderSelection(prepared);
    drawPlayer();
    pixelReadout.textContent = EMPTY_PIXEL_READOUT;
    options.onStateChange();
  }

  function requestMissingDetectors(): void {
    fetchMissingDetectors(framesCache, {
      targetSlug: activeTargetSlug,
      coordinates: currentCoordinates(),
    });
  }

  function openDefaultTargetWhenNothingWasRequested(): void {
    if (activeRequest === null && !hasFailed) {
      openTarget(DEFAULT_TARGET_SLUG);
    }
  }

  async function load(): Promise<void> {
    activeRequest?.abort();
    const request = new AbortController();
    activeRequest = request;
    stopPlayback();
    hasFailed = false;

    framesCache.switchSubject(describeSubject());
    epochIndex = requestedEpochIndex;
    requestedEpochIndex = 0;
    notifyViewChange();
    if (currentPrepared()) {
      showCurrentDetector();
      return;
    }

    timeGrid.hidden = true;
    clearFrameLegend();
    showStatus(
      describeLoading({
        targetName: findChallengeTarget(activeTargetSlug)?.name ?? null,
        detector,
        coordinates: currentCoordinates(),
      }),
      false,
    );
    try {
      const response = await fetchFrames(
        { detector, targetSlug: activeTargetSlug, coordinates: currentCoordinates() },
        request.signal,
      );
      if (request.signal.aborted) {
        return;
      }
      framesCache.store(detector, prepareFrames(response));
      showCurrentDetector();
      if (activeTargetSlug !== null) {
        requestMissingDetectors();
      }
    } catch (error) {
      if (!request.signal.aborted) {
        hasFailed = true;
        showStatus(error instanceof Error ? error.message : String(error), true);
      }
    }
  }

  function selectDetector(newDetector: number, newEpochIndex: number): void {
    if (newDetector === detector) {
      selectEpoch(newEpochIndex);
      return;
    }
    detector = newDetector;
    void load().then(() => selectEpoch(newEpochIndex));
  }

  function selectEpoch(newEpochIndex: number): void {
    const prepared = currentPrepared();
    if (!prepared || newEpochIndex < 0 || newEpochIndex >= prepared.response.frames.length) {
      return;
    }
    epochIndex = newEpochIndex;
    renderSelection(prepared);
    drawPlayer();
    options.onStateChange();
  }

  function stepEpoch(step: number): void {
    const prepared = currentPrepared();
    if (prepared) {
      selectEpoch(stepFrameIndex(epochIndex, step, prepared.response.frames.length));
    }
  }

  function applySettings(change: Partial<PlayerSettings>): void {
    const previous = settings;
    settings = { ...settings, ...change };
    controls.showSettings(settings);
    const prepared = currentPrepared();
    if (prepared) {
      if (previous.colorMap !== settings.colorMap || previous.stretch !== settings.stretch) {
        renderThumbnails(prepared);
      }
      renderNotices(prepared);
      drawPlayer();
    }
    notifyViewChange();
  }

  function zoomTo(zoom: number, anchorOnCanvas?: ImagePoint): void {
    const prepared = currentPrepared();
    if (!prepared || !layout || zoom === settings.zoom) {
      return;
    }
    const sizePixels = prepared.response.grid.size_pixels;
    const anchorOnScreen = anchorOnCanvas ?? { x: layout.canvasSize / 2, y: layout.canvasSize / 2 };
    const anchor = canvasToImage(
      anchorOnScreen,
      centre,
      layout.canvasSize,
      sizePixels,
      settings.zoom,
    );
    centre = centreAfterZoom(anchor, anchorOnScreen, layout.canvasSize, sizePixels, zoom);
    applySettings({ zoom });
  }

  function zoomBy(direction: 1 | -1, anchorOnCanvas?: ImagePoint): void {
    zoomTo(nextZoom(settings.zoom, direction), anchorOnCanvas);
  }

  function runKeyboardAction(action: KeyboardAction): void {
    switch (action.kind) {
      case "toggle":
        togglePlayback();
        break;
      case "previous":
        stopPlayback();
        stepEpoch(-1);
        break;
      case "next":
        stopPlayback();
        stepEpoch(1);
        break;
      case "mode":
        applySettings({ mode: action.mode });
        break;
      case "zoom":
        zoomBy(action.direction);
        break;
      case "overlay":
        applySettings(
          action.overlay === "marker"
            ? { showMarker: !settings.showMarker }
            : { showTrack: !settings.showTrack },
        );
        break;
      case "colorMap":
        applySettings({ colorMap: settings.colorMap === "inferno" ? "gray" : "inferno" });
        break;
      case "saturation":
        applySettings({ showSaturation: !settings.showSaturation });
        break;
    }
  }

  function openTarget(targetSlug: string, preferredDetector: number | null = null): void {
    const challengeTarget: ChallengeTarget | null = findChallengeTarget(targetSlug);
    if (!challengeTarget) {
      return;
    }
    rightAscensionInput.value = challengeTarget.coordinates.rightAscension;
    declinationInput.value = challengeTarget.coordinates.declination;
    activeTargetSlug = challengeTarget.slug;
    targetSelect.value = challengeTarget.slug;
    detector = preferredDetector ?? challengeTarget.defaultDetector;
    void load();
  }

  function pointerPixel(event: PointerEvent): { column: number; row: number } | null {
    const prepared = currentPrepared();
    if (!prepared || !layout) {
      return null;
    }
    const sizePixels = prepared.response.grid.size_pixels;
    const imagePoint = canvasToImage(
      playerCanvas.pointerPosition(event.clientX, event.clientY),
      centre,
      layout.canvasSize,
      sizePixels,
      settings.zoom,
    );
    return pixelIndicesAt(imagePoint, sizePixels);
  }

  function updateHover(event: PointerEvent): void {
    const prepared = currentPrepared();
    const frame = prepared?.response.frames[epochIndex];
    hoveredPixel = pointerPixel(event);
    pixelReadout.textContent =
      prepared && frame && hoveredPixel
        ? describePixelReadout(
            frame,
            epochIndex,
            settings.mode,
            prepared.modeImages,
            hoveredPixel,
            prepared.response.unit,
          )
        : EMPTY_PIXEL_READOUT;
    drawPlayer();
  }

  let dragOrigin: { clientX: number; clientY: number } | null = null;

  frameCanvasElement.addEventListener("pointerdown", (event) => {
    frameCanvasElement.setPointerCapture(event.pointerId);
    dragOrigin = { clientX: event.clientX, clientY: event.clientY };
  });
  frameCanvasElement.addEventListener("pointermove", (event) => {
    const prepared = currentPrepared();
    if (dragOrigin && prepared && layout && settings.zoom > 1) {
      const sizePixels = prepared.response.grid.size_pixels;
      const scale = (layout.canvasSize / sizePixels) * settings.zoom;
      centre = clampCentre(
        {
          x: centre.x - (event.clientX - dragOrigin.clientX) / scale,
          y: centre.y - (event.clientY - dragOrigin.clientY) / scale,
        },
        sizePixels,
        settings.zoom,
      );
      dragOrigin = { clientX: event.clientX, clientY: event.clientY };
    }
    updateHover(event);
  });
  frameCanvasElement.addEventListener("pointerup", () => {
    dragOrigin = null;
  });
  frameCanvasElement.addEventListener("pointerleave", () => {
    hoveredPixel = null;
    pixelReadout.textContent = EMPTY_PIXEL_READOUT;
    drawPlayer();
  });
  frameCanvasElement.addEventListener(
    "wheel",
    (event) => {
      event.preventDefault();
      zoomBy(event.deltaY < 0 ? 1 : -1, playerCanvas.pointerPosition(event.clientX, event.clientY));
    },
    { passive: false },
  );

  document.addEventListener("keydown", (event) => {
    const isFormControl =
      event.target instanceof Element && event.target.closest("input, select, textarea, button");
    const action = keyboardActionFor(event.key);
    if (
      !action ||
      !isActive ||
      timeGrid.hidden ||
      isFormControl ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }
    event.preventDefault();
    runKeyboardAction(action);
  });

  window.addEventListener("resize", () => {
    if (resizeTimer !== null) {
      window.clearTimeout(resizeTimer);
    }
    resizeTimer = window.setTimeout(() => {
      if (isActive && currentPrepared()) {
        computeLayout();
        drawPlayer();
      }
    }, RESIZE_DEBOUNCE_MILLISECONDS);
  });

  framesCache.subscribe(() => {
    if (!timeGrid.hidden) {
      wavelengthRail.render(framesCache.all(), settings, detector, epochIndex);
    }
    options.onStateChange();
  });

  targetSelect.addEventListener("change", () => {
    if (targetSelect.value === CUSTOM_COORDINATES_VALUE) {
      activeTargetSlug = null;
      rightAscensionInput.focus();
    } else {
      openTarget(targetSelect.value);
    }
  });

  for (const coordinateInput of [rightAscensionInput, declinationInput]) {
    coordinateInput.addEventListener("input", () => {
      if (activeTargetSlug !== null) {
        activeTargetSlug = null;
        targetSelect.value = CUSTOM_COORDINATES_VALUE;
        detector = FREE_COORDINATES_DETECTOR;
      }
    });
  }

  searchForm.addEventListener("submit", (event) => {
    event.preventDefault();
    void load();
  });

  return {
    restore(view: ViewState): void {
      settings = view.settings;
      controls.showSettings(settings);
      const challengeTarget = findChallengeTarget(view.targetSlug);
      if (challengeTarget) {
        openTarget(challengeTarget.slug, view.detector);
        return;
      }
      rightAscensionInput.value = view.coordinates.rightAscension;
      declinationInput.value = view.coordinates.declination;
      activeTargetSlug = null;
      targetSelect.value = CUSTOM_COORDINATES_VALUE;
      detector = view.detector ?? defaultDetectorFor(null);
      if (view.coordinates.rightAscension && view.coordinates.declination) {
        void load();
      }
    },

    openTarget(targetSlug: string, newEpochIndex = 0): void {
      requestedEpochIndex = newEpochIndex;
      openTarget(targetSlug);
    },
    applySettings: (change) => applySettings(change),
    currentView,
    currentSelection: () => ({ detector, epochIndex }),
    loadStatus: () => currentLoadStatus,
    selectFrame: (newDetector, newEpochIndex) => selectDetector(newDetector, newEpochIndex),

    requestAllDetectors(): void {
      if (currentPrepared()) {
        requestMissingDetectors();
      } else {
        openDefaultTargetWhenNothingWasRequested();
      }
    },

    reset(): void {
      activeRequest?.abort();
      activeRequest = null;
      stopPlayback();
      settings = DEFAULT_PLAYER_SETTINGS;
      controls.showSettings(settings);
      activeTargetSlug = null;
      detector = FREE_COORDINATES_DETECTOR;
      framesCache.clear();
      currentLoadStatus = null;
      hasFailed = false;
      rightAscensionInput.value = "";
      declinationInput.value = "";
      targetSelect.value = CUSTOM_COORDINATES_VALUE;
      timeGrid.hidden = true;
      statusMessage.hidden = true;
      title.textContent = "Time machine";
      subtitle.textContent = "";
      clearFrameLegend();
      wavelengthRail.clear();
      filmstrip.clear();
      targetFacts.clear();
    },

    setActive(newIsActive: boolean): void {
      isActive = newIsActive;
      if (!isActive) {
        stopPlayback();
        return;
      }
      if (currentPrepared()) {
        computeLayout();
        drawPlayer();
      } else {
        openDefaultTargetWhenNothingWasRequested();
      }
    },
  };
}
