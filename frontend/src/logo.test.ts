import { describe, expect, it } from "vitest";
import {
  BLUE_RING_COLOR,
  ORANGE_RING_COLOR,
  createLogo,
  createRings,
  createWordmark,
} from "./logo";

describe("logo", () => {
  it("draws one blue and one orange ring that assistive technology skips", () => {
    const rings = createRings();
    expect(rings.getAttribute("aria-hidden")).toBe("true");
    const strokes = [...rings.querySelectorAll("circle")].map((circle) =>
      circle.getAttribute("stroke"),
    );
    expect(strokes).toEqual([BLUE_RING_COLOR, ORANGE_RING_COLOR]);
  });

  it("writes the wordmark as Pluto, X and the designation", () => {
    const wordmark = createWordmark();
    expect(wordmark.querySelector(".wordmark-x")?.textContent).toBe("X");
    expect(wordmark.querySelector(".wordmark-number")?.textContent).toBe("0723+21");
    expect(wordmark.textContent).toBe("PlutoX0723+21");
  });

  it("builds the same parts for every placement", () => {
    for (const placement of ["header", "welcome"] as const) {
      const logo = createLogo(placement);
      expect(logo.classList.contains(`logo-${placement}`)).toBe(true);
      expect(logo.querySelectorAll("circle")).toHaveLength(2);
      expect(logo.querySelector(".wordmark")).not.toBeNull();
    }
  });
});
