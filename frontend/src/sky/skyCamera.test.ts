import { describe, expect, it } from "vitest";
import {
  cameraLookingAt,
  computeCameraBasis,
  DEFAULT_CAMERA,
  focalLength,
  interpolateCamera,
  projectToScreen,
  rotateByDrag,
  zoomAboutCursor,
} from "./skyCamera";
import { dot, vectorLength } from "./skyMath";

const NO_LOOK = { x: 0, y: 0 };
const VIEWPORT = { width: 1000, height: 800 };

describe("skyCamera", () => {
  it("builds an orthonormal basis that looks at the focus point", () => {
    const basis = computeCameraBasis(DEFAULT_CAMERA, NO_LOOK);
    expect(vectorLength(basis.forward)).toBeCloseTo(1, 10);
    expect(dot(basis.forward, basis.right)).toBeCloseTo(0, 10);
    expect(dot(basis.forward, basis.up)).toBeCloseTo(0, 10);
    expect(vectorLength(basis.position)).toBeCloseTo(DEFAULT_CAMERA.distance, 10);
  });

  it("projects the focus point to the centre of the screen", () => {
    const basis = computeCameraBasis(DEFAULT_CAMERA, NO_LOOK);
    const point = projectToScreen(basis, DEFAULT_CAMERA.focus, VIEWPORT);
    expect(point.x).toBeCloseTo(500, 6);
    expect(point.y).toBeCloseTo(400, 6);
    expect(point.depth).toBeCloseTo(DEFAULT_CAMERA.distance, 6);
  });

  it("uses a focal length that follows the larger of height and three quarters of the width", () => {
    expect(focalLength({ width: 1000, height: 800 })).toBeCloseTo(840, 6);
    expect(focalLength({ width: 2000, height: 800 })).toBeCloseTo(1575, 6);
  });

  it("looks at a target from a distance, with the target in the middle of the screen", () => {
    const position: [number, number, number] = [3, -2, 1];
    const camera = cameraLookingAt(position, 2);
    const screen = projectToScreen(computeCameraBasis(camera, NO_LOOK), position, VIEWPORT);
    expect(screen.x).toBeCloseTo(500, 6);
    expect(screen.y).toBeCloseTo(400, 6);
  });

  it("starts and ends a flight at the given cameras", () => {
    const to = cameraLookingAt([5, 5, 5], 3);
    const start = interpolateCamera(DEFAULT_CAMERA, to, 0, 0, 0.2);
    const end = interpolateCamera(DEFAULT_CAMERA, to, 1, 1, 0.2);
    expect(start.distance).toBeCloseTo(DEFAULT_CAMERA.distance, 6);
    expect(end.distance).toBeCloseTo(3, 6);
    expect(end.focus[0]).toBeCloseTo(5, 6);
  });

  it("rotates by dragging and limits the pitch", () => {
    const rotated = rotateByDrag(DEFAULT_CAMERA, 100, 0);
    expect(rotated.yaw).toBeLessThan(DEFAULT_CAMERA.yaw);
    expect(rotateByDrag(DEFAULT_CAMERA, 0, 1e6).pitch).toBe(1.5);
  });

  it("keeps the point under the cursor fixed while zooming", () => {
    const cursorHorizontal = 0.2;
    const cursorVertical = -0.1;
    const nextDistance = 8;
    const before = computeCameraBasis(DEFAULT_CAMERA, NO_LOOK);
    const zoomed = zoomAboutCursor(
      DEFAULT_CAMERA,
      NO_LOOK,
      nextDistance,
      cursorHorizontal,
      cursorVertical,
    );
    const after = computeCameraBasis(zoomed, NO_LOOK);
    const length = focalLength(VIEWPORT);
    const anchor: [number, number, number] = [
      before.position[0] +
        DEFAULT_CAMERA.distance *
          (before.forward[0] + before.right[0] * cursorHorizontal + before.up[0] * cursorVertical),
      before.position[1] +
        DEFAULT_CAMERA.distance *
          (before.forward[1] + before.right[1] * cursorHorizontal + before.up[1] * cursorVertical),
      before.position[2] +
        DEFAULT_CAMERA.distance *
          (before.forward[2] + before.right[2] * cursorHorizontal + before.up[2] * cursorVertical),
    ];
    const screenBefore = projectToScreen(before, anchor, VIEWPORT);
    const screenAfter = projectToScreen(after, anchor, VIEWPORT);
    expect(screenAfter.x).toBeCloseTo(screenBefore.x, 4);
    expect(screenAfter.y).toBeCloseTo(screenBefore.y, 4);
    expect(screenBefore.x).toBeCloseTo(500 + cursorHorizontal * length, 4);
  });
});
