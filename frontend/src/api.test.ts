import { describe, expect, it } from "vitest";
import { describeErrorBody } from "./api";

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
