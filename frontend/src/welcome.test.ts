import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createWelcome, WELCOME_MESSAGE, WELCOME_PURPOSE } from "./welcome";
import { WELCOME_ANIMATED_MILLISECONDS, WELCOME_FADE_MILLISECONDS } from "./welcomeTiming";

function buildPage(): { shell: HTMLElement; welcomeElement: HTMLElement } {
  document.body.replaceChildren();
  const shell = document.createElement("div");
  const welcomeElement = document.createElement("div");
  welcomeElement.id = "welcome";
  document.body.append(shell, welcomeElement);
  return { shell, welcomeElement };
}

describe("welcome", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows the exact copy and blocks the app while it plays", () => {
    const { shell, welcomeElement } = buildPage();
    createWelcome(shell).play(() => undefined);
    expect(welcomeElement.querySelector(".welcome-message")?.textContent).toBe(WELCOME_MESSAGE);
    expect(welcomeElement.querySelector(".welcome-purpose")?.textContent).toBe(WELCOME_PURPOSE);
    expect(welcomeElement.hidden).toBe(false);
    expect(shell.inert).toBe(true);
  });

  it("reveals the app by itself after the display time", () => {
    const { shell, welcomeElement } = buildPage();
    const onFinished = vi.fn();
    createWelcome(shell).play(onFinished);
    vi.advanceTimersByTime(WELCOME_ANIMATED_MILLISECONDS);
    expect(onFinished).toHaveBeenCalledWith("other");
    expect(shell.inert).toBe(false);
    vi.advanceTimersByTime(WELCOME_FADE_MILLISECONDS);
    expect(welcomeElement.hidden).toBe(true);
  });

  it("can be skipped with a click, Enter or Escape, and only once", () => {
    for (const skip of [
      (welcomeElement: HTMLElement) => welcomeElement.click(),
      () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Enter" })),
      () => document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" })),
    ]) {
      const { shell, welcomeElement } = buildPage();
      const onFinished = vi.fn();
      createWelcome(shell).play(onFinished);
      skip(welcomeElement);
      skip(welcomeElement);
      vi.advanceTimersByTime(WELCOME_ANIMATED_MILLISECONDS);
      expect(onFinished).toHaveBeenCalledTimes(1);
      expect(shell.inert).toBe(false);
    }
  });

  it("reports whether the keyboard dismissed the welcome", () => {
    const { shell } = buildPage();
    const onFinished = vi.fn();
    createWelcome(shell).play(onFinished);
    document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
    expect(onFinished).toHaveBeenCalledWith("keyboard");
  });

  it("can play again after it finished", () => {
    const { shell, welcomeElement } = buildPage();
    const welcome = createWelcome(shell);
    welcome.play(() => undefined);
    welcomeElement.click();
    vi.advanceTimersByTime(WELCOME_FADE_MILLISECONDS);
    welcome.play(() => undefined);
    expect(welcomeElement.hidden).toBe(false);
    expect(shell.inert).toBe(true);
  });
});
