export type KeyboardAction = "toggle" | "previous" | "next";

export function stepFrameIndex(currentIndex: number, step: number, frameCount: number): number {
  if (frameCount <= 0) {
    return 0;
  }
  return (((currentIndex + step) % frameCount) + frameCount) % frameCount;
}

export function intervalMilliseconds(framesPerSecond: number): number {
  return Math.round(1000 / framesPerSecond);
}

export function keyboardActionFor(key: string): KeyboardAction | null {
  switch (key) {
    case " ":
      return "toggle";
    case "ArrowLeft":
      return "previous";
    case "ArrowRight":
      return "next";
    default:
      return null;
  }
}
