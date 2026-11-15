export function appendRetryButton(container: HTMLElement, onRetry: () => void): void {
  const button = document.createElement("button");
  button.type = "button";
  button.className = "glass-button retry-button";
  button.textContent = "Try again";
  button.addEventListener("click", onRetry);
  container.append(button);
}
