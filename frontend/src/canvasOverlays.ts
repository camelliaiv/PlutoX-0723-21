import { ANNOTATION_COLOR, MARKER_COLOR, MARKER_LABEL_COLOR, OUTLINE_COLOR } from "./canvasColors";
import { epochColor } from "./epochRings";
import type { ImagePoint, TrackPoint } from "./markers";
import { formatScaleBarLabel, type ScaleBar } from "./viewport";

export interface OverlayFonts {
  body: string;
  mono: string;
}

export type ToCanvas = (point: ImagePoint) => ImagePoint;

const TRACK_DASH: readonly number[] = [5, 5];
const TRACK_LINE_WIDTH = 2;
const CURRENT_DOT_RADIUS = 4;
const OTHER_DOT_RADIUS = 3;
const MINIMUM_MARKER_RADIUS = 6;
const MARKER_RADIUS_PER_PIXEL_BLOCK = 0.375;
const MARKER_LABEL = "predicted";
const COMPASS_ARM = 14;
const COMPASS_HEAD_LENGTH = 5;
const COMPASS_HEAD_WIDTH = 3;
const COMPASS_RIGHT_INSET = 34;
const COMPASS_TOP_INSET = 36;
const SCALE_BAR_INSET = 14;
const SCALE_BAR_BOTTOM_INSET = 16;
const SCALE_BAR_TICK = 4;
const ANNOTATION_BLUR = 4;

function strokeCircle(
  context: CanvasRenderingContext2D,
  centre: ImagePoint,
  radius: number,
  color: string,
  lineWidth: number,
): void {
  context.lineWidth = lineWidth;
  context.strokeStyle = color;
  context.beginPath();
  context.arc(centre.x, centre.y, radius, 0, Math.PI * 2);
  context.stroke();
}

export function drawTrack(
  context: CanvasRenderingContext2D,
  points: TrackPoint[],
  currentEpochIndex: number,
  epochCount: number,
  toCanvas: ToCanvas,
): void {
  const first = points[0];
  const last = points[points.length - 1];
  if (!first || !last || points.length < 2) {
    return;
  }
  const canvasPoints = points.map((track) => toCanvas(track.point));
  const start = toCanvas(first.point);
  const end = toCanvas(last.point);
  const gradient = context.createLinearGradient(start.x, start.y, end.x, end.y);
  gradient.addColorStop(0, epochColor(first.epochIndex, epochCount));
  gradient.addColorStop(1, epochColor(last.epochIndex, epochCount));
  context.lineWidth = TRACK_LINE_WIDTH;
  context.setLineDash([...TRACK_DASH]);
  context.strokeStyle = gradient;
  context.beginPath();
  canvasPoints.forEach((point, index) => {
    if (index === 0) {
      context.moveTo(point.x, point.y);
    } else {
      context.lineTo(point.x, point.y);
    }
  });
  context.stroke();
  context.setLineDash([]);
  points.forEach((track, index) => {
    const point = canvasPoints[index] ?? start;
    context.fillStyle = epochColor(track.epochIndex, epochCount);
    context.strokeStyle = OUTLINE_COLOR;
    context.lineWidth = 1;
    context.beginPath();
    context.arc(
      point.x,
      point.y,
      track.epochIndex === currentEpochIndex ? CURRENT_DOT_RADIUS : OTHER_DOT_RADIUS,
      0,
      Math.PI * 2,
    );
    context.fill();
    context.stroke();
  });
}

