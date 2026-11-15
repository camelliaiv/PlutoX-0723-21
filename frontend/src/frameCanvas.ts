import type { Frame } from "./api";
import { CANVAS_BACKGROUND_COLOR, PIXEL_HIGHLIGHT_COLOR } from "./canvasColors";
import {
  drawCompass,
  drawMarkers,
  drawScaleBar,
  drawTrack,
  type OverlayFonts,
} from "./canvasOverlays";
import { trackPoints, type ImagePoint } from "./markers";
import type { PlayerSettings } from "./playerSettings";
import { chooseScaleBar, imageToCanvas } from "./viewport";

export interface PlayerCanvasState {
  frames: Frame[];
  sizePixels: number;
  pixelScaleArcseconds: number;
  pixels: Uint8ClampedArray<ArrayBuffer>;
  settings: PlayerSettings;
  epochIndex: number;
  centre: ImagePoint;
  canvasSize: number;
  hoveredPixel: { column: number; row: number } | null;
}

export interface PlayerCanvas {
  resize(canvasSize: number): void;
  draw(state: PlayerCanvasState): void;
  pointerPosition(clientX: number, clientY: number): ImagePoint;
}

const MAXIMUM_DEVICE_PIXEL_RATIO = 2;
const HIGHLIGHT_LINE_WIDTH = 1.5;

function requireContext(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const context = canvas.getContext("2d");
  if (!context) {
    throw new Error("This browser cannot draw the frames.");
  }
  return context;
}

export function paintFramePixels(
  canvas: HTMLCanvasElement,
  pixels: Uint8ClampedArray<ArrayBuffer>,
  sizePixels: number,
): void {
  canvas.width = sizePixels;
  canvas.height = sizePixels;
  requireContext(canvas).putImageData(new ImageData(pixels, sizePixels), 0, 0);
}

export function createPlayerCanvas(canvas: HTMLCanvasElement): PlayerCanvas {
  const surface = document.createElement("canvas");
  const bodyStyle = getComputedStyle(document.body);
  const fonts: OverlayFonts = {
    body: bodyStyle.fontFamily,
    mono: bodyStyle.getPropertyValue("--font-mono"),
  };
  let devicePixelRatio = 1;

  return {
    resize(canvasSize: number): void {
      devicePixelRatio = Math.min(window.devicePixelRatio || 1, MAXIMUM_DEVICE_PIXEL_RATIO);
      canvas.width = Math.round(canvasSize * devicePixelRatio);
      canvas.height = Math.round(canvasSize * devicePixelRatio);
      canvas.style.width = `${canvasSize}px`;
      canvas.style.height = `${canvasSize}px`;
    },

    draw(state: PlayerCanvasState): void {
      const { settings, canvasSize, sizePixels, centre } = state;
      const context = requireContext(canvas);
      const toCanvas = (point: ImagePoint): ImagePoint =>
        imageToCanvas(point, centre, canvasSize, sizePixels, settings.zoom);
      const pixelsPerImagePixel = (canvasSize / sizePixels) * settings.zoom;
      context.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
      context.fillStyle = CANVAS_BACKGROUND_COLOR;
      context.fillRect(0, 0, canvasSize, canvasSize);

      paintFramePixels(surface, state.pixels, sizePixels);
      const origin = toCanvas({ x: 0, y: 0 });
      context.imageSmoothingEnabled = false;
      context.drawImage(
        surface,
        origin.x,
        origin.y,
        sizePixels * pixelsPerImagePixel,
        sizePixels * pixelsPerImagePixel,
      );

      if (state.hoveredPixel) {
        const corner = toCanvas({
          x: state.hoveredPixel.column,
          y: sizePixels - 1 - state.hoveredPixel.row,
        });
        context.strokeStyle = PIXEL_HIGHLIGHT_COLOR;
        context.lineWidth = HIGHLIGHT_LINE_WIDTH;
        context.strokeRect(
          corner.x + 0.5,
          corner.y + 0.5,
          pixelsPerImagePixel - 1,
          pixelsPerImagePixel - 1,
        );
      }

      const points = trackPoints(state.frames, sizePixels);
      if (settings.showTrack) {
        drawTrack(context, points, state.epochIndex, state.frames.length, toCanvas);
      }
      if (settings.showMarker) {
        drawMarkers(
          context,
          points,
          state.epochIndex,
          state.frames.length,
          settings.mode !== "frame",
          pixelsPerImagePixel,
          toCanvas,
          fonts,
        );
      }
      drawCompass(context, canvasSize, fonts);
      const scaleBar = chooseScaleBar(pixelsPerImagePixel / state.pixelScaleArcseconds, canvasSize);
      if (scaleBar) {
        drawScaleBar(context, scaleBar, canvasSize, fonts);
      }
    },

    pointerPosition(clientX: number, clientY: number): ImagePoint {
      const bounds = canvas.getBoundingClientRect();
      return { x: clientX - bounds.left, y: clientY - bounds.top };
    },
  };
}
