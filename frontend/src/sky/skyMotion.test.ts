import { describe, expect, it, vi } from "vitest";
import { DEFAULT_CAMERA } from "./skyCamera";
import { IDLE_BEFORE_DRIFT_MILLISECONDS, SkyMotion, type MotionConditions } from "./skyMotion";

const ACTIVE: MotionConditions = { reducedMotion: false, skyActive: true, driftAllowed: true };

function advance(motion: SkyMotion, from: number, to: number, conditions = ACTIVE): void {
  for (let time = from; time < to; time += 16) {
    motion.update(time, 16, conditions);
  }
}

describe("SkyMotion", () => {
  it("flies to the target camera and reports the arrival once", () => {
    const motion = new SkyMotion();
    const onArrive = vi.fn();
    const target = { ...DEFAULT_CAMERA, yaw: 2, distance: 3 };
    motion.startFlight(target, 1000, 0, false, { onArrive });
    expect(motion.isFlying).toBe(true);
    advance(motion, 16, 1100);
    expect(motion.isFlying).toBe(false);
    expect(motion.camera.distance).toBe(3);
    expect(motion.camera.yaw).toBeCloseTo(2, 10);
    expect(onArrive).toHaveBeenCalledTimes(1);
  });

  it("jumps straight to the target under reduced motion", () => {
    const motion = new SkyMotion();
    const onArrive = vi.fn();
    motion.startFlight({ ...DEFAULT_CAMERA, distance: 5 }, 1000, 0, true, { onArrive });
    expect(motion.camera.distance).toBe(5);
    expect(motion.isFlying).toBe(false);
    expect(onArrive).toHaveBeenCalledTimes(1);
  });

  it("starts drifting only after three seconds without interaction", () => {
    const motion = new SkyMotion();
    motion.noteInteraction(0);
    advance(motion, 16, IDLE_BEFORE_DRIFT_MILLISECONDS);
    expect(motion.camera.yaw).toBe(DEFAULT_CAMERA.yaw);
    advance(motion, IDLE_BEFORE_DRIFT_MILLISECONDS + 16, IDLE_BEFORE_DRIFT_MILLISECONDS + 2000);
    expect(motion.camera.yaw).toBeGreaterThan(DEFAULT_CAMERA.yaw);
  });

  it("does not drift while drifting is not allowed or motion is reduced", () => {
    const blocked = new SkyMotion();
    advance(blocked, 4000, 6000, { ...ACTIVE, driftAllowed: false });
    expect(blocked.camera.yaw).toBe(DEFAULT_CAMERA.yaw);
    const reduced = new SkyMotion();
    advance(reduced, 4000, 6000, { ...ACTIVE, reducedMotion: true });
    expect(reduced.camera.yaw).toBe(DEFAULT_CAMERA.yaw);
  });

  it("keeps turning after a quick drag and slows down", () => {
    const motion = new SkyMotion();
    motion.beginDrag(0);
    motion.dragBy(-40, 0, 16, false);
    motion.endDrag(20);
    const yawAtRelease = motion.camera.yaw;
    advance(motion, 36, 300);
    const yawAfterInertia = motion.camera.yaw;
    expect(yawAfterInertia).toBeGreaterThan(yawAtRelease);
    advance(motion, 300, 5000, { ...ACTIVE, driftAllowed: false });
    const finalYaw = motion.camera.yaw;
    advance(motion, 5000, 5300, { ...ACTIVE, driftAllowed: false });
    expect(motion.camera.yaw - finalYaw).toBeLessThan(1e-4);
  });

  it("eases the distance towards the zoom target", () => {
    const motion = new SkyMotion();
    motion.zoomBy(0.5, 0, 0, false);
    expect(motion.isZooming).toBe(true);
    advance(motion, 16, 2000);
    expect(motion.isZooming).toBe(false);
    expect(motion.camera.distance).toBeCloseTo(DEFAULT_CAMERA.distance * 0.5, 6);
  });

  it("zooms at once under reduced motion", () => {
    const motion = new SkyMotion();
    motion.zoomBy(2, 0, 0, true);
    expect(motion.camera.distance).toBeCloseTo(DEFAULT_CAMERA.distance * 2, 6);
    expect(motion.isZooming).toBe(false);
  });

  it("limits the zoom range", () => {
    const motion = new SkyMotion();
    motion.zoomBy(1e9, 0, 0, true);
    expect(motion.camera.distance).toBe(4000);
    motion.zoomBy(1e-9, 0, 0, true);
    expect(motion.camera.distance).toBe(0.3);
  });

  it("follows the pointer with a small eased offset only in the sky", () => {
    const motion = new SkyMotion();
    motion.setLookTarget(1, 0);
    advance(motion, 16, 2000);
    expect(motion.look.x).toBeCloseTo(0.05, 3);
    advance(motion, 2000, 4000, { ...ACTIVE, skyActive: false });
    expect(Math.abs(motion.look.x)).toBeLessThan(1e-3);
  });

  it("returns to a given camera on reset", () => {
    const motion = new SkyMotion();
    motion.zoomBy(3, 0, 0, true);
    motion.reset(DEFAULT_CAMERA);
    expect(motion.camera).toEqual(DEFAULT_CAMERA);
    expect(motion.isFlying).toBe(false);
  });
});
