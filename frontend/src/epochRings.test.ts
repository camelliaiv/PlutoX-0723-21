import { describe, expect, it } from "vitest";
import { epochColor, ringStates } from "./epochRings";

describe("epochColor", () => {
  it("runs from blue through lavender to orange", () => {
    expect(epochColor(0, 3)).toBe("rgb(61, 165, 255)");
    expect(epochColor(1, 3)).toBe("rgb(214, 205, 245)");
    expect(epochColor(2, 3)).toBe("rgb(255, 138, 31)");
  });

  it("spreads four epochs evenly and handles a single epoch", () => {
    expect(epochColor(3, 4)).toBe("rgb(255, 138, 31)");
    expect(epochColor(0, 1)).toBe("rgb(61, 165, 255)");
  });
});

describe("ringStates", () => {
  it("glows blue on the first epoch and orange on the last", () => {
    const first = ringStates("frame", 0, 3);
    const last = ringStates("frame", 2, 3);
    expect(first.blue).toEqual({ isGlowing: true, opacity: 1 });
    expect(first.orange.isGlowing).toBe(false);
    expect(last.orange).toEqual({ isGlowing: true, opacity: 1 });
    expect(last.blue.isGlowing).toBe(false);
  });

  it("glows both rings on a middle epoch", () => {
    const middle = ringStates("frame", 1, 3);
    expect(middle.blue.isGlowing).toBe(true);
    expect(middle.orange.isGlowing).toBe(true);
    expect(middle.blue.opacity).toBeCloseTo(middle.orange.opacity, 12);
  });

  it("dims the inactive ring but never hides it", () => {
    expect(ringStates("frame", 0, 4).orange.opacity).toBeCloseTo(0.3, 12);
  });

  it("glows both rings fully in difference and stack modes", () => {
    for (const mode of ["difference", "stack"] as const) {
      const states = ringStates(mode, 0, 3);
      expect(states.blue).toEqual({ isGlowing: true, opacity: 1 });
      expect(states.orange).toEqual({ isGlowing: true, opacity: 1 });
    }
  });
});
