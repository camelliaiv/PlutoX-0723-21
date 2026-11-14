import { describe, expect, it } from "vitest";
import type { ObservationsResponse } from "./api";
import { describeAvailability, formatBandCounts, renderResults } from "./render";

const barnardStarResponse: ObservationsResponse = {
  target: { right_ascension: 269.4465, declination: 4.7668 },
  collection: "spherex_dr1",
  citation: "NASA/IPAC Infrared Science Archive, SPHEREx Data Release 1 spectral images",
  search_url: "https://irsa.ipac.caltech.edu/SIA?COLLECTION=spherex_dr1&POS=circle",
  image_count: 3,
  epochs: [
    {
      number: 1,
      start_date: "2025-08-15T01:00:00",
      end_date: "2025-10-01T02:00:00",
      image_count: 2,
      image_count_by_band: { "SPHEREx-D1": 1, "SPHEREx-D2": 1 },
    },
    {
      number: 2,
      start_date: "2026-03-11T01:00:00",
      end_date: "2026-03-11T02:00:00",
      image_count: 1,
      image_count_by_band: { "SPHEREx-D1": 1 },
    },
  ],
};

describe("render", () => {
  it("formats image counts per detector band", () => {
    expect(formatBandCounts(barnardStarResponse.epochs[0].image_count_by_band)).toBe(
      "D1: 1, D2: 1",
    );
  });

  it("describes availability without claiming motion", () => {
    const description = describeAvailability(barnardStarResponse);
    expect(description).toContain("Data available from 2 epochs");
    expect(description).toContain("to be verified");
  });

  it("reports when no images are found", () => {
    const emptyResponse = { ...barnardStarResponse, image_count: 0, epochs: [] };
    expect(describeAvailability(emptyResponse)).toContain("No SPHEREx images");
  });

  it("renders one table row per epoch", () => {
    const container = document.createElement("div");
    container.append(renderResults(barnardStarResponse));
    const rows = container.querySelectorAll("tbody tr");
    expect(rows).toHaveLength(2);
    expect(rows[0].textContent).toContain("2025-08-15 – 2025-10-01");
    expect(container.querySelectorAll("th[scope='col']")).toHaveLength(4);
  });

  it("renders the citation with an archive link that opens in a new tab", () => {
    const container = document.createElement("div");
    container.append(renderResults(barnardStarResponse));
    expect(container.querySelector(".citation")?.textContent).toContain("Data Release 1");
    const archiveLink = container.querySelector<HTMLAnchorElement>(".citation a");
    expect(archiveLink?.href).toBe(barnardStarResponse.search_url);
    expect(archiveLink?.target).toBe("_blank");
    expect(archiveLink?.rel).toBe("noopener noreferrer");
  });

  it("shows text from the server as text, never as markup", () => {
    const container = document.createElement("div");
    container.append(
      renderResults({ ...barnardStarResponse, citation: "<img src=x onerror=alert(1)>" }),
    );
    expect(container.querySelector("img")).toBeNull();
    expect(container.querySelector(".citation")?.textContent).toContain("<img src=x");
  });

  it("omits the epoch table when there are no images", () => {
    const container = document.createElement("div");
    container.append(renderResults({ ...barnardStarResponse, image_count: 0, epochs: [] }));
    expect(container.querySelector("table")).toBeNull();
  });
});
