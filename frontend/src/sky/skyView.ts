import { requireElement } from "../dom";
import { loadSkyAssets } from "./skyAssets";
import {
  computeCameraBasis,
  DEFAULT_CAMERA,
  focalLength,
  type CameraBasis,
  type Viewport,
} from "./skyCamera";
import { buildSkyCatalogue, type SkyCatalogue } from "./skyCatalogue";
import { buildFallbackStars, type FallbackStar } from "./skyFallback";
import { createSkyHud, type SkyHud } from "./skyHud";
import { attachSkyInteraction } from "./skyInteraction";
import { formatScaleLabel, niceScaleLength } from "./skyMath";
import { SkyMotion } from "./skyMotion";
import { SkyOverlay, type TargetScreenPosition } from "./skyOverlay";
import {
  describeStarTooltip,
  describeTargetTooltip,
  findStarNear,
  findTargetAt,
} from "./skyPicking";
import { createWebGlRenderer, type SkyRenderer } from "./skyRenderer";
import { cameraForTarget, findSkyTarget, SKY_TARGETS } from "./skyTargets";

export interface SkyViewOptions {
  onOpenInTimeMachine(slug: string): void;
  onTargetSelected(slug: string): void;
}

export interface SkyView {
  setActive(active: boolean): void;
  beginIntro(): void;
  endIntro(): void;
  restart(): void;
  flyToTarget(slug: string): void;
}

const MAXIMUM_DEVICE_PIXEL_RATIO = 2;
const MAXIMUM_FRAME_MILLISECONDS = 64;
const TARGET_FLIGHT_MILLISECONDS = 2600;
const RESET_FLIGHT_MILLISECONDS = 1800;
const INTRO_FLIGHT_MILLISECONDS = 3800;
const INTRO_START_DISTANCE_PARSECS = 150;
const INTRO_START_YAW_OFFSET = 0.7;
const INTRO_START_PITCH = 0.2;
const TOUR_PAUSE_MILLISECONDS = 2200;
const TOUR_PAUSE_REDUCED_MOTION_MILLISECONDS = 3000;
const SCALE_BAR_PIXELS = 150;
const NARROW_SCREEN_PIXELS = 760;
const TOP_INSET_NARROW = 204;
const TOP_INSET_WIDE = 110;
const BACKGROUND_FRAME_INTERVAL = 2;
const LOAD_ERROR_MESSAGE = "The sky could not be loaded. Check the connection and try again.";

