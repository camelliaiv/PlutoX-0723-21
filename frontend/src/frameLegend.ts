import { sampleGradient } from "./colorMaps";
import { createElement, requireElement } from "./dom";
import type { LegendContent } from "./legendText";

const GRADIENT_STEPS = 256;

function createGradientCanvas(content: LegendContent): HTMLCanvasElement {
  const canvas = createElement("canvas");
  canvas.width = GRADIENT_STEPS;
  canvas.height = 1;
  canvas.className = "legend-gradient";
  canvas.setAttribute("aria-hidden", "true");
  const context = canvas.getContext("2d");
  if (context) {
    const image = context.createImageData(GRADIENT_STEPS, 1);
    sampleGradient(content.gradient, GRADIENT_STEPS).forEach((color, index) => {
      image.data.set(color, index * 4);
    });
    context.putImageData(image, 0, 0);
  }
  return canvas;
}

export function showFrameLegend(content: LegendContent): void {
  const legend = requireElement<HTMLElement>("#frame-legend");
  const low = createElement("span", content.lowLabel);
  const high = createElement("span", content.highLabel);
  low.className = "mono";
  high.className = "mono";
  legend.replaceChildren(
    low,
    createGradientCanvas(content),
    high,
    createElement("span", content.caption),
  );
}

export function clearFrameLegend(): void {
  requireElement<HTMLElement>("#frame-legend").replaceChildren();
}
