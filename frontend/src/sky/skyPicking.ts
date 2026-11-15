import type { CameraBasis, Viewport } from "./skyCamera";
import { focalLength } from "./skyCamera";
import { RENDER_VALUES_PER_STAR, describeStar, type SkyCatalogue } from "./skyCatalogue";
import { LIGHT_YEARS_PER_PARSEC } from "./skyMath";
import { DIRECTION_ONLY_DISTANCE_TEXT, formatDistance, type SkyTarget } from "./skyTargets";
import type { TooltipContent } from "./skyHud";
import type { TargetScreenPosition } from "./skyOverlay";

const TARGET_PICK_RADIUS_PIXELS = 22;
const STAR_PICK_RADIUS_PIXELS = 12;
const STAR_PICK_MINIMUM_DEPTH = 0.04;
const STAR_PICK_FAINTEST_MAGNITUDE = 7.8;
const STAR_PICK_MAGNITUDE_WEIGHT = 3;
const MINIMUM_PICK_DISTANCE = 0.03;
const REFERENCE_DISTANCE_PARSECS = 10;

export function findTargetAt(
  positions: ReadonlyMap<string, TargetScreenPosition>,
  targets: readonly SkyTarget[],
  x: number,
  y: number,
): SkyTarget | null {
  let nearest: SkyTarget | null = null;
  let nearestDistance = TARGET_PICK_RADIUS_PIXELS;
  for (const target of targets) {
    const position = positions.get(target.slug);
    if (!position || !position.visible) {
      continue;
    }
    const distance = Math.hypot(position.x - x, position.y - y);
    if (distance < nearestDistance) {
      nearestDistance = distance;
      nearest = target;
    }
  }
  return nearest;
}

export function findStarNear(
  catalogue: SkyCatalogue,
  basis: CameraBasis,
  viewport: Viewport,
  pointerX: number,
  pointerY: number,
): number | null {
  const length = focalLength(viewport);
  const values = catalogue.renderValues;
  let bestIndex: number | null = null;
  let bestScore = Number.POSITIVE_INFINITY;
  for (
    let index = 0, start = 0;
    index < catalogue.count;
    index++, start += RENDER_VALUES_PER_STAR
  ) {
    const isBackground = (values[start + 4] ?? 0) > 0.5;
    const relativeX = isBackground
      ? (values[start] ?? 0)
      : (values[start] ?? 0) - basis.position[0];
    const relativeY = isBackground
      ? (values[start + 1] ?? 0)
      : (values[start + 1] ?? 0) - basis.position[1];
    const relativeZ = isBackground
      ? (values[start + 2] ?? 0)
      : (values[start + 2] ?? 0) - basis.position[2];
    const depth =
      relativeX * basis.forward[0] + relativeY * basis.forward[1] + relativeZ * basis.forward[2];
    if (depth < STAR_PICK_MINIMUM_DEPTH) {
      continue;
    }
    const screenX =
      viewport.width / 2 +
      ((relativeX * basis.right[0] + relativeY * basis.right[1] + relativeZ * basis.right[2]) /
        depth) *
        length;
    const offsetX = screenX - pointerX;
    if (offsetX > STAR_PICK_RADIUS_PIXELS || offsetX < -STAR_PICK_RADIUS_PIXELS) {
      continue;
    }
    const screenY =
      viewport.height / 2 -
      ((relativeX * basis.up[0] + relativeY * basis.up[1] + relativeZ * basis.up[2]) / depth) *
        length;
    const offsetY = screenY - pointerY;
    if (offsetY > STAR_PICK_RADIUS_PIXELS || offsetY < -STAR_PICK_RADIUS_PIXELS) {
      continue;
    }
    const absoluteMagnitude = values[start + 3] ?? 0;
    const apparentMagnitude = isBackground
      ? absoluteMagnitude
      : absoluteMagnitude +
        5 *
          Math.log10(
            Math.max(Math.hypot(relativeX, relativeY, relativeZ), MINIMUM_PICK_DISTANCE) /
              REFERENCE_DISTANCE_PARSECS,
          );
    if (apparentMagnitude > STAR_PICK_FAINTEST_MAGNITUDE) {
      continue;
    }
    const score =
      offsetX * offsetX + offsetY * offsetY + apparentMagnitude * STAR_PICK_MAGNITUDE_WEIGHT;
    if (score < bestScore) {
      bestScore = score;
      bestIndex = index;
    }
  }
  return bestIndex;
}

export function describeStarTooltip(catalogue: SkyCatalogue, index: number): TooltipContent {
  const star = describeStar(catalogue, index);
  const catalogueName = star.source === "hipparcos" ? "Hipparcos" : "Gaia DR3";
  const distance =
    star.distanceParsecs === null
      ? `no reliable distance in ${catalogueName}`
      : `${star.distanceParsecs.toFixed(2)} pc · ${(star.distanceParsecs * LIGHT_YEARS_PER_PARSEC).toFixed(1)} ly`;
  const colour = star.colourIndex === null ? "n/a" : star.colourIndex.toFixed(2);
  const position = `RA ${star.rightAscensionDegrees.toFixed(3)}° Dec ${star.declinationDegrees.toFixed(3)}°`;
  if (star.source === "hipparcos") {
    return {
      title: "Hipparcos star",
      lines: [
        distance,
        `Hp ${star.magnitude.toFixed(2)} · B-V ${colour}`,
        `${position} (J1991.25)`,
      ],
      monospaceLines: true,
    };
  }
  return {
    title: "Gaia DR3 star",
    lines: [distance, `G ${star.magnitude.toFixed(2)} · BP-RP ${colour}`, position],
    monospaceLines: true,
  };
}

export function describeTargetTooltip(target: SkyTarget): TooltipContent {
  return {
    title: target.name,
    lines: [
      target.distanceParsecs === null
        ? DIRECTION_ONLY_DISTANCE_TEXT
        : formatDistance(target.distanceParsecs, 2, 1),
    ],
    note: "Click to fly there",
    monospaceLines: false,
  };
}
