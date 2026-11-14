import type { DisplayRange, Frame, GridDescription } from "./api";
import { buildFramePixels, integerScaleFor, scaleBarLengthPixels } from "./frameImage";

const SCALE_BAR_ARCSECONDS = 60;
const SCALE_BAR_LABEL = "1′";
const MARK_MARGIN_PIXELS = 10;
const MARK_FILL_COLOR = "#ffffff";
const MARK_OUTLINE_COLOR = "#000000";
const MARK_FONT = "bold 16px system-ui, sans-serif";

function drawMark(
  context: CanvasRenderingContext2D,
  text: string,
  horizontalPosition: number,
  verticalPosition: number,
): void {
  context.lineWidth = 3;
  context.strokeStyle = MARK_OUTLINE_COLOR;
  context.strokeText(text, horizontalPosition, verticalPosition);
  context.fillStyle = MARK_FILL_COLOR;
  context.fillText(text, horizontalPosition, verticalPosition);
}

function drawOrientationMarks(
  context: CanvasRenderingContext2D,
  width: number,
  height: number,
): void {
  context.font = MARK_FONT;
  context.textBaseline = "middle";
  context.textAlign = "center";
  drawMark(context, "N ↑", width / 2, MARK_MARGIN_PIXELS + 6);
  context.textAlign = "left";
  drawMark(context, "← E", MARK_MARGIN_PIXELS, height / 2);
}

function drawScaleBar(
  context: CanvasRenderingContext2D,
  barLengthPixels: number,
  height: number,
): void {
  const barTop = height - MARK_MARGIN_PIXELS - 4;
  context.fillStyle = MARK_OUTLINE_COLOR;
  context.fillRect(MARK_MARGIN_PIXELS - 2, barTop - 2, barLengthPixels + 4, 8);
  context.fillStyle = MARK_FILL_COLOR;
  context.fillRect(MARK_MARGIN_PIXELS, barTop, barLengthPixels, 4);
  context.font = MARK_FONT;
  context.textAlign = "left";
  context.textBaseline = "bottom";
  drawMark(context, SCALE_BAR_LABEL, MARK_MARGIN_PIXELS, barTop - 4);
}

export function drawFrame(
  canvas: HTMLCanvasElement,
  frame: Frame,
  grid: GridDescription,
  displayRange: DisplayRange | null,
  showSaturation: boolean,
): void {
  const integerScale = integerScaleFor(grid.size_pixels);
  const displaySize = grid.size_pixels * integerScale;
  canvas.width = displaySize;
  canvas.height = displaySize;

  const sourceCanvas = document.createElement("canvas");
  sourceCanvas.width = grid.size_pixels;
  sourceCanvas.height = grid.size_pixels;
  const sourceContext = sourceCanvas.getContext("2d");
  const context = canvas.getContext("2d");
  if (!sourceContext || !context) {
    throw new Error("This browser cannot draw the frames.");
  }
  const pixels = buildFramePixels(frame, displayRange, showSaturation);
  sourceContext.putImageData(new ImageData(pixels, grid.size_pixels), 0, 0);

  context.imageSmoothingEnabled = false;
  context.drawImage(sourceCanvas, 0, 0, displaySize, displaySize);
  drawOrientationMarks(context, displaySize, displaySize);
  drawScaleBar(
    context,
    scaleBarLengthPixels(SCALE_BAR_ARCSECONDS, grid.pixel_scale_arcseconds, integerScale),
    displaySize,
  );
}
