import { createElement, createSvgElement } from "./dom";

export const BLUE_RING_COLOR = "#3da5ff";
export const ORANGE_RING_COLOR = "#ff8a1f";

export type LogoPlacement = "header" | "welcome";

function createRing(color: string, centerX: number, ringClassName: string): SVGGElement {
  const ringGroup = createSvgElement("g", { class: ringClassName });
  ringGroup.append(
    createSvgElement("circle", {
      cx: String(centerX),
      cy: "30",
      r: "25",
      fill: "none",
      stroke: color,
      "stroke-width": "2.4",
    }),
  );
  return ringGroup;
}

export function createRings(): SVGSVGElement {
  const rings = createSvgElement("svg", {
    class: "logo-rings",
    viewBox: "0 0 100 60",
    "aria-hidden": "true",
    focusable: "false",
  });
  rings.append(
    createRing(BLUE_RING_COLOR, 38, "ring-blue"),
    createRing(ORANGE_RING_COLOR, 62, "ring-orange"),
  );
  return rings;
}

export function createWordmark(): HTMLSpanElement {
  const wordmark = createElement("span");
  wordmark.className = "wordmark";
  const name = createElement("span", "Pluto");
  name.className = "wordmark-name";
  const letterX = createElement("span", "X");
  letterX.className = "wordmark-x";
  name.append(letterX);
  const number = createElement("span", "0723+21");
  number.className = "wordmark-number";
  wordmark.append(name, number);
  return wordmark;
}

export function createLogo(placement: LogoPlacement): HTMLSpanElement {
  const logo = createElement("span");
  logo.className = `logo logo-${placement}`;
  logo.append(createRings(), createWordmark());
  return logo;
}
