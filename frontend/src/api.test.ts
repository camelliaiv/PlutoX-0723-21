import { describe, expect, it } from "vitest";
import { buildFramesQuery, describeErrorBody } from "./api";

describe("describeErrorBody", () => {
  it("uses the archive error message", () => {
    expect(describeErrorBody({ error: "IRSA did not answer within 30 seconds." }, 504)).toBe(
      "IRSA did not answer within 30 seconds.",
    );
  });

  it("uses a coordinate validation message", () => {
    expect(describeErrorBody({ detail: "cannot parse right ascension 'abc'" }, 422)).toBe(
      "cannot parse right ascension 'abc'",
    );
  });

  it("joins the messages of a list of validation issues", () => {
    const body = { detail: [{ msg: "Field required" }, { msg: "Input should be greater than 0" }] };
    expect(describeErrorBody(body, 422)).toBe("Field required; Input should be greater than 0");
  });

  it("falls back to the HTTP status when the body is unreadable", () => {
    expect(describeErrorBody(null, 500)).toBe("Request failed (HTTP 500).");
  });
});

describe("buildFramesQuery", () => {
  const coordinates = { rightAscension: "269.4", declination: "4.7" };

  it("asks for a challenge target by slug without coordinates", () => {
    const query = buildFramesQuery({ detector: 5, targetSlug: "barnards_star", coordinates });
    expect(query).toBe("detector=5&target=barnards_star");
  });

  it("asks for free coordinates when no target is chosen", () => {
    const query = buildFramesQuery({ detector: 1, targetSlug: null, coordinates });
    expect(query).toBe("detector=1&ra=269.4&dec=4.7");
  });
});
