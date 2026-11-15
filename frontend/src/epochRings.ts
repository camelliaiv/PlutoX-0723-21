import { interpolateStops, type ColorStop } from "./colorMaps";
import type { DisplayMode } from "./frameModes";

export interface RingState {
  isGlowing: boolean;
  opacity: number;
}

export interface RingStates {
  blue: RingState;
  orange: RingState;
}

const EPOCH_COLOR_STOPS: readonly ColorStop[] = [
  [0, [61, 165, 255]],
  [0.5, [214, 205, 245]],
  [1, [255, 138, 31]],
];

const DIMMED_OPACITY = 0.3;
const OPACITY_SWING = 1 - DIMMED_OPACITY;

function epochPosition(epochIndex: number, epochCount: number): number {
  return epochCount <= 1 ? 0 : epochIndex / (epochCount - 1);
}

export function epochColor(epochIndex: number, epochCount: number): string {
  const [red, green, blue] = interpolateStops(
    EPOCH_COLOR_STOPS,
    epochPosition(epochIndex, epochCount),
  );
  return `rgb(${red}, ${green}, ${blue})`;
}

export function ringStates(mode: DisplayMode, epochIndex: number, epochCount: number): RingStates {
  if (mode !== "frame") {
    return {
      blue: { isGlowing: true, opacity: 1 },
      orange: { isGlowing: true, opacity: 1 },
    };
  }
  const position = epochPosition(epochIndex, epochCount);
  return {
    blue: { isGlowing: position <= 0.5, opacity: 1 - OPACITY_SWING * position },
    orange: { isGlowing: position >= 0.5, opacity: DIMMED_OPACITY + OPACITY_SWING * position },
  };
}
