import {
  add,
  clamp,
  cross,
  scale,
  shortestAngleDelta,
  subtract,
  vectorLength,
  type Vector3,
} from "./skyMath";

export interface CameraState {
  focus: Vector3;
  yaw: number;
  pitch: number;
  distance: number;
}

export interface LookOffset {
  x: number;
  y: number;
}

export interface CameraBasis {
  forward: Vector3;
  right: Vector3;
  up: Vector3;
  position: Vector3;
}

export interface Viewport {
  width: number;
  height: number;
}

export interface ScreenPoint {
  x: number;
  y: number;
  depth: number;
  distance: number;
}

export const DEFAULT_CAMERA: CameraState = {
  focus: [0, 0, 0],
  yaw: 0.6,
  pitch: 0.38,
  distance: 16,
};

export const MINIMUM_CAMERA_DISTANCE = 0.3;
export const MAXIMUM_CAMERA_DISTANCE = 4000;
export const PITCH_LIMIT = 1.5;

const FOCAL_LENGTH_MARGIN = 1.05;
const FOCAL_LENGTH_WIDTH_FACTOR = 0.75;
const TARGET_PITCH_OFFSET = 0.12;
const TARGET_YAW_OFFSET = 0.5;
const TARGET_PITCH_LIMIT = 1.3;
const FLIGHT_BUMP_PER_LOGARITHM = 0.12;
const FLIGHT_BUMP_BASE = 0.15;
const DRAG_RADIANS_PER_PIXEL = 0.0055;
const DRAG_DISTANCE_REFERENCE = 40;

export function clampDistance(distance: number): number {
  return clamp(distance, MINIMUM_CAMERA_DISTANCE, MAXIMUM_CAMERA_DISTANCE);
}

export function clampPitch(pitch: number): number {
  return clamp(pitch, -PITCH_LIMIT, PITCH_LIMIT);
}

export function focalLength(viewport: Viewport): number {
  return (
    Math.max(viewport.height, viewport.width * FOCAL_LENGTH_WIDTH_FACTOR) * FOCAL_LENGTH_MARGIN
  );
}

export function computeCameraBasis(camera: CameraState, look: LookOffset): CameraBasis {
  const cosinePitch = Math.cos(camera.pitch);
  const towardsCamera: Vector3 = [
    cosinePitch * Math.cos(camera.yaw),
    cosinePitch * Math.sin(camera.yaw),
    Math.sin(camera.pitch),
  ];
  const forward = scale(towardsCamera, -1);
  const horizontalLength = Math.hypot(forward[1], forward[0]) || 1;
  const right: Vector3 = [forward[1] / horizontalLength, -forward[0] / horizontalLength, 0];
  const up = cross(right, forward);
  const offset = add(scale(right, look.x * camera.distance), scale(up, look.y * camera.distance));
  const position = add(add(camera.focus, scale(towardsCamera, camera.distance)), offset);
  return { forward, right, up, position };
}

export function projectToScreen(
  basis: CameraBasis,
  point: Vector3,
  viewport: Viewport,
): ScreenPoint {
  const relative = subtract(point, basis.position);
  const depth =
    relative[0] * basis.forward[0] +
    relative[1] * basis.forward[1] +
    relative[2] * basis.forward[2];
  const horizontal =
    relative[0] * basis.right[0] + relative[1] * basis.right[1] + relative[2] * basis.right[2];
  const vertical =
    relative[0] * basis.up[0] + relative[1] * basis.up[1] + relative[2] * basis.up[2];
  const length = focalLength(viewport);
  return {
    x: viewport.width / 2 + (horizontal / depth) * length,
    y: viewport.height / 2 - (vertical / depth) * length,
    depth,
    distance: vectorLength(relative),
  };
}

export function cameraLookingAt(position: Vector3, distance: number): CameraState {
  const length = vectorLength(position) || 1;
  const direction = scale(position, 1 / length);
  return {
    focus: position,
    yaw: Math.atan2(-direction[1], -direction[0]) + TARGET_YAW_OFFSET,
    pitch: clamp(
      Math.asin(-direction[2]) + TARGET_PITCH_OFFSET,
      -TARGET_PITCH_LIMIT,
      TARGET_PITCH_LIMIT,
    ),
    distance,
  };
}

export function flightBump(from: CameraState, to: CameraState): number {
  return clamp(
    Math.abs(Math.log(to.distance / from.distance)) * FLIGHT_BUMP_PER_LOGARITHM + FLIGHT_BUMP_BASE,
    0.1,
    0.5,
  );
}

export function interpolateCamera(
  from: CameraState,
  to: CameraState,
  easedProgress: number,
  linearProgress: number,
  bump: number,
): CameraState {
  const logarithmicDistance =
    Math.log(from.distance) +
    (Math.log(to.distance) - Math.log(from.distance)) * easedProgress +
    Math.sin(Math.PI * linearProgress) * bump * Math.log(1 + Math.max(from.distance, to.distance));
  return {
    focus: add(from.focus, scale(subtract(to.focus, from.focus), easedProgress)),
    yaw: from.yaw + shortestAngleDelta(from.yaw, to.yaw) * easedProgress,
    pitch: from.pitch + (to.pitch - from.pitch) * easedProgress,
    distance: Math.exp(logarithmicDistance),
  };
}

export function dragRadiansPerPixel(camera: CameraState): number {
  return DRAG_RADIANS_PER_PIXEL * clamp(camera.distance / DRAG_DISTANCE_REFERENCE, 0.5, 1.5);
}

export function rotateByDrag(camera: CameraState, deltaX: number, deltaY: number): CameraState {
  const radiansPerPixel = dragRadiansPerPixel(camera);
  return {
    ...camera,
    yaw: camera.yaw - deltaX * radiansPerPixel,
    pitch: clampPitch(camera.pitch + deltaY * radiansPerPixel),
  };
}

export function zoomAboutCursor(
  camera: CameraState,
  look: LookOffset,
  nextDistance: number,
  cursorHorizontal: number,
  cursorVertical: number,
): CameraState {
  const basis = computeCameraBasis(camera, look);
  const ratio = nextDistance / camera.distance;
  const anchor = add(
    basis.position,
    scale(
      add(
        basis.forward,
        add(scale(basis.right, cursorHorizontal), scale(basis.up, cursorVertical)),
      ),
      camera.distance,
    ),
  );
  return {
    ...camera,
    focus: add(anchor, scale(subtract(camera.focus, anchor), ratio)),
    distance: nextDistance,
  };
}
