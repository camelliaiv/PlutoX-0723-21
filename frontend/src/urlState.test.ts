import { describe, expect, it } from "vitest";
import { buildViewQuery, parseDetector, readViewFromUrl, type ViewState } from "./urlState";

const emptyCoordinates = { rightAscension: "", declination: "" };

describe("urlState", () => {
  it("reads coordinates and detector from the query string", () => {
    expect(readViewFromUrl("?ra=269.4&dec=-4.7&detector=3")).toEqual({
      targetSlug: null,
      detector: 3,
      coordinates: { rightAscension: "269.4", declination: "-4.7" },
    });
  });

  it("reads an empty view when the query string has nothing", () => {
    expect(readViewFromUrl("")).toEqual({
      targetSlug: null,
      detector: null,
      coordinates: emptyCoordinates,
    });
  });

  it("reads a challenge target and detector", () => {
    const view = readViewFromUrl("?target=barnards_star&detector=5");
    expect(view.targetSlug).toBe("barnards_star");
    expect(view.detector).toBe(5);
  });

  it("round-trips a challenge target view without coordinates", () => {
    const view: ViewState = {
      targetSlug: "wise_0855_0714",
      detector: 5,
      coordinates: { rightAscension: "08h55m10.831s", declination: "-07d14m42.53s" },
    };
    const query = buildViewQuery(view);
    expect(query).toBe("?target=wise_0855_0714&detector=5");
    expect(readViewFromUrl(query)).toEqual({ ...view, coordinates: emptyCoordinates });
  });

  it("round-trips free sexagesimal coordinates with a detector", () => {
    const view: ViewState = {
      targetSlug: null,
      detector: 1,
      coordinates: { rightAscension: "08h55m10.831s", declination: "-07d14m42.53s" },
    };
    expect(readViewFromUrl(buildViewQuery(view))).toEqual(view);
  });

  it("builds an empty query string for an empty view", () => {
    const emptyView: ViewState = {
      targetSlug: null,
      detector: null,
      coordinates: emptyCoordinates,
    };
    expect(buildViewQuery(emptyView)).toBe("");
  });

  it("accepts only detectors 1 to 6", () => {
    expect(parseDetector("1")).toBe(1);
    expect(parseDetector("6")).toBe(6);
    expect(parseDetector("0")).toBeNull();
    expect(parseDetector("7")).toBeNull();
    expect(parseDetector("2.5")).toBeNull();
    expect(parseDetector("abc")).toBeNull();
    expect(parseDetector(null)).toBeNull();
  });
});
