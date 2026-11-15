import { describe, expect, it } from "vitest";
import {
  DEFAULT_APP_VIEW,
  neighbouringAppView,
  parseAppView,
  readAppViewFromUrl,
  withAppView,
} from "./viewState";

describe("viewState", () => {
  it("parses the three views and rejects anything else", () => {
    expect(parseAppView("sky")).toBe("sky");
    expect(parseAppView("time")).toBe("time");
    expect(parseAppView("pixel")).toBe("pixel");
    expect(parseAppView("Sky")).toBeNull();
    expect(parseAppView("")).toBeNull();
    expect(parseAppView(null)).toBeNull();
  });

  it("opens the sky by default", () => {
    expect(DEFAULT_APP_VIEW).toBe("sky");
  });

  it("reads the view from the query string and falls back to the default", () => {
    expect(readAppViewFromUrl("?view=pixel&target=barnards_star")).toBe("pixel");
    expect(readAppViewFromUrl("?view=unknown")).toBe(DEFAULT_APP_VIEW);
    expect(readAppViewFromUrl("")).toBe(DEFAULT_APP_VIEW);
  });

  it("sets the view while keeping the other parameters", () => {
    expect(withAppView("", "sky")).toBe("?view=sky");
    expect(withAppView("?target=barnards_star&detector=5", "time")).toBe(
      "?target=barnards_star&detector=5&view=time",
    );
    expect(withAppView("?view=sky&detector=2", "pixel")).toBe("?view=pixel&detector=2");
  });

  it("moves between neighbouring views with wrap-around", () => {
    expect(neighbouringAppView("sky", "ArrowRight")).toBe("time");
    expect(neighbouringAppView("pixel", "ArrowRight")).toBe("sky");
    expect(neighbouringAppView("sky", "ArrowLeft")).toBe("pixel");
    expect(neighbouringAppView("time", "ArrowLeft")).toBe("sky");
    expect(neighbouringAppView("time", "Home")).toBe("sky");
    expect(neighbouringAppView("time", "End")).toBe("pixel");
    expect(neighbouringAppView("time", "a")).toBeNull();
  });
});
