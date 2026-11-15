import { CHALLENGE_ITEMS, type ChallengeAction, type ChallengeItem } from "./challengeItems";
import { CHALLENGE_STATUS_LABELS, describeChallengeSummary } from "./challengeText";
import { createElement, requireElement } from "./dom";

export interface ChallengePanelOptions {
  onAction(action: ChallengeAction): Promise<string>;
}

function createItemElement(
  item: ChallengeItem,
  onActivate: (action: ChallengeAction) => void,
): HTMLLIElement {
  const element = createElement("li");
  element.className = "challenge-item";

  const badge = createElement("span", CHALLENGE_STATUS_LABELS[item.status]);
  badge.className = `challenge-status challenge-status-${item.status}`;

  const heading = createElement("h3", item.requirement);
  heading.className = "challenge-requirement";

  const detail = createElement("p", item.detail);
  detail.className = "challenge-detail";
  element.append(badge, heading, detail);

  if (item.missing !== null) {
    const missing = createElement("p", `Missing: ${item.missing}`);
    missing.className = "challenge-missing";
    element.append(missing);
  }

  const { action, actionLabel } = item;
  if (action !== null && actionLabel !== null) {
    const button = createElement("button", actionLabel);
    button.type = "button";
    button.className = "glass-button challenge-action";
    button.addEventListener("click", () => onActivate(action));
    element.append(button);
  }
  return element;
}

export function createChallengePanel(options: ChallengePanelOptions): void {
  const list = requireElement<HTMLElement>("#challenge-list");
  const summary = requireElement<HTMLElement>("#challenge-summary");
  const message = requireElement<HTMLElement>("#challenge-message");

  summary.textContent = describeChallengeSummary(CHALLENGE_ITEMS);

  function activate(action: ChallengeAction): void {
    void options.onAction(action).then((text) => {
      message.textContent = text;
    });
  }

  list.replaceChildren(...CHALLENGE_ITEMS.map((item) => createItemElement(item, activate)));
}
