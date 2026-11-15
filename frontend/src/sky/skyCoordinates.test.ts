import { describe, expect, it } from "vitest";
import {
  buildUserPosition,
  parseDeclinationDegrees,
  parseRightAscensionDegrees,
  USER_POSITION_SHELL_PARSECS,
} from "./skyCoordinates";

describe("parseRightAscensionDegrees", () => {
  it("reads decimal degrees", () => {
    expect(parseRightAscensionDegrees("269.4465")).toBeCloseTo(269.4465, 6);
  });

  it("reads hours, minutes and seconds", () => {
    expect(parseRightAscensionDegrees("17h57m47s")).toBeCloseTo(269.4458, 3);
    expect(parseRightAscensionDegrees("17:57:47")).toBeCloseTo(269.4458, 3);
  });

  it("rejects empty, negative and out of range input", () => {
    expect(parseRightAscensionDegrees("")).toBeNull();
    expect(parseRightAscensionDegrees("-5")).toBeNull();
    expect(parseRightAscensionDegrees("400")).toBeNull();
    expect(parseRightAscensionDegrees("abc")).toBeNull();
  });
});

describe("parseDeclinationDegrees", () => {
  it("reads signed decimal degrees", () => {
    expect(parseDeclinationDegrees("-56.79")).toBeCloseTo(-56.79, 6);
    expect(parseDeclinationDegrees("+4.74")).toBeCloseTo(4.74, 6);
  });

  it("reads degrees, arcminutes and arcseconds", () => {
    expect(parseDeclinationDegrees("-07d14m39s")).toBeCloseTo(-7.2442, 3);
    expect(parseDeclinationDegrees("+04:44:22")).toBeCloseTo(4.7394, 3);
  });

  it("rejects out of range input", () => {
    expect(parseDeclinationDegrees("95")).toBeNull();
    expect(parseDeclinationDegrees("")).toBeNull();
  });
});

describe("buildUserPosition", () => {
  it("places the position on the direction shell", () => {
    const userPosition = buildUserPosition("90", "0");
    expect(userPosition).not.toBeNull();
    expect(userPosition?.position[1]).toBeCloseTo(USER_POSITION_SHELL_PARSECS, 6);
    expect(userPosition?.label).toBe("RA 90 · Dec 0");
  });

  it("returns null for invalid input", () => {
    expect(buildUserPosition("x", "0")).toBeNull();
  });
});
