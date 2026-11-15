import { ANNOTATION_COLOR } from "./canvasColors";
import {
  buildLightCurveModel,
  buildSpectrumModel,
  LIGHT_CURVE_HEIGHT,
  LIGHT_CURVE_PADDING,
  MINIMUM_CHART_WIDTH,
  SPECTRUM_HEIGHT,
  SPECTRUM_PADDING,
  type ChartGeometry,
  type ChartModel,
  type ChartSelection,
} from "./chartModels";
import { createElement, requireElement } from "./dom";
import { epochColor } from "./epochRings";
import { createExposureChart, type ExposureChart } from "./exposureChart";
import {
  collectExposurePoints,
  pointsOfDetector,
  sortByDate,
  sortByWavelength,
  type ExposureCollection,
  type ExposurePoint,
} from "./exposurePoints";
import type { FramesCache } from "./framesCache";
import {
  describeExposureTotals,
  describeLightCurveCaption,
  describeLightCurveSummary,
  describeSelection,
  describeSpectrumCaption,
  describeSpectrumSummary,
} from "./pixelScaleText";
import { CHALLENGE_TARGETS, findChallengeTarget } from "./presets";
import type { TimeMachine } from "./timeMachine";
import { createTimeMatrix, type TimeMatrix } from "./timeMatrix";

export interface PixelScaleViewOptions {
  framesCache: FramesCache;
  timeMachine: Pick<
    TimeMachine,
    | "currentSelection"
    | "currentView"
    | "loadStatus"
    | "selectFrame"
    | "openTarget"
    | "requestAllDetectors"
  >;
  onShowInTimeMachine(): void;
}

export interface PixelScaleView {
  setActive(isActive: boolean): void;
  refresh(): void;
}

const CUSTOM_COORDINATES_VALUE = "";
const CUSTOM_COORDINATES_LABEL = "Custom coordinates";
const DETECTOR_COUNT = 6;
const RESIZE_DEBOUNCE_MILLISECONDS = 150;
const WAITING_MESSAGE = "Loading the real exposures for this target.";
const NO_FLUX_MESSAGE = "No exposure with a flux value is available here.";

function createLegendItem(color: string, text: string, isHollow: boolean): HTMLSpanElement {
  const item = createElement("span");
  item.className = "chart-legend-item";
  const dot = createElement("span");
  dot.className = isHollow ? "chart-legend-dot chart-legend-dot-hollow" : "chart-legend-dot";
  dot.style.setProperty("--epoch-color", color);
  item.append(dot, createElement("span", text));
  return item;
}

