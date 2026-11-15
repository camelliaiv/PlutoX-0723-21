import {
  clampDistance,
  clampPitch,
  DEFAULT_CAMERA,
  dragRadiansPerPixel,
  flightBump,
  interpolateCamera,
  rotateByDrag,
  zoomAboutCursor,
  type CameraState,
  type LookOffset,
} from "./skyCamera";
import { clamp, easeInOutCubic } from "./skyMath";

export const IDLE_BEFORE_DRIFT_MILLISECONDS = 3000;

const DRIFT_RAMP_MILLISECONDS = 3000;
const DRIFT_RADIANS_PER_MILLISECOND = 0.00003;
const BACKGROUND_TURN_RADIANS_PER_MILLISECOND = 0.00005;
const INERTIA_DECAY_MILLISECONDS = 380;
const INERTIA_STOP_THRESHOLD = 2e-6;
const INERTIA_RELEASE_WINDOW_MILLISECONDS = 70;
const DRAG_MINIMUM_INTERVAL_MILLISECONDS = 4;
const POINTER_LOOK_FRACTION = 0.05;
const POINTER_LOOK_EASING_MILLISECONDS = 320;
const ZOOM_EASING_MILLISECONDS = 120;
const ZOOM_SETTLED_LOGARITHM = 0.0008;

export interface MotionConditions {
  reducedMotion: boolean;
  skyActive: boolean;
  driftAllowed: boolean;
}

interface Flight {
  from: CameraState;
  to: CameraState;
  startTime: number;
  durationMilliseconds: number;
  bump: number;
  onArrive: (() => void) | null;
}

export interface FlightOptions {
  withoutBump?: boolean;
  onArrive?: () => void;
}

export class SkyMotion {
  camera: CameraState = { ...DEFAULT_CAMERA };
  look: LookOffset = { x: 0, y: 0 };
  private lookTarget: LookOffset = { x: 0, y: 0 };
  private flight: Flight | null = null;
  private zoomTarget: number | null = null;
  private zoomCursor = { horizontal: 0, vertical: 0 };
  private yawVelocity = 0;
  private pitchVelocity = 0;
  private dragging = false;
  private lastDragTime = 0;
  private lastInteractionTime = 0;
  private driftAmount = 0;

  get isFlying(): boolean {
    return this.flight !== null;
  }

  get isDragging(): boolean {
    return this.dragging;
  }

  get isZooming(): boolean {
    return this.zoomTarget !== null;
  }

  idleMilliseconds(now: number): number {
    return now - this.lastInteractionTime;
  }

  noteInteraction(now: number): void {
    this.lastInteractionTime = now;
  }

  reset(camera: CameraState): void {
    this.flight = null;
    this.zoomTarget = null;
    this.yawVelocity = 0;
    this.pitchVelocity = 0;
    this.driftAmount = 0;
    this.look = { x: 0, y: 0 };
    this.lookTarget = { x: 0, y: 0 };
    this.camera = { ...camera };
  }

  setLookTarget(x: number, y: number): void {
    this.lookTarget = { x, y };
  }

  startFlight(
    to: CameraState,
    durationMilliseconds: number,
    now: number,
    reducedMotion: boolean,
    options: FlightOptions = {},
  ): void {
    this.flight = null;
    this.zoomTarget = null;
    if (reducedMotion || durationMilliseconds <= 0) {
      this.camera = { ...to };
      options.onArrive?.();
      return;
    }
    this.flight = {
      from: this.camera,
      to,
      startTime: now,
      durationMilliseconds,
      bump: options.withoutBump ? 0 : flightBump(this.camera, to),
      onArrive: options.onArrive ?? null,
    };
  }

  cancelFlight(): void {
    this.flight = null;
  }

  beginDrag(now: number): void {
    this.dragging = true;
    this.lastDragTime = now;
    this.yawVelocity = 0;
    this.pitchVelocity = 0;
    this.zoomTarget = null;
  }

  dragBy(deltaX: number, deltaY: number, now: number, reducedMotion: boolean): void {
    const radiansPerPixel = dragRadiansPerPixel(this.camera);
    const elapsed = Math.max(now - this.lastDragTime, DRAG_MINIMUM_INTERVAL_MILLISECONDS);
    this.lastDragTime = now;
    this.camera = rotateByDrag(this.camera, deltaX, deltaY);
    this.yawVelocity = this.yawVelocity * 0.4 - (0.6 * deltaX * radiansPerPixel) / elapsed;
    this.pitchVelocity = this.pitchVelocity * 0.4 + (0.6 * deltaY * radiansPerPixel) / elapsed;
    if (reducedMotion) {
      this.yawVelocity = 0;
      this.pitchVelocity = 0;
    }
  }

  endDrag(now: number): void {
    this.dragging = false;
    if (now - this.lastDragTime > INERTIA_RELEASE_WINDOW_MILLISECONDS) {
      this.yawVelocity = 0;
      this.pitchVelocity = 0;
    }
  }

