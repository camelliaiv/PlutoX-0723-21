import type { FramesResponse } from "./api";
import { createElement, requireElement } from "./dom";
import { drawFrame } from "./frameCanvas";
import {
  describeSaturation,
  formatFrameLabel,
  formatFrameProvenance,
  formatFrameSource,
  formatReferencePosition,
} from "./frameText";
import { intervalMilliseconds, keyboardActionFor, stepFrameIndex } from "./playback";

export const LOADING_MESSAGE = "Reading SPHEREx exposures… this can take up to a minute";

export interface FramesPlayer {
  showLoading(): void;
  showError(message: string): void;
  showFrames(response: FramesResponse, targetNotice: string | undefined): void;
}

export function createFramesPlayer(): FramesPlayer {
  const statusMessage = requireElement<HTMLParagraphElement>("#frames-status");
  const noticesContainer = requireElement<HTMLDivElement>("#frame-notices");
  const playerPanel = requireElement<HTMLElement>("#player-panel");
  const frameLabel = requireElement<HTMLParagraphElement>("#frame-label");
  const frameCanvas = requireElement<HTMLCanvasElement>("#frame-canvas");
  const playButton = requireElement<HTMLButtonElement>("#play-button");
  const speedSelect = requireElement<HTMLSelectElement>("#speed-select");
  const frameSlider = requireElement<HTMLInputElement>("#frame-slider");
  const saturationToggle = requireElement<HTMLInputElement>("#saturation-toggle");
  const provenance = requireElement<HTMLParagraphElement>("#frame-provenance");
  const source = requireElement<HTMLParagraphElement>("#frame-source");
  const reference = requireElement<HTMLParagraphElement>("#frame-reference");
  const citations = requireElement<HTMLDivElement>("#frame-citations");

  let currentResponse: FramesResponse | null = null;
  let currentIndex = 0;
  let playbackTimer: number | null = null;

  function stopPlayback(): void {
    if (playbackTimer !== null) {
      window.clearInterval(playbackTimer);
      playbackTimer = null;
    }
    playButton.textContent = "Play";
  }

  function showFrame(index: number): void {
    if (!currentResponse) {
      return;
    }
    currentIndex = index;
    const frame = currentResponse.frames[index];
    if (!frame) {
      return;
    }
    drawFrame(
      frameCanvas,
      frame,
      currentResponse.grid,
      currentResponse.display_range,
      saturationToggle.checked,
    );
    const label = formatFrameLabel(frame);
    frameLabel.textContent = label;
    frameCanvas.setAttribute("aria-label", `SPHEREx frame. ${label}`);
    provenance.textContent = formatFrameProvenance(frame);
    frameSlider.value = String(index);
    frameSlider.setAttribute(
      "aria-valuetext",
      `Frame ${index + 1} of ${currentResponse.frames.length}`,
    );
  }

  function step(stepSize: number): void {
    if (currentResponse) {
      showFrame(stepFrameIndex(currentIndex, stepSize, currentResponse.frames.length));
    }
  }

  function startPlayback(): void {
    stopPlayback();
    playbackTimer = window.setInterval(
      () => step(1),
      intervalMilliseconds(Number(speedSelect.value)),
    );
    playButton.textContent = "Pause";
  }

  function togglePlayback(): void {
    if (playbackTimer === null) {
      startPlayback();
    } else {
      stopPlayback();
    }
  }

  function renderNotices(messages: string[]): void {
    const noticeList = createElement("ul");
    for (const message of messages) {
      noticeList.append(createElement("li", message));
    }
    noticesContainer.replaceChildren(...(messages.length > 0 ? [noticeList] : []));
  }

  function clear(): void {
    stopPlayback();
    currentResponse = null;
    playerPanel.hidden = true;
    statusMessage.className = "status";
    statusMessage.removeAttribute("role");
    statusMessage.textContent = "";
    noticesContainer.replaceChildren();
  }

  playButton.addEventListener("click", togglePlayback);
  speedSelect.addEventListener("change", () => {
    if (playbackTimer !== null) {
      startPlayback();
    }
  });
  frameSlider.addEventListener("input", () => showFrame(Number(frameSlider.value)));
  saturationToggle.addEventListener("change", () => showFrame(currentIndex));
  document.addEventListener("keydown", (event) => {
    const action = keyboardActionFor(event.key);
    const isFormControl =
      event.target instanceof Element && event.target.closest("input, select, textarea, button");
    if (
      !action ||
      !currentResponse ||
      isFormControl ||
      event.altKey ||
      event.ctrlKey ||
      event.metaKey
    ) {
      return;
    }
    event.preventDefault();
    if (action === "toggle") {
      togglePlayback();
    } else {
      stopPlayback();
      step(action === "next" ? 1 : -1);
    }
  });

  return {
    showLoading(): void {
      clear();
      statusMessage.textContent = LOADING_MESSAGE;
    },
    showError(message: string): void {
      clear();
      statusMessage.className = "error";
      statusMessage.setAttribute("role", "alert");
      statusMessage.textContent = message;
    },
    showFrames(response: FramesResponse, targetNotice: string | undefined): void {
      clear();
      const saturationNotice = describeSaturation(response.frames);
      const notices = [targetNotice, saturationNotice, ...response.notes].filter(
        (notice): notice is string => typeof notice === "string",
      );
      renderNotices(notices);
      if (response.frames.length === 0) {
        statusMessage.textContent = "No SPHEREx frames could be built for this selection.";
        return;
      }
      currentResponse = response;
      frameSlider.max = String(response.frames.length - 1);
      source.textContent = formatFrameSource(response);
      reference.textContent = formatReferencePosition(response);
      citations.replaceChildren(
        ...response.citations.map((citation) => createElement("p", `${citation}.`)),
      );
      playerPanel.hidden = false;
      showFrame(0);
    },
  };
}
