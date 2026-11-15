import { createElement, requireElement } from "./dom";
import { describeFieldRows, describeFrameRows, describeMetadata, type FactRow } from "./factsText";
import { describePredictedMotion, formatPredictedMotion } from "./motionText";
import type { ChallengeTarget } from "./presets";
import type { PreparedFrames } from "./preparedFrames";

export interface TargetFacts {
  render(target: ChallengeTarget | null, prepared: PreparedFrames, epochIndex: number): void;
  clear(): void;
}

const FREE_COORDINATES_TITLE = "Custom coordinates";
const FREE_COORDINATES_SOURCE = "Position entered by the user";
const MOTION_DISCLAIMER =
  "This is a prediction from the catalogue, shown as the orange ring. It is not a measurement from the frame pixels.";

function createHeading(level: "h2" | "h3", text: string): HTMLElement {
  const heading = createElement(level, text);
  heading.className = level === "h3" ? "panel-heading" : "facts-title";
  return heading;
}

function createFactList(rows: FactRow[]): HTMLDListElement {
  const list = createElement("dl");
  list.className = "fact-list";
  for (const row of rows) {
    const value = createElement("dd", row.value);
    value.className = "mono";
    list.append(createElement("dt", row.label), value);
  }
  return list;
}

function createDetails(
  title: string,
  lines: string[],
  isOpen: boolean,
  onToggle: (open: boolean) => void,
): HTMLDetailsElement {
  const details = createElement("details");
  details.open = isOpen;
  details.append(createElement("summary", title));
  const list = createElement("ul");
  list.append(...lines.map((line) => createElement("li", line)));
  details.append(list);
  details.addEventListener("toggle", () => onToggle(details.open));
  return details;
}

export function createTargetFacts(): TargetFacts {
  const container = requireElement<HTMLElement>("#target-facts");
  let isMetadataOpen = false;
  let isCitationsOpen = false;

  return {
    render(target, prepared, epochIndex): void {
      const { response } = prepared;
      const frame = response.frames[epochIndex];
      const detector = frame?.detector ?? 0;
      const source = createElement("p", target?.coordinateSource ?? FREE_COORDINATES_SOURCE);
      source.className = "facts-source";
      const parts: HTMLElement[] = [
        createHeading("h3", "Target facts"),
        createHeading("h2", target?.name ?? FREE_COORDINATES_TITLE),
        source,
        createFactList(describeFieldRows(response)),
      ];

      const motion = describePredictedMotion(response.frames, response.grid.pixel_scale_arcseconds);
      if (motion) {
        const motionBox = createElement("div");
        motionBox.className = "facts-motion";
        const lead = createElement("b", "Predicted motion: ");
        motionBox.append(lead, formatPredictedMotion(motion), createElement("br"));
        const disclaimer = createElement("span", MOTION_DISCLAIMER);
        disclaimer.className = "facts-muted";
        motionBox.append(disclaimer);
        parts.push(createHeading("h3", `Motion · D${detector}`), motionBox);
      }

      if (frame) {
        parts.push(
          createHeading("h3", "Current frame"),
          createFactList(describeFrameRows(frame, epochIndex + 1, response.frames.length)),
          createDetails(
            "Metadata and flags",
            describeMetadata(response, frame),
            isMetadataOpen,
            (open) => {
              isMetadataOpen = open;
            },
          ),
        );
      }
      parts.push(
        createDetails(
          "Citations",
          response.citations.map((citation) => `${citation}.`),
          isCitationsOpen,
          (open) => {
            isCitationsOpen = open;
          },
        ),
      );
      container.replaceChildren(...parts);
    },

    clear(): void {
      container.replaceChildren();
    },
  };
}
