import { describe, expect, it } from "vitest";
import { buildShareLink, planChallengeAction } from "./challengePlan";
import { createEmptyView } from "./urlState";

describe("challenge plans", () => {
  it("flies to a target in the sky view", () => {
    const plan = planChallengeAction({ kind: "flyToTarget", targetSlug: "wise_0855_0714" });
    expect(plan.appView).toBe("sky");
    expect(plan.skyTargetSlug).toBe("wise_0855_0714");
  });

  it("opens the difference mode on a later epoch", () => {
    const plan = planChallengeAction({
      kind: "showMode",
      targetSlug: "barnards_star",
      mode: "difference",
      epochIndex: 1,
    });
    expect(plan.timeMachineTargetSlug).toBe("barnards_star");
    expect(plan.settingsChange).toEqual({ mode: "difference" });
    expect(plan.epochIndex).toBe(1);
  });

  it("opens the pixel scale view for the spectrum and keeps the panel open when copying", () => {
    expect(planChallengeAction({ kind: "showSpectrum" }).appView).toBe("pixel");
    const copy = planChallengeAction({ kind: "copyLink" });
    expect(copy.copyLink).toBe(true);
    expect(copy.closePanel).toBe(false);
  });

  it("builds a link for the example target when nothing is loaded", () => {
    expect(buildShareLink("https://example.org/", createEmptyView())).toBe(
      "https://example.org/?target=barnards_star&view=time",
    );
  });

  it("builds a coordinate link", () => {
    const view = {
      ...createEmptyView(),
      coordinates: { rightAscension: "269.4485", declination: "4.7394" },
    };
    expect(buildShareLink("https://example.org/", view)).toBe(
      "https://example.org/?ra=269.4485&dec=4.7394&view=time",
    );
  });
});
