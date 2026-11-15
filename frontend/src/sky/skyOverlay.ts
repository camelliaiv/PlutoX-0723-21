import {
  projectToScreen,
  type CameraBasis,
  type CameraState,
  type ScreenPoint,
  type Viewport,
} from "./skyCamera";
import type { FallbackStar } from "./skyFallback";
import { clamp, scale, type Vector3 } from "./skyMath";
import {
  DIRECTION_ONLY_DISTANCE_TEXT,
  formatDistance,
  SKY_TARGETS,
  type SkyTarget,
} from "./skyTargets";

export interface TargetScreenPosition {
  x: number;
  y: number;
  visible: boolean;
}

export interface OverlayFrame {
  basis: CameraBasis;
  camera: CameraState;
  viewport: Viewport;
  time: number;
  reducedMotion: boolean;
  showTargets: boolean;
  hoveredSlug: string | null;
  selectedSlug: string | null;
  topInset: number;
  fallbackStars: readonly FallbackStar[] | null;
  hideDecorations: boolean;
  userPosition: UserMarker | null;
}

export interface UserMarker {
  position: Vector3;
  label: string;
}

const DISTANCE_RING_RADII_PARSECS = [1, 3, 10, 30, 100, 300, 1000, 3000];
const RING_SEGMENTS = 120;
const MINIMUM_DEPTH = 0.04;
const BOTTOM_INSET = 90;
const EDGE_INSET = 34;
const PULSE_PERIOD_MILLISECONDS = 520;
const MAXIMUM_SMOOTHING_STEP_MILLISECONDS = 64;
const HIGHLIGHT_EASING_MILLISECONDS = 110;
const LABEL_SPACING = 30;
const BACKGROUND_ARROW_DISTANCE_FACTOR = 4;
const SUN_GLOW_RADIUS = 26;
const FALLBACK_MAGNITUDE_LIMIT = 14.5;
const USER_MARKER_RADIUS = 13;

const COLOURS = {
  fallbackInner: "#0b1330",
  fallbackMiddle: "#060a18",
  fallbackOuter: "#04060d",
  sunLabel: "#ffe9b0",
  targetStroke: "#ff8a1f",
  label: "#ffd9b0",
  labelHighlighted: "#ffffff",
  labelDetail: "#ffb36b",
  edgeLabel: "rgba(255, 190, 130, 0.9)",
  edgeArrow: "rgba(255, 138, 31, 0.85)",
  directionLine: "rgba(255, 138, 31, 0.35)",
  ringLabel: "rgba(150, 176, 230, 0.55)",
  shadow: "#000000",
  userMarker: "#5aaaff",
  userMarkerLabel: "#cfe6ff",
} as const;

interface PendingLabel {
  target: SkyTarget;
  x: number;
  y: number;
  highlighted: boolean;
}

export class SkyOverlay {
  private readonly canvas: HTMLCanvasElement;
  private readonly bodyFont: string;
  private readonly monospaceFont: string;
  private readonly context: CanvasRenderingContext2D;
  private readonly hoverAmounts = new Map<string, number>();
  private readonly selectionAmounts = new Map<string, number>();
  private lastDrawTime = 0;

