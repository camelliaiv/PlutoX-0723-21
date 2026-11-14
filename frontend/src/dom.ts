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
