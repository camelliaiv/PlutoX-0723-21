import { describe, expect, it } from "vitest";
import {
  daysBetween,
  formatDate,
  formatEpochDates,
  formatModifiedJulianDate,
  formatShortDate,
  formatShortDateWithYear,
  toModifiedJulianDate,
  utcMilliseconds,
} from "./dateText";

describe("dateText", () => {
  it("keeps the date part of a timestamp", () => {
    expect(formatDate("2025-08-15T01:02:03")).toBe("2025-08-15");
  });

  it("writes an epoch inside one year with the year once", () => {
    expect(formatEpochDates("2025-08-15T01:00:00", "2025-10-01T02:00:00")).toBe(
      "15 Aug – 1 Oct 2025",
    );
  });

  it("writes both years when an epoch spans a new year", () => {
    expect(formatEpochDates("2025-12-28T00:00:00", "2026-01-03T00:00:00")).toBe(
      "28 Dec 2025 – 3 Jan 2026",
    );
  });

  it("writes a short date", () => {
    expect(formatShortDate("2026-03-11T10:00:00")).toBe("11 Mar");
  });

  it("reads timestamps without a zone as UTC", () => {
    expect(utcMilliseconds("2025-01-01T00:00:00")).toBe(Date.UTC(2025, 0, 1));
    expect(utcMilliseconds("2025-01-01T00:00:00Z")).toBe(Date.UTC(2025, 0, 1));
  });

  it("counts days between two times", () => {
    expect(daysBetween(Date.UTC(2025, 0, 1), Date.UTC(2025, 0, 11))).toBe(10);
  });

  it("converts a timestamp to a modified Julian date and back to a calendar date", () => {
    expect(toModifiedJulianDate("1970-01-01T00:00:00")).toBe(40587);
    expect(toModifiedJulianDate("2025-08-15T12:00:00")).toBeCloseTo(60902.5, 6);
    expect(formatModifiedJulianDate(60902.5)).toBe("2025-08-15");
  });

  it("writes a short date with its year", () => {
    expect(formatShortDateWithYear("2026-03-11T00:00:00")).toBe("11 Mar 2026");
  });
});
