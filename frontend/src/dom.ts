export function createElement<TagName extends keyof HTMLElementTagNameMap>(
  tagName: TagName,
  text?: string,
): HTMLElementTagNameMap[TagName] {
  const element = document.createElement(tagName);
  if (text !== undefined) {
    element.textContent = text;
  }
  return element;
}

export function requireElement<ElementType extends Element>(selector: string): ElementType {
  const element = document.querySelector<ElementType>(selector);
  if (!element) {
    throw new Error(`Required page element ${selector} is missing.`);
  }
  return element;
}

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

export function createSvgElement<TagName extends keyof SVGElementTagNameMap>(
  tagName: TagName,
  attributes: Record<string, string> = {},
): SVGElementTagNameMap[TagName] {
  const element = document.createElementNS(SVG_NAMESPACE, tagName);
  for (const [name, value] of Object.entries(attributes)) {
    element.setAttribute(name, value);
  }
  return element;
}