export function drawMarkers(
  context: CanvasRenderingContext2D,
  points: TrackPoint[],
  currentEpochIndex: number,
  epochCount: number,
  showAllEpochs: boolean,
  canvasPixelsPerImagePixel: number,
  toCanvas: ToCanvas,
  fonts: OverlayFonts,
): void {
  const radius = Math.max(
    MINIMUM_MARKER_RADIUS,
    MARKER_RADIUS_PER_PIXEL_BLOCK * canvasPixelsPerImagePixel,
  );
  for (const track of points) {
    const isCurrent = track.epochIndex === currentEpochIndex;
    if (!showAllEpochs && !isCurrent) {
      continue;
    }
    const centre = toCanvas(track.point);
    strokeCircle(context, centre, radius + 1, OUTLINE_COLOR, 3);
    strokeCircle(
      context,
      centre,
      radius,
      isCurrent ? MARKER_COLOR : epochColor(track.epochIndex, epochCount),
      2,
    );
    if (isCurrent) {
      context.font = `600 11px ${fonts.body}`;
      context.fillStyle = MARKER_LABEL_COLOR;
      context.shadowColor = OUTLINE_COLOR;
      context.shadowBlur = ANNOTATION_BLUR;
      context.textAlign = "left";
      context.fillText(MARKER_LABEL, centre.x + radius + 5, centre.y - radius * 0.2);
      context.shadowBlur = 0;
    }
  }
}

function addArrow(
  context: CanvasRenderingContext2D,
  origin: ImagePoint,
  direction: ImagePoint,
): void {
  const tip = { x: origin.x + direction.x * COMPASS_ARM, y: origin.y + direction.y * COMPASS_ARM };
  const sideways = { x: -direction.y, y: direction.x };
  context.moveTo(origin.x, origin.y);
  context.lineTo(tip.x, tip.y);
  for (const side of [1, -1]) {
    context.moveTo(tip.x, tip.y);
    context.lineTo(
      tip.x - direction.x * COMPASS_HEAD_LENGTH + sideways.x * side * COMPASS_HEAD_WIDTH,
      tip.y - direction.y * COMPASS_HEAD_LENGTH + sideways.y * side * COMPASS_HEAD_WIDTH,
    );
  }
}

export function drawCompass(
  context: CanvasRenderingContext2D,
  canvasSize: number,
  fonts: OverlayFonts,
): void {
  const origin = { x: canvasSize - COMPASS_RIGHT_INSET, y: COMPASS_TOP_INSET };
  context.shadowColor = OUTLINE_COLOR;
  context.shadowBlur = ANNOTATION_BLUR;
  context.fillStyle = ANNOTATION_COLOR;
  context.strokeStyle = ANNOTATION_COLOR;
  context.lineWidth = 1.5;
  context.font = `600 12px ${fonts.body}`;
  context.textAlign = "center";
  context.beginPath();
  addArrow(context, origin, { x: 0, y: -1 });
  addArrow(context, origin, { x: -1, y: 0 });
  context.stroke();
  context.fillText("N", origin.x, origin.y - COMPASS_ARM - 4);
  context.fillText("E", origin.x - COMPASS_ARM - 10, origin.y + 4);
  context.shadowBlur = 0;
}

export function drawScaleBar(
  context: CanvasRenderingContext2D,
  scaleBar: ScaleBar,
  canvasSize: number,
  fonts: OverlayFonts,
): void {
  const right = canvasSize - SCALE_BAR_INSET;
  const left = right - scaleBar.lengthPixels;
  const baseline = canvasSize - SCALE_BAR_BOTTOM_INSET;
  context.shadowColor = OUTLINE_COLOR;
  context.shadowBlur = ANNOTATION_BLUR;
  context.fillStyle = ANNOTATION_COLOR;
  context.strokeStyle = ANNOTATION_COLOR;
  context.lineWidth = 2;
  context.beginPath();
  context.moveTo(left, baseline);
  context.lineTo(right, baseline);
  context.moveTo(left, baseline - SCALE_BAR_TICK);
  context.lineTo(left, baseline + SCALE_BAR_TICK);
  context.moveTo(right, baseline - SCALE_BAR_TICK);
  context.lineTo(right, baseline + SCALE_BAR_TICK);
  context.stroke();
  context.font = `600 11px ${fonts.mono}`;
  context.textAlign = "right";
  context.fillText(formatScaleBarLabel(scaleBar.arcseconds), right, baseline - 8);
  context.shadowBlur = 0;
}