  pinchBy(distanceRatio: number): void {
    this.camera = { ...this.camera, distance: clampDistance(this.camera.distance * distanceRatio) };
    this.zoomTarget = null;
  }

  rotateBy(yawDelta: number, pitchDelta: number): void {
    this.camera = {
      ...this.camera,
      yaw: this.camera.yaw + yawDelta,
      pitch: clampPitch(this.camera.pitch + pitchDelta),
    };
  }

  zoomBy(
    factor: number,
    cursorHorizontal: number,
    cursorVertical: number,
    reducedMotion: boolean,
  ): void {
    const base = this.zoomTarget ?? this.camera.distance;
    this.zoomTarget = clampDistance(base * factor);
    this.zoomCursor = { horizontal: cursorHorizontal, vertical: cursorVertical };
    if (reducedMotion) {
      this.applyZoom(Number.POSITIVE_INFINITY, true);
    }
  }

  update(now: number, deltaMilliseconds: number, conditions: MotionConditions): void {
    this.stepFlight(now);
    this.stepLook(deltaMilliseconds, conditions);
    if (this.flight === null) {
      this.applyZoom(deltaMilliseconds, conditions.reducedMotion);
    }
    this.stepRotation(now, deltaMilliseconds, conditions);
  }

  private stepFlight(now: number): void {
    const flight = this.flight;
    if (flight === null) {
      return;
    }
    const progress = clamp((now - flight.startTime) / flight.durationMilliseconds, 0, 1);
    this.camera = interpolateCamera(
      flight.from,
      flight.to,
      easeInOutCubic(progress),
      progress,
      flight.bump,
    );
    if (progress >= 1) {
      this.flight = null;
      this.camera = { ...flight.to };
      flight.onArrive?.();
    }
  }

  private stepLook(deltaMilliseconds: number, conditions: MotionConditions): void {
    const target = conditions.skyActive ? this.lookTarget : { x: 0, y: 0 };
    const easing = conditions.reducedMotion
      ? 1
      : 1 - Math.exp(-deltaMilliseconds / POINTER_LOOK_EASING_MILLISECONDS);
    this.look = {
      x: this.look.x + (target.x * POINTER_LOOK_FRACTION - this.look.x) * easing,
      y: this.look.y + (-target.y * POINTER_LOOK_FRACTION - this.look.y) * easing,
    };
  }

  private applyZoom(deltaMilliseconds: number, reducedMotion: boolean): void {
    if (this.zoomTarget === null) {
      return;
    }
    const logarithm = Math.log(this.zoomTarget / this.camera.distance);
    const settled = Math.abs(logarithm) < ZOOM_SETTLED_LOGARITHM || reducedMotion;
    const nextDistance = settled
      ? this.zoomTarget
      : this.camera.distance *
        Math.exp(logarithm * (1 - Math.exp(-deltaMilliseconds / ZOOM_EASING_MILLISECONDS)));
    this.camera = zoomAboutCursor(
      this.camera,
      this.look,
      nextDistance,
      this.zoomCursor.horizontal,
      this.zoomCursor.vertical,
    );
    if (nextDistance === this.zoomTarget) {
      this.zoomTarget = null;
    }
  }

  private stepRotation(now: number, deltaMilliseconds: number, conditions: MotionConditions): void {
    const moving = !conditions.reducedMotion && this.flight === null && !this.dragging;
    if (!moving) {
      this.driftAmount = 0;
      return;
    }
    const hasInertia =
      Math.abs(this.yawVelocity) > INERTIA_STOP_THRESHOLD ||
      Math.abs(this.pitchVelocity) > INERTIA_STOP_THRESHOLD;
    if (hasInertia) {
      this.camera = {
        ...this.camera,
        yaw: this.camera.yaw + this.yawVelocity * deltaMilliseconds,
        pitch: clampPitch(this.camera.pitch + this.pitchVelocity * deltaMilliseconds),
      };
      const decay = Math.exp(-deltaMilliseconds / INERTIA_DECAY_MILLISECONDS);
      this.yawVelocity *= decay;
      this.pitchVelocity *= decay;
      this.driftAmount = 0;
      return;
    }
    if (!conditions.skyActive) {
      this.camera = {
        ...this.camera,
        yaw: this.camera.yaw + deltaMilliseconds * BACKGROUND_TURN_RADIANS_PER_MILLISECOND,
      };
      this.driftAmount = 0;
      return;
    }
    const idle = this.idleMilliseconds(now) > IDLE_BEFORE_DRIFT_MILLISECONDS;
    if (idle && conditions.driftAllowed && this.zoomTarget === null) {
      this.driftAmount = Math.min(
        1,
        this.driftAmount + deltaMilliseconds / DRIFT_RAMP_MILLISECONDS,
      );
      const smoothed = this.driftAmount * this.driftAmount * (3 - 2 * this.driftAmount);
      this.camera = {
        ...this.camera,
        yaw: this.camera.yaw + deltaMilliseconds * DRIFT_RADIANS_PER_MILLISECOND * smoothed,
      };
    } else {
      this.driftAmount = 0;
    }
  }
}
