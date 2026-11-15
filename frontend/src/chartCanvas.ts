import {
  CHART_FOCUS_COLOR,
  CHART_GRID_COLOR,
  CHART_HIGHLIGHT_COLOR,
  CHART_TEXT_COLOR,
  ANNOTATION_COLOR,
} from "./canvasColors";
import type { ChartModel, PlottedPoint } from "./chartModels";

export interface ChartCanvas {
  draw(model: ChartModel, focusedPoint: PlottedPoint | null): void;
}

const MAXIMUM_DEVICE_PIXEL_RATIO = 2;
const FONT_SIZE_PIXELS = 11;
const TICK_LABEL_GAP = 6;
const TICK_LABEL_BASELINE = 4;
const BAND_LABEL_GAP = 8;
const X_LABEL_OFFSET = 16;
const TITLE_BOTTOM_GAP = 4;
const Y_TITLE_X = 12;
const ERROR_BAR_WIDTH = 1.2;
const ERROR_BAR_OPACITY = 0.6;
const POINT_OUTLINE_WIDTH = 1.4;
const SELECTED_RING_GAP = 2.5;
const FOCUS_RING_GAP = 4;
const FOCUS_RING_WIDTH = 2;

function requireContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("This browser cannot draw the charts.");
  }
  return context;
}

function drawBands(context: CanvasRenderingContext2D, model: ChartModel): void {
  const { bounds } = model;
  for (const band of model.bands) {
    context.globalAlpha = band.opacity;
    context.fillStyle = band.color;
    context.fillRect(band.left, bounds.top, band.right - band.left, bounds.bottom - bounds.top);
    context.globalAlpha = 1;
    if (band.label !== null) {
      context.fillStyle = band.isHighlighted ? CHART_HIGHLIGHT_COLOR : CHART_TEXT_COLOR;
      context.textAlign = "center";
      context.fillText(band.label, (band.left + band.right) / 2, bounds.top - BAND_LABEL_GAP);
    }
  }
}

function drawAxes(context: CanvasRenderingContext2D, model: ChartModel): void {
  const { bounds, geometry } = model;
  context.strokeStyle = CHART_GRID_COLOR;
  context.lineWidth = 1;
  context.fillStyle = CHART_TEXT_COLOR;
  context.textAlign = "right";
  for (const tick of model.yTicks) {
    context.beginPath();
    context.moveTo(bounds.left, tick.position);
    context.lineTo(bounds.right, tick.position);
    context.stroke();
    context.fillText(tick.label, bounds.left - TICK_LABEL_GAP, tick.position + TICK_LABEL_BASELINE);
  }
  context.textAlign = "center";
  for (const tick of model.xTicks) {
    context.fillText(tick.label, tick.position, bounds.bottom + X_LABEL_OFFSET);
  }
  context.fillText(
    model.xTitle,
    (bounds.left + bounds.right) / 2,
    geometry.height - TITLE_BOTTOM_GAP,
  );
  context.save();
  context.translate(Y_TITLE_X, (bounds.top + bounds.bottom) / 2);
  context.rotate(-Math.PI / 2);
  context.fillText(model.yTitle, 0, 0);
  context.restore();
}

function drawPoint(context: CanvasRenderingContext2D, plotted: PlottedPoint): void {
  context.globalAlpha = plotted.opacity;
  if (plotted.errorTop !== null && plotted.errorBottom !== null) {
    context.globalAlpha = plotted.opacity * ERROR_BAR_OPACITY;
    context.strokeStyle = plotted.color;
    context.lineWidth = ERROR_BAR_WIDTH;
    context.beginPath();
    context.moveTo(plotted.x, plotted.errorTop);
    context.lineTo(plotted.x, plotted.errorBottom);
    context.stroke();
    context.globalAlpha = plotted.opacity;
  }
  context.beginPath();
  context.arc(plotted.x, plotted.y, plotted.radius, 0, Math.PI * 2);
  context.globalAlpha = plotted.opacity * plotted.fillOpacity;
  context.fillStyle = plotted.color;
  context.fill();
  context.globalAlpha = plotted.opacity;
  context.strokeStyle = plotted.color;
  context.lineWidth = POINT_OUTLINE_WIDTH;
  context.stroke();
  if (plotted.isSelected) {
    context.beginPath();
    context.arc(plotted.x, plotted.y, plotted.radius + SELECTED_RING_GAP, 0, Math.PI * 2);
    context.strokeStyle = ANNOTATION_COLOR;
    context.stroke();
  }
  context.globalAlpha = 1;
}

function drawFocusRing(context: CanvasRenderingContext2D, plotted: PlottedPoint): void {
  context.beginPath();
  context.arc(plotted.x, plotted.y, plotted.radius + FOCUS_RING_GAP, 0, Math.PI * 2);
  context.strokeStyle = CHART_FOCUS_COLOR;
  context.lineWidth = FOCUS_RING_WIDTH;
  context.stroke();
}

export function createChartCanvas(canvas: HTMLCanvasElement, monospaceFont: string): ChartCanvas {
  return {
    draw(model, focusedPoint): void {
      const devicePixelRatio = Math.min(window.devicePixelRatio || 1, MAXIMUM_DEVICE_PIXEL_RATIO);
      const { width, height } = model.geometry;
      canvas.width = Math.round(width * devicePixelRatio);
      canvas.height = Math.round(height * devicePixelRatio);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      const context = requireContext(canvas);
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      context.clearRect(0, 0, width, height);
      context.font = `${FONT_SIZE_PIXELS}px ${monospaceFont}`;
      drawBands(context, model);
      drawAxes(context, model);
      context.save();
      context.beginPath();
      context.rect(
        model.bounds.left,
        model.bounds.top,
        model.bounds.right - model.bounds.left,
        model.bounds.bottom - model.bounds.top,
      );
      context.clip();
      for (const plotted of model.plotted) {
        drawPoint(context, plotted);
      }
      context.restore();
      if (focusedPoint) {
        drawFocusRing(context, focusedPoint);
      }
    },
  };
}