  constructor(canvas: HTMLCanvasElement, bodyFont: string, monospaceFont: string) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("The sky overlay needs a 2D canvas.");
    }
    this.canvas = canvas;
    this.bodyFont = bodyFont;
    this.monospaceFont = monospaceFont;
    this.context = context;
  }

  resize(viewport: Viewport, devicePixelRatio: number): void {
    this.canvas.width = viewport.width * devicePixelRatio;
    this.canvas.height = viewport.height * devicePixelRatio;
  }

  draw(frame: OverlayFrame, devicePixelRatio: number): Map<string, TargetScreenPosition> {
    const { context } = this;
    const { viewport } = frame;
    context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    context.globalCompositeOperation = "source-over";
    context.globalAlpha = 1;
    context.clearRect(0, 0, viewport.width, viewport.height);
    if (frame.fallbackStars) {
      this.drawFallbackStars(frame, frame.fallbackStars);
    }
    if (frame.hideDecorations) {
      return new Map();
    }
    this.drawDistanceRings(frame);
    const sunScreen = projectToScreen(frame.basis, [0, 0, 0], viewport);
    this.drawSun(frame, sunScreen);
    const positions = new Map<string, TargetScreenPosition>();
    if (frame.showTargets) {
      this.drawTargets(frame, sunScreen, positions);
      if (frame.userPosition) {
        this.drawUserMarker(frame, frame.userPosition);
      }
    } else {
      this.lastDrawTime = frame.time;
    }
    return positions;
  }

  private drawUserMarker(frame: OverlayFrame, marker: UserMarker): void {
    const { context } = this;
    const { viewport } = frame;
    const screen = projectToScreen(frame.basis, marker.position, viewport);
    if (screen.depth < MINIMUM_DEPTH) {
      return;
    }
    const x = clamp(screen.x, EDGE_INSET, viewport.width - EDGE_INSET);
    const y = clamp(screen.y, frame.topInset, viewport.height - BOTTOM_INSET);
    const pulse = frame.reducedMotion
      ? 0.5
      : Math.sin(frame.time / PULSE_PERIOD_MILLISECONDS) * 0.5 + 0.5;
    context.lineWidth = 2;
    context.strokeStyle = COLOURS.userMarker;
    context.beginPath();
    context.arc(x, y, USER_MARKER_RADIUS, 0, Math.PI * 2);
    context.stroke();
    context.lineWidth = 1;
    context.strokeStyle = `rgba(90, 170, 255, ${0.2 + pulse * 0.3})`;
    context.beginPath();
    context.arc(x, y, USER_MARKER_RADIUS + 5 + pulse * 4, 0, Math.PI * 2);
    context.stroke();
    const onRight = x > viewport.width / 2;
    const labelX = x + (onRight ? -1 : 1) * (USER_MARKER_RADIUS + 10);
    context.textAlign = onRight ? "right" : "left";
    context.shadowColor = COLOURS.shadow;
    context.shadowBlur = 6;
    context.fillStyle = COLOURS.userMarkerLabel;
    context.font = `600 13px ${this.bodyFont}`;
    context.fillText("Your position", labelX, y - 2);
    context.font = `11px ${this.monospaceFont}`;
    context.fillText(marker.label, labelX, y + 13);
    context.shadowBlur = 0;
  }

  private drawFallbackStars(frame: OverlayFrame, stars: readonly FallbackStar[]): void {
    const { context } = this;
    const { viewport } = frame;
    const gradient = context.createRadialGradient(
      viewport.width / 2,
      viewport.height * 0.45,
      0,
      viewport.width / 2,
      viewport.height * 0.45,
      Math.max(viewport.width, viewport.height) * 0.75,
    );
    gradient.addColorStop(0, COLOURS.fallbackInner);
    gradient.addColorStop(0.6, COLOURS.fallbackMiddle);
    gradient.addColorStop(1, COLOURS.fallbackOuter);
    context.fillStyle = gradient;
    context.fillRect(0, 0, viewport.width, viewport.height);
    context.globalCompositeOperation = "lighter";
    for (const star of stars) {
      const screen = projectToScreen(frame.basis, star.position, viewport);
      if (screen.depth < MINIMUM_DEPTH) {
        continue;
      }
      const magnitude =
        star.magnitude +
        star.brightnessBoost +
        5 * Math.log10(Math.max(screen.distance, 0.03) / 10);
      const size = clamp((FALLBACK_MAGNITUDE_LIMIT - magnitude) * 0.42, 0, 6.5);
      const onScreen =
        screen.x > -20 &&
        screen.x < viewport.width + 20 &&
        screen.y > -20 &&
        screen.y < viewport.height + 20;
      if (size < 0.3 || !onScreen) {
        continue;
      }
      context.globalAlpha = clamp(0.3 + (FALLBACK_MAGNITUDE_LIMIT - magnitude) * 0.08, 0.15, 1);
      context.fillStyle = star.colour;
      if (size < 1.2) {
        context.fillRect(screen.x - 0.5 * size, screen.y - 0.5 * size, size + 0.3, size + 0.3);
      } else {
        context.beginPath();
        context.arc(screen.x, screen.y, size, 0, Math.PI * 2);
        context.fill();
        context.globalAlpha *= 0.25;
        context.beginPath();
        context.arc(screen.x, screen.y, size * 2.6, 0, Math.PI * 2);
        context.fill();
      }
    }
    context.globalAlpha = 1;
    context.globalCompositeOperation = "source-over";
  }

  private drawDistanceRings(frame: OverlayFrame): void {
    const { context } = this;
    const { viewport, camera } = frame;
    context.lineWidth = 1;
    for (const radius of DISTANCE_RING_RADII_PARSECS) {
      if (radius < camera.distance * 0.08 || radius > camera.distance * 30 || camera.distance < 1) {
        continue;
      }
      const nearness = Math.abs(Math.log(radius / camera.distance));
      context.strokeStyle = `rgba(110, 150, 255, ${clamp(0.2 - nearness * 0.03, 0.04, 0.2)})`;
      context.beginPath();
      let previous: ScreenPoint | null = null;
      let labelPoint: ScreenPoint | null = null;
      for (let segment = 0; segment <= RING_SEGMENTS; segment++) {
        const angle = (segment / RING_SEGMENTS) * Math.PI * 2;
        const point = projectToScreen(
          frame.basis,
          [radius * Math.cos(angle), radius * Math.sin(angle), 0],
          viewport,
        );
        if (point.depth < 0.05) {
          previous = null;
          continue;
        }
        if (previous) {
          context.lineTo(point.x, point.y);
        } else {
          context.moveTo(point.x, point.y);
        }
        previous = point;
        const isLabelCandidate =
          point.x > 40 &&
          point.x < viewport.width - 40 &&
          point.y > viewport.height * 0.45 &&
          point.y < viewport.height - 60;
        if (
          isLabelCandidate &&
          (!labelPoint ||
            Math.abs(point.x - viewport.width / 2) < Math.abs(labelPoint.x - viewport.width / 2))
        ) {
          labelPoint = point;
        }
      }
      context.stroke();
      if (labelPoint) {
        context.fillStyle = COLOURS.ringLabel;
        context.font = `11px ${this.monospaceFont}`;
        context.textAlign = "center";
        context.fillText(`${radius} pc`, labelPoint.x, labelPoint.y - 4);
      }
    }
  }

  private drawSun(frame: OverlayFrame, sunScreen: ScreenPoint): void {
    const { context } = this;
    const distanceFromSun = Math.hypot(...frame.basis.position);
    if (sunScreen.depth <= 0.05 || distanceFromSun <= 1.2) {
      return;
    }
    context.globalCompositeOperation = "lighter";
    const gradient = context.createRadialGradient(
      sunScreen.x,
      sunScreen.y,
      0,
      sunScreen.x,
      sunScreen.y,
      SUN_GLOW_RADIUS,
    );
    gradient.addColorStop(0, "rgba(255, 240, 200, 0.9)");
    gradient.addColorStop(1, "rgba(255, 200, 100, 0)");
    context.fillStyle = gradient;
    context.fillRect(
      sunScreen.x - SUN_GLOW_RADIUS,
      sunScreen.y - SUN_GLOW_RADIUS,
      2 * SUN_GLOW_RADIUS,
      2 * SUN_GLOW_RADIUS,
    );
    context.globalCompositeOperation = "source-over";
    context.fillStyle = COLOURS.sunLabel;
    context.font = `600 11px ${this.bodyFont}`;
    context.textAlign = "left";
    context.fillText("Sun", sunScreen.x + 10, sunScreen.y + 16);
  }

  private smoothedAmount(
    amounts: Map<string, number>,
    slug: string,
    active: boolean,
    easing: number,
  ): number {
    const current = amounts.get(slug) ?? 0;
    const next = current + ((active ? 1 : 0) - current) * easing;
    amounts.set(slug, next);
    return next;
  }

  private drawTargets(
    frame: OverlayFrame,
    sunScreen: ScreenPoint,
    positions: Map<string, TargetScreenPosition>,
  ): void {
    const { viewport } = frame;
    const pulse = frame.reducedMotion
      ? 0.5
      : Math.sin(frame.time / PULSE_PERIOD_MILLISECONDS) * 0.5 + 0.5;
    const step = Math.min(frame.time - this.lastDrawTime, MAXIMUM_SMOOTHING_STEP_MILLISECONDS);
    this.lastDrawTime = frame.time;
    const easing = frame.reducedMotion ? 1 : 1 - Math.exp(-step / HIGHLIGHT_EASING_MILLISECONDS);
    const labels: PendingLabel[] = [];

    for (const target of SKY_TARGETS) {
      const screen = projectToScreen(frame.basis, target.position, viewport);
      const visible =
        screen.depth > MINIMUM_DEPTH &&
        screen.x > -10 &&
        screen.x < viewport.width + 10 &&
        screen.y > -10 &&
        screen.y < viewport.height + 10;
      positions.set(target.slug, { x: screen.x, y: screen.y, visible });
      if (
        target.distanceParsecs === null &&
        sunScreen.depth > 0.05 &&
        screen.depth > MINIMUM_DEPTH
      ) {
        this.drawDirectionLine(frame, target, sunScreen);
      }
      if (!visible) {
        this.drawEdgeArrow(frame, target, screen);
        continue;
      }
      const hovered = frame.hoveredSlug === target.slug;
      const selected = frame.selectedSlug === target.slug;
      const hoverAmount = this.smoothedAmount(this.hoverAmounts, target.slug, hovered, easing);
      const selectionAmount = this.smoothedAmount(
        this.selectionAmounts,
        target.slug,
        selected,
        easing,
      );
      const radius = this.drawBeacon(screen, pulse, hoverAmount, selectionAmount);
      labels.push({
        target,
        x: screen.x + radius + 8,
        y: screen.y - 4,
        highlighted: selected || hovered,
      });
    }
    this.drawLabels(labels);
  }

  private drawDirectionLine(frame: OverlayFrame, target: SkyTarget, sunScreen: ScreenPoint): void {
    const { context } = this;
    const farPosition: Vector3 = scale(target.position, BACKGROUND_ARROW_DISTANCE_FACTOR);
    const far = projectToScreen(frame.basis, farPosition, frame.viewport);
    context.strokeStyle = COLOURS.directionLine;
    context.setLineDash([4, 6]);
    context.beginPath();
    context.moveTo(sunScreen.x, sunScreen.y);
    context.lineTo(far.x, far.y);
    context.stroke();
    context.setLineDash([]);
  }

  private drawBeacon(
    screen: ScreenPoint,
    pulse: number,
    hoverAmount: number,
    selectionAmount: number,
  ): number {
    const { context } = this;
    const radius = 11 + 4 * selectionAmount + 2.5 * hoverAmount;
    context.globalCompositeOperation = "lighter";
    const glow = context.createRadialGradient(
      screen.x,
      screen.y,
      0,
      screen.x,
      screen.y,
      radius * 3,
    );
    glow.addColorStop(0, `rgba(255, 138, 31, ${0.55 + pulse * 0.25})`);
    glow.addColorStop(1, "rgba(255, 138, 31, 0)");
    context.fillStyle = glow;
    context.fillRect(screen.x - radius * 3, screen.y - radius * 3, radius * 6, radius * 6);
    context.globalCompositeOperation = "source-over";
    context.strokeStyle = COLOURS.targetStroke;
    context.lineWidth = 2.2 + 0.8 * Math.max(hoverAmount, selectionAmount);
    context.lineCap = "round";
    context.beginPath();
    context.moveTo(screen.x - radius * 0.55, screen.y - radius * 0.55);
    context.lineTo(screen.x + radius * 0.55, screen.y + radius * 0.55);
    context.moveTo(screen.x + radius * 0.55, screen.y - radius * 0.55);
    context.lineTo(screen.x - radius * 0.55, screen.y + radius * 0.55);
    context.stroke();
    context.strokeStyle = `rgba(255, 160, 70, ${0.25 + pulse * 0.35})`;
    context.lineWidth = 1.2;
    context.beginPath();
    context.arc(screen.x, screen.y, radius + 4 + pulse * 5, 0, Math.PI * 2);
    context.stroke();
    if (selectionAmount > 0.02) {
      context.strokeStyle = `rgba(255, 255, 255, ${selectionAmount})`;
      context.lineWidth = 1;
      context.beginPath();
      context.arc(screen.x, screen.y, radius + 4, 0, Math.PI * 2);
      context.stroke();
    }
    return radius;
  }

  private drawEdgeArrow(frame: OverlayFrame, target: SkyTarget, screen: ScreenPoint): void {
    const { context } = this;
    const { viewport } = frame;
    const angle = Math.atan2(screen.y - viewport.height / 2, screen.x - viewport.width / 2);
    const direction = screen.depth < 0 ? angle + Math.PI : angle;
    const edgeX = viewport.width / 2 + Math.cos(direction) * (viewport.width / 2 - EDGE_INSET);
    const edgeY = viewport.height / 2 + Math.sin(direction) * (viewport.height / 2 - BOTTOM_INSET);
    const x = clamp(edgeX, EDGE_INSET, viewport.width - EDGE_INSET);
    const y = clamp(edgeY, frame.topInset, viewport.height - BOTTOM_INSET);
    context.save();
    context.translate(x, y);
    context.rotate(direction);
    context.fillStyle = COLOURS.edgeArrow;
    context.beginPath();
    context.moveTo(9, 0);
    context.lineTo(-6, -7);
    context.lineTo(-6, 7);
    context.fill();
    context.restore();
    context.fillStyle = COLOURS.edgeLabel;
    context.font = `11px ${this.bodyFont}`;
    const onRight = x > viewport.width / 2;
    context.textAlign = onRight ? "right" : "left";
    context.fillText(target.name, x + (onRight ? -14 : 14), y + 4);
  }

  private drawLabels(labels: PendingLabel[]): void {
    const { context } = this;
    labels.sort((first, second) => first.y - second.y);
    let previousY = -99;
    for (const label of labels) {
      if (label.y < previousY + LABEL_SPACING) {
        label.y = previousY + LABEL_SPACING;
      }
      previousY = label.y;
      context.font = `${label.highlighted ? 650 : 550} 13px ${this.bodyFont}`;
      context.textAlign = "left";
      context.shadowColor = COLOURS.shadow;
      context.shadowBlur = 6;
      context.fillStyle = label.highlighted ? COLOURS.labelHighlighted : COLOURS.label;
      context.fillText(label.target.name, label.x, label.y);
      context.font = `11px ${this.monospaceFont}`;
      context.fillStyle = COLOURS.labelDetail;
      const distance = label.target.distanceParsecs;
      context.fillText(
        distance === null
          ? `${DIRECTION_ONLY_DISTANCE_TEXT} · direction only`
          : formatDistance(distance, 2, 1),
        label.x,
        label.y + 14,
      );
      context.shadowBlur = 0;
    }
  }
}
