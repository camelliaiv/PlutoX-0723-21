import type { ImagePoint } from "./markers";

export interface PlayerLayout {
  ringSize: number;
  canvasSize: number;
}

export interface ScaleBar {
  arcseconds: number;
  lengthPixels: number;
}

export const ZOOM_LEVELS: readonly number[] = [1, 2, 3, 4, 6, 8];
export const DEFAULT_ZOOM = 1;

const MINIMUM_RING_SIZE = 260;
const MAXIMUM_RING_SIZE = 760;
const WIDE_HEIGHT_RESERVE = 330;
const NARROW_HEIGHT_RESERVE = 250;
const WIDE_CANVAS_RATIO = 0.58;
const NARROW_CANVAS_RATIO = 0.66;
const MINIMUM_PIXEL_BLOCK = 4;
const SCALE_BAR_ARCSECONDS: readonly number[] = [10, 30, 60, 120, 300];
const SCALE_BAR_MAXIMUM_SHARE = 0.38;
const ARCSECONDS_PER_ARCMINUTE = 60;

export function parseZoom(text: string | null): number | null {
  const zoom = text !== null && /^\d+$/.test(text) ? Number(text) : Number.NaN;
  return ZOOM_LEVELS.includes(zoom) ? zoom : null;
}

export function nextZoom(current: number, direction: 1 | -1): number {
  const index = ZOOM_LEVELS.indexOf(current);
  const nextIndex = Math.min(ZOOM_LEVELS.length - 1, Math.max(0, index + direction));
  return ZOOM_LEVELS[nextIndex] ?? DEFAULT_ZOOM;
}

export function computePlayerLayout(
  stageWidth: number,
  viewportHeight: number,
  isNarrow: boolean,
  sizePixels: number,
): PlayerLayout {
  const heightReserve = isNarrow ? NARROW_HEIGHT_RESERVE : WIDE_HEIGHT_RESERVE;
  const available = Math.min(stageWidth, viewportHeight - heightReserve, MAXIMUM_RING_SIZE);
  const ringSize = Math.max(MINIMUM_RING_SIZE, available);
  const ratio = isNarrow ? NARROW_CANVAS_RATIO : WIDE_CANVAS_RATIO;
  const pixelBlock = Math.max(MINIMUM_PIXEL_BLOCK, Math.floor((ringSize * ratio) / sizePixels));
  return { ringSize, canvasSize: pixelBlock * sizePixels };
}

export function clampCentre(centre: ImagePoint, sizePixels: number, zoom: number): ImagePoint {
  const halfVisible = sizePixels / (2 * zoom);
  return {
    x: Math.min(sizePixels - halfVisible, Math.max(halfVisible, centre.x)),
    y: Math.min(sizePixels - halfVisible, Math.max(halfVisible, centre.y)),
  };
}

function canvasPixelsPerImagePixel(canvasSize: number, sizePixels: number, zoom: number): number {
  return (canvasSize / sizePixels) * zoom;
}

export function imageToCanvas(
  point: ImagePoint,
  centre: ImagePoint,
  canvasSize: number,
  sizePixels: number,
  zoom: number,
): ImagePoint {
  const scale = canvasPixelsPerImagePixel(canvasSize, sizePixels, zoom);
  return {
    x: (point.x - centre.x) * scale + canvasSize / 2,
    y: (point.y - centre.y) * scale + canvasSize / 2,
  };
}

export function canvasToImage(
  point: ImagePoint,
  centre: ImagePoint,
  canvasSize: number,
  sizePixels: number,
  zoom: number,
): ImagePoint {
  const scale = canvasPixelsPerImagePixel(canvasSize, sizePixels, zoom);
  return {
    x: (point.x - canvasSize / 2) / scale + centre.x,
    y: (point.y - canvasSize / 2) / scale + centre.y,
  };
}

export function centreAfterZoom(
  anchor: ImagePoint,
  anchorOnCanvas: ImagePoint,
  canvasSize: number,
  sizePixels: number,
  newZoom: number,
): ImagePoint {
  const scale = canvasPixelsPerImagePixel(canvasSize, sizePixels, newZoom);
  return clampCentre(
    {
      x: anchor.x - (anchorOnCanvas.x - canvasSize / 2) / scale,
      y: anchor.y - (anchorOnCanvas.y - canvasSize / 2) / scale,
    },
    sizePixels,
    newZoom,
  );
}

export function chooseScaleBar(pixelsPerArcsecond: number, canvasSize: number): ScaleBar | null {
  const fitting = SCALE_BAR_ARCSECONDS.filter(
    (arcseconds) => arcseconds * pixelsPerArcsecond <= canvasSize * SCALE_BAR_MAXIMUM_SHARE,
  );
  const arcseconds = fitting[fitting.length - 1];
  return arcseconds === undefined
    ? null
    : { arcseconds, lengthPixels: arcseconds * pixelsPerArcsecond };
}

export function formatScaleBarLabel(arcseconds: number): string {
  return arcseconds >= ARCSECONDS_PER_ARCMINUTE
    ? `${arcseconds / ARCSECONDS_PER_ARCMINUTE}′`
    : `${arcseconds}″`;
}

export function pixelIndicesAt(
  imagePoint: ImagePoint,
  sizePixels: number,
): { column: number; row: number } | null {
  const column = Math.floor(imagePoint.x);
  const row = sizePixels - 1 - Math.floor(imagePoint.y);
  const isInside = column >= 0 && column < sizePixels && row >= 0 && row < sizePixels;
  return isInside ? { column, row } : null;
}