export function createSkyView(options: SkyViewOptions): SkyView {
  const glCanvas = requireElement<HTMLCanvasElement>("#sky-gl");
  const overlayCanvas = requireElement<HTMLCanvasElement>("#sky-overlay");
  const panel = requireElement<HTMLElement>("#view-sky");
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  const bodyStyle = getComputedStyle(document.body);
  const overlay = new SkyOverlay(
    overlayCanvas,
    bodyStyle.fontFamily,
    bodyStyle.getPropertyValue("--font-mono"),
  );
  const motion = new SkyMotion();

  let catalogue: SkyCatalogue | null = null;
  let renderer: SkyRenderer | null = null;
  let fallbackStars: FallbackStar[] | null = null;
  let ready = false;
  let active = true;
  let introActive = false;
  let viewport: Viewport = { width: window.innerWidth, height: window.innerHeight };
  let devicePixelRatio = 1;
  let basis: CameraBasis = computeCameraBasis(motion.camera, motion.look);
  let targetPositions = new Map<string, TargetScreenPosition>();
  let hoveredSlug: string | null = null;
  let openCardSlug: string | null = null;
  let tourTimer: number | null = null;
  let tourIndex = 0;
  let tourRunning = false;
  let lastFrameTime = performance.now();
  let frameCounter = 0;

  const hud: SkyHud = createSkyHud({
    onSelectTarget: (slug) => {
      stopTour();
      selectTarget(slug, null);
    },
    onToggleTour: () => (tourRunning ? stopTour() : startTour()),
    onResetView: resetView,
    onOpenInTimeMachine: (slug) => {
      stopTour();
      options.onOpenInTimeMachine(slug);
    },
    onCloseCard: closeCard,
  });
  panel.append(hud.element);

  function reducedMotion(): boolean {
    return reducedMotionQuery.matches;
  }

  function stopTour(): void {
    if (tourTimer !== null) {
      window.clearTimeout(tourTimer);
      tourTimer = null;
    }
    tourRunning = false;
    hud.setTourRunning(false);
  }

  function interrupt(): void {
    hud.hideFirstVisitHint();
    motion.cancelFlight();
    stopTour();
    motion.noteInteraction(performance.now());
  }

  function closeCard(): void {
    openCardSlug = null;
    hud.hideCard();
    hud.setSelectedChip(null);
  }

  function selectTarget(slug: string, afterArrival: (() => void) | null): void {
    const target = findSkyTarget(slug);
    if (!target) {
      return;
    }
    closeCard();
    hud.setSelectedChip(slug);
    options.onTargetSelected(slug);
    motion.startFlight(
      cameraForTarget(target),
      TARGET_FLIGHT_MILLISECONDS,
      performance.now(),
      reducedMotion(),
      {
        onArrive: () => {
          openCardSlug = slug;
          hud.showCard(target);
          hud.announce(`Flew to ${target.name}`);
          afterArrival?.();
        },
      },
    );
  }

  function startTour(): void {
    stopTour();
    tourRunning = true;
    tourIndex = 0;
    hud.setTourRunning(true);
    const visitNext = (): void => {
      if (!tourRunning) {
        return;
      }
      const target = SKY_TARGETS[tourIndex % SKY_TARGETS.length];
      tourIndex++;
      if (!target) {
        return;
      }
      selectTarget(target.slug, () => {
        if (tourRunning) {
          tourTimer = window.setTimeout(
            visitNext,
            reducedMotion() ? TOUR_PAUSE_REDUCED_MOTION_MILLISECONDS : TOUR_PAUSE_MILLISECONDS,
          );
        }
      });
    };
    visitNext();
  }

  function resetView(): void {
    stopTour();
    closeCard();
    motion.startFlight(
      { ...DEFAULT_CAMERA, yaw: motion.camera.yaw },
      RESET_FLIGHT_MILLISECONDS,
      performance.now(),
      reducedMotion(),
    );
  }

  function resize(): void {
    devicePixelRatio = Math.min(window.devicePixelRatio || 1, MAXIMUM_DEVICE_PIXEL_RATIO);
    viewport = { width: window.innerWidth, height: window.innerHeight };
    glCanvas.width = viewport.width * devicePixelRatio;
    glCanvas.height = viewport.height * devicePixelRatio;
    overlay.resize(viewport, devicePixelRatio);
  }

  function useFallbackRenderer(): void {
    renderer = null;
    glCanvas.hidden = true;
    if (catalogue) {
      fallbackStars = buildFallbackStars(catalogue);
    }
  }

  function updateHover(clientX: number, clientY: number): void {
    const target = findTargetAt(targetPositions, SKY_TARGETS, clientX, clientY);
    hoveredSlug = target?.slug ?? null;
    overlayCanvas.classList.toggle("sky-canvas-hovering", target !== null);
    if (target) {
      hud.showTooltip(describeTargetTooltip(target), clientX, clientY);
      return;
    }
    if (!catalogue) {
      return;
    }
    const starIndex = findStarNear(catalogue, basis, viewport, clientX, clientY);
    if (starIndex === null) {
      hud.hideTooltip();
    } else {
      hud.showTooltip(describeStarTooltip(catalogue, starIndex), clientX, clientY);
    }
  }

  function clearHover(): void {
    hoveredSlug = null;
    overlayCanvas.classList.remove("sky-canvas-hovering");
    hud.hideTooltip();
  }

  function cursorOffsets(
    clientX: number,
    clientY: number,
  ): { horizontal: number; vertical: number } {
    const length = focalLength(viewport);
    return {
      horizontal: (clientX - viewport.width / 2) / length,
      vertical: (viewport.height / 2 - clientY) / length,
    };
  }

  attachSkyInteraction(overlayCanvas, {
    onInteraction: interrupt,
    onDragStart: () => motion.beginDrag(performance.now()),
    onDrag: (deltaX, deltaY) => motion.dragBy(deltaX, deltaY, performance.now(), reducedMotion()),
    onDragEnd: () => motion.endDrag(performance.now()),
    onPinch: (ratio) => motion.pinchBy(ratio),
    onTap: (x, y) => {
      const target = findTargetAt(targetPositions, SKY_TARGETS, x, y);
      if (target) {
        interrupt();
        selectTarget(target.slug, null);
      }
    },
    onHover: updateHover,
    onHoverEnd: clearHover,
    onZoom: (factor, x, y) => {
      const offsets = cursorOffsets(x, y);
      motion.zoomBy(factor, offsets.horizontal, offsets.vertical, reducedMotion());
    },
    onKeyRotate: (yawDelta, pitchDelta) => motion.rotateBy(yawDelta, pitchDelta),
    onKeyZoom: (factor) => motion.zoomBy(factor, 0, 0, reducedMotion()),
    onPointerLook: (horizontal, vertical) => {
      if (active && !reducedMotion()) {
        motion.setLookTarget(horizontal, vertical);
      }
    },
  });

  window.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && hud.isAboutOpen()) {
      hud.setAboutOpen(false);
    }
  });
  window.addEventListener("resize", resize);
  resize();

  function updateReadouts(): void {
    const pixelsToParsecs = motion.camera.distance / focalLength(viewport);
    const length = niceScaleLength(pixelsToParsecs * SCALE_BAR_PIXELS);
    hud.setScale(formatScaleLabel(length), length / pixelsToParsecs);
    const distanceFromSun = Math.hypot(...basis.position);
    const count = catalogue?.count ?? 0;
    hud.setReadout(
      `camera ${distanceFromSun >= 10 ? distanceFromSun.toFixed(0) : distanceFromSun.toFixed(1)} pc from the Sun · ${count.toLocaleString("en")} stars`,
    );
  }

  function drawFrame(now: number): void {
    basis = computeCameraBasis(motion.camera, motion.look);
    renderer?.draw({
      basis,
      viewport,
      focalLength: focalLength(viewport),
      devicePixelRatio,
    });
    targetPositions = overlay.draw(
      {
        basis,
        camera: motion.camera,
        viewport,
        time: now,
        reducedMotion: reducedMotion(),
        showTargets: active && !introActive,
        hoveredSlug,
        selectedSlug: openCardSlug,
        topInset: viewport.width < NARROW_SCREEN_PIXELS ? TOP_INSET_NARROW : TOP_INSET_WIDE,
        fallbackStars,
        hideDecorations: introActive && renderer !== null,
      },
      devicePixelRatio,
    );
    if (active) {
      updateReadouts();
    }
  }

  function loop(now: number): void {
    const deltaMilliseconds = Math.min(now - lastFrameTime, MAXIMUM_FRAME_MILLISECONDS);
    lastFrameTime = now;
    frameCounter++;
    if (ready) {
      motion.update(now, deltaMilliseconds, {
        reducedMotion: reducedMotion(),
        skyActive: active,
        driftAllowed: openCardSlug === null && !tourRunning && !document.hidden,
      });
      if (active || frameCounter % BACKGROUND_FRAME_INTERVAL === 0) {
        drawFrame(now);
      }
    }
    requestAnimationFrame(loop);
  }

  function startIntroFlight(): void {
    if (reducedMotion()) {
      motion.reset(DEFAULT_CAMERA);
      return;
    }
    motion.reset({
      ...DEFAULT_CAMERA,
      distance: INTRO_START_DISTANCE_PARSECS,
      yaw: DEFAULT_CAMERA.yaw - INTRO_START_YAW_OFFSET,
      pitch: INTRO_START_PITCH,
    });
    motion.startFlight(DEFAULT_CAMERA, INTRO_FLIGHT_MILLISECONDS, performance.now(), false, {
      withoutBump: true,
    });
  }

  function startLoadingAssets(): void {
    hud.setLoading(0);
    loadSkyAssets((fraction) => hud.setLoading(fraction))
      .then((assets) => {
        catalogue = buildSkyCatalogue(assets.stars, assets.brightStars);
        hud.describeAbout(assets.manifest);
        renderer = createWebGlRenderer(
          glCanvas,
          catalogue,
          assets.milkyWayImage,
          useFallbackRenderer,
        );
        if (renderer === null) {
          useFallbackRenderer();
        }
        hud.setLoading(null);
        ready = true;
        if (introActive) {
          startIntroFlight();
        }
      })
      .catch(() => hud.showLoadingError(LOAD_ERROR_MESSAGE, startLoadingAssets));
  }
  startLoadingAssets();

  requestAnimationFrame(loop);

  return {
    setActive(isActive: boolean): void {
      active = isActive;
      if (!isActive) {
        clearHover();
        motion.setLookTarget(0, 0);
      }
    },
    beginIntro(): void {
      introActive = true;
      hud.hideFirstVisitHint();
      if (ready) {
        startIntroFlight();
      }
    },
    endIntro(): void {
      introActive = false;
      if (active) {
        hud.showFirstVisitHint();
      }
    },
    flyToTarget(slug: string): void {
      stopTour();
      selectTarget(slug, null);
    },
    restart(): void {
      stopTour();
      closeCard();
      hud.hideFirstVisitHint();
      hud.setAboutOpen(false);
      hud.setSelectedChip(null);
      motion.reset(DEFAULT_CAMERA);
    },
  };
}
