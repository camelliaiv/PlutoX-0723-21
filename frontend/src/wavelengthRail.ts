import { createElement, requireElement } from "./dom";
import { DETECTOR_BANDS, formatWavelengthRange } from "./detectors";
import { meanSaturationOfDetector } from "./factsText";
import { paintFramePixels } from "./frameCanvas";
import type { PlayerSettings } from "./playerSettings";
import { buildThumbnailPixels, type PreparedFrames } from "./preparedFrames";

export interface WavelengthRailHandlers {
  onSelectDetector(detector: number): void;
  onSelectEpoch(detector: number, epochIndex: number): void;
}

export interface WavelengthRail {
  render(
    preparedByDetector: ReadonlyMap<number, PreparedFrames>,
    settings: PlayerSettings,
    detector: number,
    epochIndex: number,
  ): void;
  highlight(detector: number, epochIndex: number): void;
  clear(): void;
}

const PERCENT = 100;

function createSaturationBar(meanSaturation: number | null): HTMLDivElement {
  const bar = createElement("div");
  bar.className = "rail-saturation";
  if (meanSaturation !== null) {
    bar.title = `Mean saturated fraction of the exposures: ${meanSaturation.toFixed(2)}`;
    const fill = createElement("i");
    fill.style.width = `${meanSaturation * PERCENT}%`;
    bar.append(fill);
  }
  return bar;
}

export function createWavelengthRail(handlers: WavelengthRailHandlers): WavelengthRail {
  const rail = requireElement<HTMLElement>("#wavelength-rail");
  const heading = requireElement<HTMLElement>("#wavelength-rail > h3");

  function render(
    preparedByDetector: ReadonlyMap<number, PreparedFrames>,
    settings: PlayerSettings,
    detector: number,
    epochIndex: number,
  ): void {
    const groups = DETECTOR_BANDS.map((band) => {
      const range = formatWavelengthRange(band.minimumMicrometers, band.maximumMicrometers);
      const prepared = preparedByDetector.get(band.number);
      const group = createElement("div");
      group.className = "rail-detector";
      group.dataset["detector"] = String(band.number);

      const head = createElement("button");
      head.type = "button";
      head.className = "rail-head";
      head.setAttribute("aria-label", `Detector ${band.number}, ${range}`);
      head.append(createElement("b", `D${band.number}`), createElement("span", range));
      head.addEventListener("click", () => handlers.onSelectDetector(band.number));

      const cells = createElement("div");
      cells.className = "rail-cells";
      prepared?.response.frames.forEach((_, index) => {
        const cell = createElement("button");
        cell.type = "button";
        cell.className = "rail-cell";
        cell.dataset["epoch"] = String(index);
        cell.setAttribute("aria-label", `D${band.number}, epoch ${index + 1}`);
        const thumbnail = createElement("canvas");
        paintFramePixels(
          thumbnail,
          buildThumbnailPixels(prepared, index, settings),
          prepared.response.grid.size_pixels,
        );
        cell.append(thumbnail);
        cell.addEventListener("click", () => handlers.onSelectEpoch(band.number, index));
        cells.append(cell);
      });

      group.append(
        head,
        createSaturationBar(prepared ? meanSaturationOfDetector(prepared.response) : null),
        cells,
      );
      return group;
    });
    rail.replaceChildren(heading, ...groups);
    highlight(detector, epochIndex);
  }

  function highlight(detector: number, epochIndex: number): void {
    for (const group of rail.querySelectorAll<HTMLElement>(".rail-detector")) {
      const isCurrent = group.dataset["detector"] === String(detector);
      group.classList.toggle("rail-detector-current", isCurrent);
      if (isCurrent) {
        group.querySelector(".rail-head")?.setAttribute("aria-current", "true");
      } else {
        group.querySelector(".rail-head")?.removeAttribute("aria-current");
      }
      for (const cell of group.querySelectorAll<HTMLElement>(".rail-cell")) {
        const isSelected = isCurrent && cell.dataset["epoch"] === String(epochIndex);
        cell.classList.toggle("rail-cell-current", isSelected);
        cell.setAttribute("aria-pressed", String(isSelected));
      }
    }
  }

  return {
    render,
    highlight,
    clear(): void {
      rail.replaceChildren(heading);
    },
  };
}
