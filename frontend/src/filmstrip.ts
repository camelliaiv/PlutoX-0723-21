import { formatEpochDates, formatShortDate } from "./dateText";
import { createElement, requireElement } from "./dom";
import { describeDetectorRange } from "./loadingText";
import { epochColor } from "./epochRings";
import { describeReleases } from "./frameText";
import { paintFramePixels } from "./frameCanvas";
import type { PlayerSettings } from "./playerSettings";
import { buildThumbnailPixels, type PreparedFrames } from "./preparedFrames";
import { buildTimeline } from "./timeline";

export interface Filmstrip {
  render(prepared: PreparedFrames, settings: PlayerSettings, epochIndex: number): void;
  highlight(epochIndex: number): void;
  clear(): void;
}

function describeExposureCount(exposureCount: number): string {
  return `${exposureCount} ${exposureCount === 1 ? "exposure" : "exposures"}`;
}

export function createFilmstrip(onSelectEpoch: (epochIndex: number) => void): Filmstrip {
  const container = requireElement<HTMLElement>("#filmstrip");
  const playhead = createElement("div");
  playhead.className = "filmstrip-playhead";
  let centrePercents: number[] = [];

  function render(prepared: PreparedFrames, settings: PlayerSettings, epochIndex: number): void {
    const { frames, grid } = prepared.response;
    const heading = createElement(
      "h3",
      `Epochs · ${describeDetectorRange(frames[0]?.detector ?? 0)}`,
    );
    heading.className = "panel-heading";

    const shots = createElement("div");
    shots.className = "filmstrip-shots";
    frames.forEach((frame, index) => {
      const color = epochColor(index, frames.length);
      const shot = createElement("button");
      shot.type = "button";
      shot.className = "filmstrip-shot";
      shot.dataset["epoch"] = String(index);
      shot.style.setProperty("--epoch-color", color);
      const thumbnail = createElement("canvas");
      paintFramePixels(
        thumbnail,
        buildThumbnailPixels(prepared, index, settings),
        grid.size_pixels,
      );
      const title = createElement("b", `Epoch ${frame.epoch_number}`);
      const dates = createElement("small", formatEpochDates(frame.start_date, frame.end_date));
      dates.className = "mono";
      const exposures = createElement(
        "small",
        `${describeExposureCount(frame.exposure_count)} · ${describeReleases(frame.data_releases)}`,
      );
      const text = createElement("span");
      text.append(title, dates, exposures);
      shot.append(thumbnail, text);
      shot.addEventListener("click", () => onSelectEpoch(index));
      shots.append(shot);
    });

    const timeline = createElement("div");
    timeline.className = "filmstrip-timeline";
    timeline.setAttribute("role", "group");
    timeline.setAttribute("aria-label", "Timeline of epochs");
    const axis = createElement("div");
    axis.className = "filmstrip-axis";
    timeline.append(axis, playhead);
    const segments = buildTimeline(frames);
    centrePercents = segments.map((segment) => segment.centrePercent);
    segments.forEach((segment) => {
      const frame = frames[segment.epochIndex];
      if (!frame) {
        return;
      }
      const bar = createElement("button");
      bar.type = "button";
      bar.className = "filmstrip-segment";
      bar.dataset["epoch"] = String(segment.epochIndex);
      bar.style.setProperty("--epoch-color", epochColor(segment.epochIndex, frames.length));
      bar.style.left = `${segment.startPercent}%`;
      bar.style.width = `${segment.widthPercent}%`;
      bar.setAttribute(
        "aria-label",
        `Epoch ${frame.epoch_number}, ${formatEpochDates(frame.start_date, frame.end_date)}`,
      );
      bar.addEventListener("click", () => onSelectEpoch(segment.epochIndex));
      const tick = createElement("span", formatShortDate(frame.start_date));
      tick.className = "filmstrip-tick";
      tick.style.left = `${segment.centrePercent}%`;
      timeline.append(bar, tick);
    });

    container.replaceChildren(heading, shots, timeline);
    highlight(epochIndex);
  }

  function highlight(epochIndex: number): void {
    playhead.style.left = `${centrePercents[epochIndex] ?? 0}%`;
    for (const element of container.querySelectorAll<HTMLElement>("[data-epoch]")) {
      const isCurrent = element.dataset["epoch"] === String(epochIndex);
      element.classList.toggle("filmstrip-current", isCurrent);
      element.setAttribute("aria-pressed", String(isCurrent));
    }
  }

  return {
    render,
    highlight,
    clear(): void {
      container.replaceChildren();
    },
  };
}
