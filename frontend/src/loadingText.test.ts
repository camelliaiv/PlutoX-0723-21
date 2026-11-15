import { describe, expect, it } from "vitest";
import { describeDetectorRange, describeLoading } from "./loadingText";

const coordinates = { rightAscension: "269.4465", declination: "4.7668" };

describe("describeLoading", () => {
  it("calls challenge targets near-instant and never mentions a minute", () => {
    const text = describeLoading({ targetName: "Barnard's Star", detector: 5, coordinates });
    expect(text).toContain("Barnard's Star");
    expect(text).toContain("D5, 3.83–4.41 µm");
    expect(text).toContain("near-instant");
    expect(text).not.toContain("60 seconds");
  });

  it("explains that free coordinates take 30 to 60 seconds", () => {
    const text = describeLoading({ targetName: null, detector: 1, coordinates });
    expect(text).toContain("RA 269.4465, Dec 4.7668");
    expect(text).toContain("30 to 60 seconds");
  });
});

describe("describeDetectorRange", () => {
  it("names the detector with its wavelength range", () => {
    expect(describeDetectorRange(1)).toBe("D1, 0.75–1.09 µm");
  });

  it("falls back to the detector name for an unknown detector", () => {
    expect(describeDetectorRange(9)).toBe("D9");
  });
});
