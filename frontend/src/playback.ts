import type { DisplayMode } from "./frameModes";

export type KeyboardAction =
  | { kind: "toggle" }
  | { kind: "previous" }
  | { kind: "next" }
  | { kind: "mode"; mode: DisplayMode }
  | { kind: "zoom"; direction: 1 | -1 }
  | { kind: "overlay"; overlay: "marker" | "track" }
  | { kind: "colorMap" }
  | { kind: "saturation" };

export const SPEED_MULTIPLIERS: readonly number[] = [0.5, 1, 2, 4];
export const DEFAULT_SPEED_MULTIPLIER = 1;

const BASE_BLINK_MILLISECONDS = 1500;

export function stepFrameIndex(currentIndex: number, step: number, frameCount: number): number {
  if (frameCount <= 0) {
    return 0;
  }
  return (((currentIndex + step) % frameCount) + frameCount) % frameCount;
}

export function intervalMilliseconds(speedMultiplier: number): number {
  return Math.round(BASE_BLINK_MILLISECONDS / speedMultiplier);
}

export function keyboardActionFor(key: string): KeyboardAction | null {
  switch (key) {
    case " ":
      return { kind: "toggle" };
    case "ArrowLeft":
      return { kind: "previous" };
    case "ArrowRight":
      return { kind: "next" };
    case "1":
      return { kind: "mode", mode: "frame" };
    case "2":
      return { kind: "mode", mode: "difference" };
    case "3":
      return { kind: "mode", mode: "stack" };
    case "+":
    case "=":
      return { kind: "zoom", direction: 1 };
    case "-":
      return { kind: "zoom", direction: -1 };
    case "t":
    case "T":
      return { kind: "overlay", overlay: "track" };
    case "m":
    case "M":
      return { kind: "overlay", overlay: "marker" };
    case "c":
    case "C":
      return { kind: "colorMap" };
    case "s":
    case "S":
      return { kind: "saturation" };
    default:
      return null;
  }
}