export function createPixelScaleView(options: PixelScaleViewOptions): PixelScaleView {
  const { framesCache, timeMachine } = options;
  const targetSelect = requireElement<HTMLSelectElement>("#pixel-target-select");
  const title = requireElement<HTMLElement>("#pixel-title");
  const subtitle = requireElement<HTMLElement>("#pixel-subtitle");
  const statusMessage = requireElement<HTMLElement>("#pixel-status");
  const content = requireElement<HTMLElement>("#pixel-content");
  const selectionText = requireElement<HTMLElement>("#pixel-selection-text");
  const openButton = requireElement<HTMLButtonElement>("#pixel-open-button");
  const logarithmicToggle = requireElement<HTMLButtonElement>("#logarithmic-toggle");
  const epochLegend = requireElement<HTMLElement>("#epoch-legend");
  const spectrumCaption = requireElement<HTMLElement>("#spectrum-caption");
  const lightCurveHeading = requireElement<HTMLElement>("#light-curve-heading");
  const lightCurveCaption = requireElement<HTMLElement>("#light-curve-caption");

  const monospaceFont = getComputedStyle(document.body).getPropertyValue("--font-mono");
  const selectFromChart = (point: ExposurePoint): void =>
    timeMachine.selectFrame(point.detector, point.frameIndex);
  const spectrumChart: ExposureChart = createExposureChart(
    requireElement<HTMLElement>("#spectrum-chart"),
    monospaceFont,
    selectFromChart,
  );
  const lightCurveChart: ExposureChart = createExposureChart(
    requireElement<HTMLElement>("#light-curve-chart"),
    monospaceFont,
    selectFromChart,
  );
  const matrix: TimeMatrix = createTimeMatrix(requireElement<HTMLElement>("#time-matrix"), {
    onSelectFrame: (detector, frameIndex) => timeMachine.selectFrame(detector, frameIndex),
  });

  let isActive = false;
  let isLogarithmic = false;
  let matrixKey = "";
  let resizeTimer: number | null = null;

  const customOption = createElement("option", CUSTOM_COORDINATES_LABEL);
  customOption.value = CUSTOM_COORDINATES_VALUE;
  customOption.disabled = true;
  targetSelect.append(customOption);
  for (const challengeTarget of CHALLENGE_TARGETS) {
    const option = createElement("option", challengeTarget.name);
    option.value = challengeTarget.slug;
    targetSelect.append(option);
  }

  function chartGeometry(chart: ExposureChart, height: number, padding: ChartGeometry["padding"]) {
    return { width: Math.max(MINIMUM_CHART_WIDTH, chart.availableWidth()), height, padding };
  }

  function buildDataKey(collection: ExposureCollection): string {
    const loaded = [...framesCache.all().keys()].sort().join(",");
    const reference = [...framesCache.all().values()][0]?.response.reference_position;
    return `${reference?.right_ascension}|${reference?.declination}|${loaded}|${collection.points.length}`;
  }

  function renderEpochLegend(collection: ExposureCollection): void {
    const count = collection.epochNumbers.length;
    epochLegend.replaceChildren(
      ...collection.epochNumbers.map((epochNumber, rank) =>
        createLegendItem(epochColor(rank, count), `epoch ${epochNumber}`, false),
      ),
      createLegendItem(ANNOTATION_COLOR, "hollow = saturated", true),
    );
  }

  function visiblePoints(model: ChartModel, points: ExposurePoint[]): ExposurePoint[] {
    const plotted = new Set(model.plotted.map((entry) => entry.point));
    return points.filter((point) => plotted.has(point));
  }

  function renderSpectrum(
    collection: ExposureCollection,
    selection: ChartSelection,
    dataKey: string,
  ): void {
    const model = buildSpectrumModel({
      points: collection.points,
      epochCount: collection.epochNumbers.length,
      geometry: chartGeometry(spectrumChart, SPECTRUM_HEIGHT, SPECTRUM_PADDING),
      isLogarithmic,
      selection,
      fluxUnit: collection.fluxUnit,
    });
    spectrumCaption.textContent = describeSpectrumCaption(collection, model.hiddenPointCount);
    spectrumChart.update({
      model,
      summary: describeSpectrumSummary(collection),
      emptyMessage: NO_FLUX_MESSAGE,
      fluxUnit: collection.fluxUnit,
      keyboardPoints: visiblePoints(
        model,
        sortByWavelength(pointsOfDetector(collection.points, selection.detector)),
      ),
      tablePoints: collection.points,
      dataKey,
    });
  }

  function renderLightCurve(
    collection: ExposureCollection,
    selection: ChartSelection,
    dataKey: string,
  ): void {
    const frames = framesCache.get(selection.detector)?.response.frames ?? [];
    const detectorPoints = pointsOfDetector(collection.points, selection.detector);
    lightCurveHeading.textContent = `Light curve · D${selection.detector}`;
    const model =
      frames.length === 0
        ? null
        : buildLightCurveModel({
            points: detectorPoints,
            frames,
            epochNumbers: collection.epochNumbers,
            geometry: chartGeometry(lightCurveChart, LIGHT_CURVE_HEIGHT, LIGHT_CURVE_PADDING),
            isLogarithmic,
            selection,
            fluxUnit: collection.fluxUnit,
          });
    lightCurveCaption.textContent = describeLightCurveCaption(
      collection.fluxUnit,
      model?.hiddenPointCount ?? 0,
    );
    lightCurveChart.update({
      model,
      summary: describeLightCurveSummary(selection.detector, detectorPoints, collection.fluxUnit),
      emptyMessage: `No exposure with a flux value for D${selection.detector}.`,
      fluxUnit: collection.fluxUnit,
      keyboardPoints: model ? visiblePoints(model, sortByDate(detectorPoints)) : [],
      tablePoints: detectorPoints,
      dataKey: `${dataKey}|${selection.detector}`,
    });
  }

  function renderSelection(collection: ExposureCollection, selection: ChartSelection): void {
    const frame = framesCache.get(selection.detector)?.response.frames[selection.frameIndex];
    openButton.disabled = !frame;
    selectionText.textContent = frame
      ? describeSelection({
          detector: selection.detector,
          epochNumber: frame.epoch_number,
          epochCount: collection.epochNumbers.length,
          startDate: frame.start_date,
          endDate: frame.end_date,
          minimumMicrometers: frame.wavelength_min_micrometers,
          maximumMicrometers: frame.wavelength_max_micrometers,
        })
      : "Select a point or a frame.";
  }

  function renderHeading(collection: ExposureCollection): void {
    const slug = timeMachine.currentView().targetSlug;
    title.textContent = findChallengeTarget(slug)?.name ?? CUSTOM_COORDINATES_LABEL;
    targetSelect.value = slug ?? CUSTOM_COORDINATES_VALUE;
    subtitle.textContent = `${describeExposureTotals(collection)} · ${framesCache.all().size} of ${DETECTOR_COUNT} detectors loaded`;
  }

  function renderStatus(): void {
    const loadedCount = framesCache.all().size;
    const status = timeMachine.loadStatus();
    if (loadedCount === 0) {
      statusMessage.hidden = false;
      statusMessage.className = status?.isError ? "error" : "status";
      statusMessage.setAttribute("role", status?.isError ? "alert" : "status");
      statusMessage.textContent = status?.message ?? WAITING_MESSAGE;
    } else if (loadedCount < DETECTOR_COUNT) {
      statusMessage.hidden = false;
      statusMessage.className = "status";
      statusMessage.setAttribute("role", "status");
      statusMessage.textContent = `Loaded ${loadedCount} of ${DETECTOR_COUNT} detectors. The others are still loading and will appear as they arrive.`;
    } else {
      statusMessage.hidden = true;
    }
    content.hidden = loadedCount === 0;
  }

  function render(): void {
    renderStatus();
    if (framesCache.all().size === 0) {
      title.textContent =
        findChallengeTarget(timeMachine.currentView().targetSlug)?.name ?? "Pixel scale";
      subtitle.textContent = "";
      return;
    }
    const collection = collectExposurePoints(framesCache.all());
    const frameSelection = timeMachine.currentSelection();
    const selection: ChartSelection = {
      detector: frameSelection.detector,
      frameIndex: frameSelection.epochIndex,
    };
    const dataKey = buildDataKey(collection);
    renderHeading(collection);
    renderEpochLegend(collection);
    logarithmicToggle.setAttribute("aria-pressed", String(isLogarithmic));
    renderSelection(collection, selection);
    renderSpectrum(collection, selection, dataKey);
    renderLightCurve(collection, selection, dataKey);

    const settings = timeMachine.currentView().settings;
    const newMatrixKey = `${dataKey}|${settings.colorMap}|${settings.stretch}`;
    if (newMatrixKey === matrixKey) {
      matrix.highlight(selection);
    } else {
      matrixKey = newMatrixKey;
      matrix.render(framesCache.all(), settings, selection);
    }
  }

  function refresh(): void {
    if (isActive) {
      render();
    }
  }

  targetSelect.addEventListener("change", () => {
    if (targetSelect.value !== CUSTOM_COORDINATES_VALUE) {
      timeMachine.openTarget(targetSelect.value);
    }
  });
  logarithmicToggle.addEventListener("click", () => {
    isLogarithmic = !isLogarithmic;
    refresh();
  });
  openButton.addEventListener("click", () => options.onShowInTimeMachine());
  window.addEventListener("resize", () => {
    if (resizeTimer !== null) {
      window.clearTimeout(resizeTimer);
    }
    resizeTimer = window.setTimeout(() => {
      if (isActive && framesCache.all().size > 0) {
        render();
      }
    }, RESIZE_DEBOUNCE_MILLISECONDS);
  });

  return {
    setActive(newIsActive): void {
      isActive = newIsActive;
      if (isActive) {
        timeMachine.requestAllDetectors();
        render();
      }
    },
    refresh,
  };
}
