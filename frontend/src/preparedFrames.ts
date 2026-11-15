import type { FramesResponse } from "./api";
import { buildFramePixels } from "./frameImage";
import { buildModeImages, type ModeImages } from "./frameModes";
import type { PlayerSettings } from "./playerSettings";

export interface PreparedFrames {
  response: FramesResponse;
  modeImages: ModeImages;
}

export function prepareFrames(response: FramesResponse): PreparedFrames {
  return { response, modeImages: buildModeImages(response.frames) };
}

export function buildPlayerPixels(
  prepared: PreparedFrames,
  epochIndex: number,
  settings: PlayerSettings,
): Uint8ClampedArray<ArrayBuffer> {
  return buildFramePixels(prepared.response.frames, prepared.modeImages, {
    mode: settings.mode,
    colorMap: settings.colorMap,
    stretch: settings.stretch,
    showSaturation: settings.showSaturation,
    epochIndex,
    displayRange: prepared.response.display_range,
  });
}

export function buildThumbnailPixels(
  prepared: PreparedFrames,
  epochIndex: number,
  settings: PlayerSettings,
): Uint8ClampedArray<ArrayBuffer> {
  return buildPlayerPixels(prepared, epochIndex, {
    ...settings,
    mode: "frame",
    showSaturation: false,
  });
}
