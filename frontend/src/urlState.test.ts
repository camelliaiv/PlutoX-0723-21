import { describe, expect, it } from "vitest";
import { buildCoordinatesQuery, readCoordinatesFromUrl } from "./urlState";

describe("urlState", () => {
  it("reads coordinates from the query string", () => {
    expect(readCoordinatesFromUrl("?ra=269.4&dec=-4.7")).toEqual({
      rightAscension: "269.4",
      declination: "-4.7",
    });
  });

  it("reads empty coordinates when the query string has none", () => {
    expect(readCoordinatesFromUrl("")).toEqual({ rightAscension: "", declination: "" });
  });

  it("round-trips sexagesimal coordinates", () => {
    const coordinates = { rightAscension: "08h55m10.831s", declination: "-07d14m42.53s" };
    expect(readCoordinatesFromUrl(buildCoordinatesQuery(coordinates))).toEqual(coordinates);
  });

  it("builds an empty query string for empty coordinates", () => {
    expect(buildCoordinatesQuery({ rightAscension: "", declination: "" })).toBe("");
  });
});
