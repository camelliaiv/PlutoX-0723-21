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
