import type { ColorMapName } from "./colorMaps";
import type { StretchName } from "./frameImage";
import type { DisplayMode } from "./frameModes";
import { DEFAULT_ZOOM, parseZoom } from "./viewport";

export interface PlayerSettings {
  mode: DisplayMode;
  colorMap: ColorMapName;
  stretch: StretchName;
  zoom: number;
  showMarker: boolean;
  showTrack: boolean;
  showSaturation: boolean;
}

export const DISPLAY_MODES: readonly DisplayMode[] = ["frame", "difference", "stack"];
export const COLOR_MAPS: readonly ColorMapName[] = ["inferno", "gray"];
export const STRETCHES: readonly StretchName[] = ["asinh", "linear"];

export const DEFAULT_PLAYER_SETTINGS: PlayerSettings = {
  mode: "frame",
  colorMap: "inferno",
  stretch: "asinh",
  zoom: DEFAULT_ZOOM,
  showMarker: true,
  showTrack: true,
  showSaturation: false,
};

const MODE_PARAMETER = "mode";
const COLOR_MAP_PARAMETER = "map";
const STRETCH_PARAMETER = "stretch";
const ZOOM_PARAMETER = "zoom";
const MARKER_PARAMETER = "marker";
const TRACK_PARAMETER = "track";
const HIDDEN_VALUE = "0";

function pickOption<Option extends string>(
  options: readonly Option[],
  text: string | null,
  fallback: Option,
): Option {
  return options.find((option) => option === text) ?? fallback;
}

export function readPlayerSettings(parameters: URLSearchParams): PlayerSettings {
  const defaults = DEFAULT_PLAYER_SETTINGS;
  return {
    mode: pickOption(DISPLAY_MODES, parameters.get(MODE_PARAMETER), defaults.mode),
    colorMap: pickOption(COLOR_MAPS, parameters.get(COLOR_MAP_PARAMETER), defaults.colorMap),
    stretch: pickOption(STRETCHES, parameters.get(STRETCH_PARAMETER), defaults.stretch),
    zoom: parseZoom(parameters.get(ZOOM_PARAMETER)) ?? defaults.zoom,
    showMarker: parameters.get(MARKER_PARAMETER) !== HIDDEN_VALUE,
    showTrack: parameters.get(TRACK_PARAMETER) !== HIDDEN_VALUE,
    showSaturation: defaults.showSaturation,
  };
}

export function writePlayerSettings(parameters: URLSearchParams, settings: PlayerSettings): void {
  const defaults = DEFAULT_PLAYER_SETTINGS;
  if (settings.mode !== defaults.mode) {
    parameters.set(MODE_PARAMETER, settings.mode);
  }
  if (settings.colorMap !== defaults.colorMap) {
    parameters.set(COLOR_MAP_PARAMETER, settings.colorMap);
  }
  if (settings.stretch !== defaults.stretch) {
    parameters.set(STRETCH_PARAMETER, settings.stretch);
  }
  if (settings.zoom !== defaults.zoom) {
    parameters.set(ZOOM_PARAMETER, String(settings.zoom));
  }
  if (!settings.showMarker) {
    parameters.set(MARKER_PARAMETER, HIDDEN_VALUE);
  }
  if (!settings.showTrack) {
    parameters.set(TRACK_PARAMETER, HIDDEN_VALUE);
  }
}
