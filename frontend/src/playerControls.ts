import { createElement, requireElement } from "./dom";
import { DEFAULT_SPEED_MULTIPLIER, SPEED_MULTIPLIERS } from "./playback";
import type { PlayerSettings } from "./playerSettings";

export interface PlayerControlsHandlers {
  onTogglePlay(): void;
  onPrevious(): void;
  onNext(): void;
  onSpeedChange(speedMultiplier: number): void;
  onSettingsChange(change: Partial<PlayerSettings>): void;
  onZoom(direction: 1 | -1): void;
}

export interface PlayerControls {
  showSettings(settings: PlayerSettings): void;
  showPlaying(isPlaying: boolean): void;
}

function bindSegmentedGroup(selector: string, onSelect: (value: string) => void): void {
  const group = requireElement<HTMLElement>(selector);
  const buttons = Array.from(group.querySelectorAll<HTMLButtonElement>("button"));
  for (const button of buttons) {
    button.addEventListener("click", () => onSelect(button.dataset["value"] ?? ""));
  }
}

function showSegmentedValue(selector: string, value: string): void {
  const group = requireElement<HTMLElement>(selector);
  for (const button of group.querySelectorAll<HTMLButtonElement>("button")) {
    button.setAttribute("aria-pressed", String(button.dataset["value"] === value));
  }
}

export function createPlayerControls(handlers: PlayerControlsHandlers): PlayerControls {
  const playButton = requireElement<HTMLButtonElement>("#play-button");
  const speedSelect = requireElement<HTMLSelectElement>("#speed-select");
  const zoomValue = requireElement<HTMLElement>("#zoom-value");
  const markerToggle = requireElement<HTMLButtonElement>("#marker-toggle");
  const trackToggle = requireElement<HTMLButtonElement>("#track-toggle");
  const saturationToggle = requireElement<HTMLButtonElement>("#saturation-toggle");
  let shownSettings: PlayerSettings | null = null;

  for (const speedMultiplier of SPEED_MULTIPLIERS) {
    const option = createElement("option", `${speedMultiplier}×`);
    option.value = String(speedMultiplier);
    speedSelect.append(option);
  }
  speedSelect.value = String(DEFAULT_SPEED_MULTIPLIER);

  playButton.addEventListener("click", handlers.onTogglePlay);
  requireElement<HTMLButtonElement>("#previous-button").addEventListener(
    "click",
    handlers.onPrevious,
  );
  requireElement<HTMLButtonElement>("#next-button").addEventListener("click", handlers.onNext);
  speedSelect.addEventListener("change", () => handlers.onSpeedChange(Number(speedSelect.value)));
  requireElement<HTMLButtonElement>("#zoom-in-button").addEventListener("click", () =>
    handlers.onZoom(1),
  );
  requireElement<HTMLButtonElement>("#zoom-out-button").addEventListener("click", () =>
    handlers.onZoom(-1),
  );
  bindSegmentedGroup("#mode-group", (value) =>
    handlers.onSettingsChange({ mode: value as PlayerSettings["mode"] }),
  );
  bindSegmentedGroup("#color-map-group", (value) =>
    handlers.onSettingsChange({ colorMap: value as PlayerSettings["colorMap"] }),
  );
  bindSegmentedGroup("#stretch-group", (value) =>
    handlers.onSettingsChange({ stretch: value as PlayerSettings["stretch"] }),
  );
  markerToggle.addEventListener("click", () =>
    handlers.onSettingsChange({ showMarker: !shownSettings?.showMarker }),
  );
  trackToggle.addEventListener("click", () =>
    handlers.onSettingsChange({ showTrack: !shownSettings?.showTrack }),
  );
  saturationToggle.addEventListener("click", () =>
    handlers.onSettingsChange({ showSaturation: !shownSettings?.showSaturation }),
  );

  return {
    showSettings(settings: PlayerSettings): void {
      shownSettings = settings;
      showSegmentedValue("#mode-group", settings.mode);
      showSegmentedValue("#color-map-group", settings.colorMap);
      showSegmentedValue("#stretch-group", settings.stretch);
      zoomValue.textContent = `${settings.zoom}×`;
      markerToggle.setAttribute("aria-pressed", String(settings.showMarker));
      trackToggle.setAttribute("aria-pressed", String(settings.showTrack));
      saturationToggle.setAttribute("aria-pressed", String(settings.showSaturation));
    },

    showPlaying(isPlaying: boolean): void {
      playButton.setAttribute("aria-pressed", String(isPlaying));
      playButton.textContent = isPlaying ? "❚❚ Pause" : "▶ Blink";
    },
  };
}
