import type { Epoch, ObservationsResponse } from "./api";
import { createElement } from "./dom";

const EPOCH_TABLE_HEADINGS = ["Epoch", "Dates (UTC)", "Images", "Images per band"];

export function formatDate(isoDateTime: string): string {
  return isoDateTime.slice(0, 10);
}

export function formatBandCounts(imageCountByBand: Record<string, number>): string {
  return Object.entries(imageCountByBand)
    .map(([band, imageCount]) => `${band.replace("SPHEREx-", "")}: ${imageCount}`)
    .join(", ");
}

export function describeAvailability(response: ObservationsResponse): string {
  if (response.image_count === 0) {
    return "No SPHEREx images found at this position in this collection.";
  }
  const epochCount = response.epochs.length;
  const epochWord = epochCount === 1 ? "epoch" : "epochs";
  return (
    `Data available from ${epochCount} ${epochWord} (${response.image_count} images). ` +
    "Motion is to be verified."
  );
}

function renderEpochRow(epoch: Epoch): HTMLTableRowElement {
  const row = createElement("tr");
  row.append(
    createElement("td", String(epoch.number)),
    createElement("td", `${formatDate(epoch.start_date)} – ${formatDate(epoch.end_date)}`),
    createElement("td", String(epoch.image_count)),
    createElement("td", formatBandCounts(epoch.image_count_by_band)),
  );
  return row;
}

function renderEpochTable(response: ObservationsResponse): HTMLDivElement {
  const headingRow = createElement("tr");
  for (const heading of EPOCH_TABLE_HEADINGS) {
    const headingCell = createElement("th", heading);
    headingCell.scope = "col";
    headingRow.append(headingCell);
  }

  const tableHead = createElement("thead");
  tableHead.append(headingRow);
  const tableBody = createElement("tbody");
  tableBody.append(...response.epochs.map(renderEpochRow));

  const table = createElement("table");
  table.append(
    createElement("caption", `Observation epochs (${response.collection})`),
    tableHead,
    tableBody,
  );

  const tableScroll = createElement("div");
  tableScroll.className = "table-scroll";
  tableScroll.append(table);
  return tableScroll;
}

function renderCitation(response: ObservationsResponse): HTMLParagraphElement {
  const archiveLink = createElement("a", "Archive search");
  archiveLink.href = response.search_url;
  archiveLink.target = "_blank";
  archiveLink.rel = "noopener noreferrer";

  const citation = createElement("p", `${response.citation}.`);
  citation.className = "citation";
  citation.append(createElement("br"), archiveLink);
  return citation;
}

export function renderResults(response: ObservationsResponse): DocumentFragment {
  const results = document.createDocumentFragment();
  results.append(createElement("p", describeAvailability(response)));
  if (response.epochs.length > 0) {
    results.append(renderEpochTable(response));
  }
  results.append(renderCitation(response));
  return results;
}
