import { beforeEach, describe, expect, it } from "vitest";
import { CHALLENGE_ITEMS, type ChallengeAction } from "./challengeItems";
import { createChallengePanel } from "./challengePanel";
import { mountPageMarkup } from "./pageFixture";

describe("challenge panel", () => {
  beforeEach(() => {
    mountPageMarkup();
  });

  it("renders every item with its status and a button only where there is an action", () => {
    createChallengePanel({ onAction: async () => "" });
    const items = document.querySelectorAll("#challenge-list li");
    expect(items.length).toBe(CHALLENGE_ITEMS.length);
    const buttons = document.querySelectorAll("#challenge-list button");
    expect(buttons.length).toBe(CHALLENGE_ITEMS.filter((item) => item.action).length);
    expect(document.querySelector("#challenge-list")?.textContent).toContain("Not included");
    expect(document.querySelector("#challenge-summary")?.textContent).toContain("items");
  });

  it("runs the action and shows its message", async () => {
    const received: ChallengeAction[] = [];
    createChallengePanel({
      onAction: async (action) => {
        received.push(action);
        return "Done.";
      },
    });
    document.querySelector<HTMLButtonElement>("#challenge-list button")?.click();
    await new Promise((resolve) => setTimeout(resolve, 0));
    expect(received).toHaveLength(1);
    expect(document.querySelector("#challenge-message")?.textContent).toBe("Done.");
  });
});
