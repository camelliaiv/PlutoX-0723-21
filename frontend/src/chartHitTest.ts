export interface ChartPosition {
  x: number;
  y: number;
}

export function findNearestPosition(
  positions: readonly ChartPosition[],
  target: ChartPosition,
  maximumDistance: number,
): number | null {
  let nearestIndex: number | null = null;
  let nearestDistance = maximumDistance;
  positions.forEach((position, index) => {
    const distance = Math.hypot(position.x - target.x, position.y - target.y);
    if (distance <= nearestDistance) {
      nearestDistance = distance;
      nearestIndex = index;
    }
  });
  return nearestIndex;
}

export function stepIndex(currentIndex: number | null, step: number, itemCount: number): number {
  if (itemCount <= 0) {
    return 0;
  }
  if (currentIndex === null) {
    return step < 0 ? itemCount - 1 : 0;
  }
  return Math.min(itemCount - 1, Math.max(0, currentIndex + step));
}
