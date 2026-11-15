import { createChartCanvas, type ChartCanvas } from "./chartCanvas";
import { findNearestPosition, stepIndex } from "./chartHitTest";
import type { ChartModel, PlottedPoint } from "./chartModels";
import { formatModifiedJulianDate } from "./dateText";
import { createElement } from "./dom";
import type { ExposurePoint } from "./exposurePoints";
import { describePoint, describeTooltip, formatFluxValue } from "./pixelScaleText";

export interface ExposureChartContent {
  model: ChartModel | null;
  summary: string;
  emptyMessage: string;
  fluxUnit: string;
  keyboardPoints: readonly ExposurePoint[];
  tablePoints: readonly ExposurePoint[];
  dataKey: string;
}

export interface ExposureChart {
  availableWidth(): number;
  update(content: ExposureChartContent): void;
  redraw(): void;
}

const HIT_DISTANCE_PIXELS = 10;
const TABLE_HEADINGS = [
  "Detector",
  "Epoch",
  "Date",
  "Wavelength (µm)",
  "Flux",
  "Flux error",
  "Saturated fraction",
];

function buildTable(points: readonly ExposurePoint[], fluxUnit: string): HTMLTableElement {
  const table = createElement("table");
  table.className = "visually-hidden";
  table.append(createElement("caption", `Exposure values, flux in ${fluxUnit}`));
  const headRow = createElement("tr");
  headRow.append(...TABLE_HEADINGS.map((heading) => createElement("th", heading)));
  const head = createElement("thead");
  head.append(headRow);
  table.append(head);
  const body = createElement("tbody");
  for (const point of points) {
    const row = createElement("tr");
    row.append(
      ...[
        `D${point.detector}`,
        String(point.epochNumber),
        formatModifiedJulianDate(point.modifiedJulianDate),
        point.wavelengthMicrometers.toFixed(3),
        formatFluxValue(point.flux),
        point.fluxError === null ? "not reported" : formatFluxValue(point.fluxError),
        point.saturatedFraction === null ? "not reported" : point.saturatedFraction.toFixed(2),
      ].map((text) => createElement("td", text)),
    );
    body.append(row);
  }
  table.append(body);
  return table;
}

export function createExposureChart(
  container: HTMLElement,
  monospaceFont: string,
  onSelectPoint: (point: ExposurePoint) => void,
): ExposureChart {
  const surface = createElement("div");
  surface.className = "chart-surface";
  const canvasElement = createElement("canvas");
  canvasElement.className = "chart-canvas";
  canvasElement.tabIndex = 0;
  canvasElement.setAttribute("role", "application");
  const tooltip = createElement("div");
  tooltip.className = "chart-tooltip";
  tooltip.setAttribute("role", "tooltip");
  tooltip.hidden = true;
  const emptyMessage = createElement("p");
  emptyMessage.className = "chart-empty";
  const announcer = createElement("p");
  announcer.className = "visually-hidden";
  announcer.setAttribute("aria-live", "polite");
  const tableHost = createElement("div");
  surface.append(canvasElement, tooltip, emptyMessage, announcer, tableHost);
  container.append(surface);

  const chartCanvas: ChartCanvas = createChartCanvas(canvasElement, monospaceFont);
  let content: ExposureChartContent | null = null;
  let tableKey = "";
  let focusIndex: number | null = null;
  let isFocused = false;

  function plottedFor(point: ExposurePoint | undefined): PlottedPoint | null {
    return content?.model?.plotted.find((plotted) => plotted.point === point) ?? null;
  }

  function focusedPlottedPoint(): PlottedPoint | null {
    if (!isFocused || focusIndex === null) {
      return null;
    }
    return plottedFor(content?.keyboardPoints[focusIndex]);
  }

  function redraw(): void {
    if (content?.model) {
      chartCanvas.draw(content.model, focusedPlottedPoint());
    }
  }

  function pointerPlottedPoint(event: MouseEvent): PlottedPoint | null {
    const plotted = content?.model?.plotted ?? [];
    const bounds = canvasElement.getBoundingClientRect();
    const index = findNearestPosition(
      plotted,
      { x: event.clientX - bounds.left, y: event.clientY - bounds.top },
      HIT_DISTANCE_PIXELS,
    );
    return index === null ? null : (plotted[index] ?? null);
  }

  function showTooltip(plotted: PlottedPoint | null): void {
    if (!plotted || !content) {
      tooltip.hidden = true;
      canvasElement.classList.remove("chart-canvas-pointing");
      return;
    }
    const text = describeTooltip(plotted.point, content.fluxUnit);
    const title = createElement("b", text.title);
    const lines = text.lines.map((line) => {
      const element = createElement("div", line);
      element.className = "chart-tooltip-line";
      return element;
    });
    tooltip.replaceChildren(title, ...lines);
    tooltip.hidden = false;
    tooltip.style.left = `${plotted.x + 14}px`;
    tooltip.style.top = `${plotted.y + 14}px`;
    canvasElement.classList.add("chart-canvas-pointing");
  }

  canvasElement.addEventListener("pointermove", (event) => {
    showTooltip(pointerPlottedPoint(event));
  });
  canvasElement.addEventListener("pointerleave", () => showTooltip(null));
  canvasElement.addEventListener("click", (event) => {
    const plotted = pointerPlottedPoint(event);
    if (plotted) {
      showTooltip(null);
      onSelectPoint(plotted.point);
    }
  });

  canvasElement.addEventListener("focus", () => {
    isFocused = true;
    const points = content?.keyboardPoints ?? [];
    const selectedIndex = points.findIndex((point) => plottedFor(point)?.isSelected);
    focusIndex ??= selectedIndex >= 0 ? selectedIndex : points.length > 0 ? 0 : null;
    redraw();
  });
  canvasElement.addEventListener("blur", () => {
    isFocused = false;
    redraw();
  });
  canvasElement.addEventListener("keydown", (event) => {
    const points = content?.keyboardPoints ?? [];
    if (points.length === 0 || event.altKey || event.ctrlKey || event.metaKey) {
      return;
    }
    const step = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (step !== 0) {
      event.preventDefault();
      focusIndex = stepIndex(focusIndex, step, points.length);
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault();
      focusIndex = event.key === "Home" ? 0 : points.length - 1;
    } else if ((event.key === "Enter" || event.key === " ") && focusIndex !== null) {
      event.preventDefault();
      const point = points[focusIndex];
      if (point) {
        onSelectPoint(point);
      }
      return;
    } else {
      return;
    }
    const focused = points[focusIndex ?? 0];
    announcer.textContent = focused ? describePoint(focused, content?.fluxUnit ?? "") : "";
    redraw();
  });

  return {
    availableWidth: () => container.clientWidth,
    update(newContent): void {
      content = newContent;
      canvasElement.setAttribute("aria-label", newContent.summary);
      const hasModel = newContent.model !== null && newContent.model.plotted.length > 0;
      canvasElement.hidden = !hasModel;
      emptyMessage.hidden = hasModel;
      emptyMessage.textContent = newContent.emptyMessage;
      if (newContent.dataKey !== tableKey) {
        tableKey = newContent.dataKey;
        tableHost.replaceChildren(buildTable(newContent.tablePoints, newContent.fluxUnit));
        focusIndex = null;
      }
      showTooltip(null);
      if (hasModel) {
        redraw();
      }
    },
    redraw,
  };
}
