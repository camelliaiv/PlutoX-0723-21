import { formatEpochDates } from "./dateText";
import { DETECTOR_BANDS, formatWavelengthRange } from "./detectors";
import { createElement } from "./dom";
import { epochColor } from "./epochRings";
import { paintFramePixels } from "./frameCanvas";
import {
  buildMatrixLayout,
  frameIndexInRow,
  type MatrixCell,
  type MatrixRow,
} from "./matrixLayout";
import type { PlayerSettings } from "./playerSettings";
import { describeMatrixCell } from "./pixelScaleText";
import { buildThumbnailPixels, type PreparedFrames } from "./preparedFrames";

export interface MatrixSelection {
  detector: number;
  frameIndex: number;
}

export interface TimeMatrixHandlers {
  onSelectFrame(detector: number, frameIndex: number): void;
}

export interface TimeMatrix {
  render(
    preparedByDetector: ReadonlyMap<number, PreparedFrames>,
    settings: PlayerSettings,
    selection: MatrixSelection,
  ): void;
  highlight(selection: MatrixSelection): void;
}

const MISSING_FRAME_TEXT = "no frame";
const NOT_LOADED_TEXT = "not loaded";

export function createTimeMatrix(container: HTMLElement, handlers: TimeMatrixHandlers): TimeMatrix {
  let rows: MatrixRow[] = [];

  function createHeader(detector: number, selection: () => MatrixSelection): HTMLButtonElement {
    const band = DETECTOR_BANDS.find((candidate) => candidate.number === detector);
    const range = band
      ? formatWavelengthRange(band.minimumMicrometers, band.maximumMicrometers)
      : "";
    const header = createElement("button");
    header.type = "button";
    header.className = "matrix-header";
    header.dataset["detector"] = String(detector);
    header.setAttribute("aria-label", `Detector ${detector}, ${range}`);
    header.append(createElement("b", `D${detector}`), createElement("span", range));
    header.addEventListener("click", () => {
      const current = selection();
      const currentRow = rows.find(
        (row) => frameIndexInRow(row, current.detector) === current.frameIndex,
      );
      const sameEpochIndex = currentRow ? frameIndexInRow(currentRow, detector) : null;
      handlers.onSelectFrame(detector, sameEpochIndex ?? 0);
    });
    return header;
  }

  function createRowLabel(row: MatrixRow): HTMLDivElement {
    const label = createElement("div");
    label.className = "matrix-row-label";
    label.dataset["epochNumber"] = String(row.epochNumber);
    const dot = createElement("span");
    dot.className = "matrix-epoch-dot";
    dot.style.setProperty("--epoch-color", epochColor(row.epochRank, rows.length));
    const text = createElement("span");
    text.append(
      createElement("b", `Epoch ${row.epochNumber}`),
      createElement("small", formatEpochDates(row.startDate, row.endDate)),
    );
    label.append(dot, text);
    return label;
  }

  function createCell(
    row: MatrixRow,
    cell: MatrixCell,
    preparedByDetector: ReadonlyMap<number, PreparedFrames>,
    settings: PlayerSettings,
  ): HTMLElement {
    const prepared = preparedByDetector.get(cell.detector);
    if (cell.state !== "frame" || cell.frameIndex === null || !prepared) {
      const empty = createElement(
        "div",
        cell.state === "not-loaded" ? NOT_LOADED_TEXT : MISSING_FRAME_TEXT,
      );
      empty.className = "matrix-empty";
      return empty;
    }
    const frameIndex = cell.frameIndex;
    const button = createElement("button");
    button.type = "button";
    button.className = "matrix-cell";
    button.dataset["detector"] = String(cell.detector);
    button.dataset["frameIndex"] = String(frameIndex);
    button.style.setProperty("--epoch-color", epochColor(row.epochRank, rows.length));
    button.setAttribute(
      "aria-label",
      describeMatrixCell(cell.detector, row.epochNumber, row.startDate, row.endDate),
    );
    const thumbnail = createElement("canvas");
    paintFramePixels(
      thumbnail,
      buildThumbnailPixels(prepared, frameIndex, settings),
      prepared.response.grid.size_pixels,
    );
    button.append(thumbnail);
    button.addEventListener("click", () => handlers.onSelectFrame(cell.detector, frameIndex));
    return button;
  }

  let latestSelection: MatrixSelection = { detector: 0, frameIndex: 0 };

  function highlight(selection: MatrixSelection): void {
    latestSelection = selection;
    const selectedRow = rows.find(
      (row) => frameIndexInRow(row, selection.detector) === selection.frameIndex,
    );
    for (const header of container.querySelectorAll<HTMLElement>(".matrix-header")) {
      const isCurrent = header.dataset["detector"] === String(selection.detector);
      header.classList.toggle("matrix-header-current", isCurrent);
      header.setAttribute("aria-current", String(isCurrent));
    }
    for (const label of container.querySelectorAll<HTMLElement>(".matrix-row-label")) {
      label.classList.toggle(
        "matrix-row-label-current",
        label.dataset["epochNumber"] === String(selectedRow?.epochNumber),
      );
    }
    for (const button of container.querySelectorAll<HTMLElement>(".matrix-cell")) {
      const isCurrent =
        button.dataset["detector"] === String(selection.detector) &&
        button.dataset["frameIndex"] === String(selection.frameIndex);
      button.classList.toggle("matrix-cell-current", isCurrent);
      button.setAttribute("aria-pressed", String(isCurrent));
    }
  }

  return {
    render(preparedByDetector, settings, selection): void {
      rows = buildMatrixLayout(preparedByDetector).rows;
      latestSelection = selection;
      const grid = createElement("div");
      grid.className = "matrix-grid";
      const corner = createElement("div");
      corner.className = "matrix-corner";
      grid.append(
        corner,
        ...DETECTOR_BANDS.map((band) => createHeader(band.number, () => latestSelection)),
      );
      for (const row of rows) {
        grid.append(
          createRowLabel(row),
          ...row.cells.map((cell) => createCell(row, cell, preparedByDetector, settings)),
        );
      }
      container.replaceChildren(grid);
      highlight(selection);
    },
    highlight,
  };
}
