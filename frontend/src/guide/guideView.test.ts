import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createFramesCache } from "../framesCache";
import { mountPageMarkup } from "../pageFixture";
import { createEmptyView } from "../urlState";
import { BARNARDS_STAR_FACTS, WISE_FACTS, makePreparedDetector } from "./guideFixtures";
import type { GuideAction } from "./guideTypes";
import { createGuideView } from "./guideView";

const targetsResponse = { targets: [BARNARDS_STAR_FACTS, WISE_FACTS] };

async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

function questionButton(label: string): HTMLButtonElement {
  const button = Array.from(
    document.querySelectorAll<HTMLButtonElement>("#guide-questions button"),
  ).find((candidate) => candidate.textContent === label);
  if (!button) {
    throw new Error(`Missing question ${label}`);
  }
  return button;
}

function buildGuide(targetSlug: string | null) {
  const framesCache = createFramesCache();
  const navigations: Array<[GuideAction, string | null]> = [];
  const view = { ...createEmptyView(), targetSlug };
  const guide = createGuideView({
    framesCache,
    timeMachine: {
      currentView: () => view,
      currentSelection: () => ({ detector: 5, epochIndex: 0 }),
    },
    onNavigate: (action, slug) => navigations.push([action, slug]),
  });
  return { framesCache, guide, navigations };
}

describe("guide view", () => {
  beforeEach(() => {
    mountPageMarkup();
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.resolve(new Response(JSON.stringify(targetsResponse)))),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("shows eight question buttons and a prompt", () => {
    buildGuide(null);
    expect(document.querySelectorAll("#guide-questions button")).toHaveLength(8);
    expect(document.querySelector("#guide-answer")?.textContent).toBe("Pick a question.");
    expect(document.querySelector("#guide-answer")?.getAttribute("aria-live")).toBe("polite");
  });

  it("shows the target name and answers from the catalogue facts", async () => {
    const { guide } = buildGuide("barnards_star");
    await settle();
    guide.setTarget("barnards_star");
    expect(document.querySelector("#guide-target")?.textContent).toBe("About: Barnard's Star");
    questionButton("How far away is it?").click();
    expect(document.querySelector("#guide-answer")?.textContent).toContain("1.828 pc");
    expect(questionButton("How far away is it?").getAttribute("aria-pressed")).toBe("true");
    expect(document.querySelector(".guide-confidence-high")).not.toBeNull();
  });

  it("updates the open answer immediately when the target changes", async () => {
    const { guide } = buildGuide("barnards_star");
    await settle();
    guide.setTarget("barnards_star");
    questionButton("How far away is it?").click();
    guide.setTarget("wise_0855_0714");
    expect(document.querySelector("#guide-target")?.textContent).toBe("About: WISE 0855−0714");
    expect(document.querySelector("#guide-answer")?.textContent).toContain("not in Gaia DR3");
  });

  it("updates the answer when frames arrive and navigates from citations", async () => {
    const { framesCache, guide, navigations } = buildGuide("barnards_star");
    await settle();
    guide.setTarget("barnards_star");
    questionButton("Is it saturated?").click();
    framesCache.store(5, makePreparedDetector(0.4));
    guide.refresh();
    const citation = document.querySelector<HTMLButtonElement>(".guide-citation");
    expect(citation?.textContent).toBe("[D5]");
    citation?.click();
    expect(navigations).toEqual([[{ kind: "detector", detector: 5 }, "barnards_star"]]);
  });

  it("reveals the catalogue source identifier without navigating", async () => {
    const { guide, navigations } = buildGuide("barnards_star");
    await settle();
    guide.setTarget("barnards_star");
    questionButton("What is this object?").click();
    const catalogue = Array.from(
      document.querySelectorAll<HTMLButtonElement>(".guide-citation"),
    ).find((button) => button.textContent === "[catalogue]");
    catalogue?.click();
    expect(document.querySelector(".guide-source-note")?.textContent).toContain(
      "Gaia DR3 4472832130942575872",
    );
    expect(navigations).toHaveLength(0);
  });

  it("answers honestly when the catalogue cannot be loaded", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(() => Promise.reject(new Error("offline"))),
    );
    const { guide } = buildGuide("barnards_star");
    await settle();
    guide.setTarget("barnards_star");
    questionButton("How far away is it?").click();
    expect(document.querySelector("#guide-answer")?.textContent).toContain("could not be loaded");
  });
});
