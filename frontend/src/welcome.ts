import { createElement, requireElement } from "./dom";
import { createLogo } from "./logo";
import {
  WELCOME_FADE_MILLISECONDS,
  isWelcomeDismissKey,
  welcomeDisplayMilliseconds,
} from "./welcomeTiming";

export const WELCOME_MESSAGE =
  "Explore the sky. Travel through observations. Discover what changes.";
export const WELCOME_PURPOSE = "Blink real SPHEREx images of one patch of sky, epoch by epoch.";

export type WelcomeDismissal = "keyboard" | "other";

export interface Welcome {
  play(onFinished: (dismissal: WelcomeDismissal) => void): void;
}

function buildWelcomeContent(): { content: HTMLDivElement; skipButton: HTMLButtonElement } {
  const content = createElement("div");
  content.className = "welcome-content";
  const message = createElement("p", WELCOME_MESSAGE);
  message.className = "welcome-message";
  const purpose = createElement("p", WELCOME_PURPOSE);
  purpose.className = "welcome-purpose";
  const skipButton = createElement("button", "Skip · Enter");
  skipButton.type = "button";
  skipButton.className = "welcome-skip";
  skipButton.setAttribute("aria-keyshortcuts", "Enter Escape");
  content.append(createLogo("welcome"), message, purpose, skipButton);
  return { content, skipButton };
}

export function createWelcome(shell: HTMLElement): Welcome {
  const welcomeElement = requireElement<HTMLElement>("#welcome");
  const reducedMotionQuery = window.matchMedia("(prefers-reduced-motion: reduce)");
  welcomeElement.style.setProperty("--welcome-fade-duration", `${WELCOME_FADE_MILLISECONDS}ms`);
  let finishWelcome: ((dismissal: WelcomeDismissal) => void) | null = null;

  return {
    play(onFinished: (dismissal: WelcomeDismissal) => void): void {
      if (finishWelcome !== null) {
        return;
      }
      const { content, skipButton } = buildWelcomeContent();
      welcomeElement.replaceChildren(content);
      welcomeElement.classList.remove("welcome-leaving");
      welcomeElement.hidden = false;
      shell.inert = true;
      skipButton.focus();

      const displayTimer = window.setTimeout(
        () => finish("other"),
        welcomeDisplayMilliseconds(reducedMotionQuery.matches),
      );
      const dismissOnClick = (): void => finish("other");
      const dismissOnKey = (event: KeyboardEvent): void => {
        if (isWelcomeDismissKey(event.key)) {
          event.preventDefault();
          finish("keyboard");
        }
      };
      welcomeElement.addEventListener("click", dismissOnClick);
      document.addEventListener("keydown", dismissOnKey, true);

      function finish(dismissal: WelcomeDismissal): void {
        window.clearTimeout(displayTimer);
        welcomeElement.removeEventListener("click", dismissOnClick);
        document.removeEventListener("keydown", dismissOnKey, true);
        finishWelcome = null;
        shell.inert = false;
        welcomeElement.classList.add("welcome-leaving");
        onFinished(dismissal);
        window.setTimeout(() => {
          if (finishWelcome === null) {
            welcomeElement.hidden = true;
            welcomeElement.replaceChildren();
          }
        }, WELCOME_FADE_MILLISECONDS);
      }
      finishWelcome = finish;
    },
  };
}
