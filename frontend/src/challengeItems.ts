import type { DisplayMode } from "./frameModes";

export type ChallengeStatus = "implemented" | "partial" | "notIncluded";

export type ChallengeAction =
  | { kind: "flyToTarget"; targetSlug: string }
  | { kind: "openTimeMachine"; targetSlug: string }
  | { kind: "showMode"; targetSlug: string; mode: DisplayMode; epochIndex: number }
  | { kind: "showSaturationTint"; targetSlug: string }
  | { kind: "showSpectrum" }
  | { kind: "focusCoordinates" }
  | { kind: "copyLink" };

export interface ChallengeItem {
  identifier: string;
  requirement: string;
  status: ChallengeStatus;
  detail: string;
  missing: string | null;
  actionLabel: string | null;
  action: ChallengeAction | null;
}

const EXAMPLE_TARGET_SLUG = "barnards_star";

export const CHALLENGE_ITEMS: readonly ChallengeItem[] = [
  {
    identifier: "public-web-tool",
    requirement: "A public-facing web tool that shows SPHEREx sky images",
    status: "implemented",
    detail:
      "A browser app shows SPHEREx spectral images from the NASA/IPAC Infrared Science Archive for " +
      "any sky position. Deployment files for a public host are included in the repository.",
    missing: null,
    actionLabel: "Open an example",
    action: { kind: "openTimeMachine", targetSlug: EXAMPLE_TARGET_SLUG },
  },
  {
    identifier: "coordinate-entry",
    requirement: "Users enter Right Ascension and declination",
    status: "implemented",
    detail:
      "The Time machine search form takes Right Ascension and declination as decimal degrees or " +
      "as sexagesimal text.",
    missing: null,
    actionLabel: "Go to the search form",
    action: { kind: "focusCoordinates" },
  },
  {
    identifier: "image-series",
    requirement: "A series of images of that patch, shown like a little video",
    status: "implemented",
    detail:
      "Each target is shown as a series of epochs that blink like a short video, with play, " +
      "step, speed, zoom, colour map and stretch controls.",
    missing: null,
    actionLabel: "Blink Barnard's Star",
    action: { kind: "openTimeMachine", targetSlug: EXAMPLE_TARGET_SLUG },
  },
  {
    identifier: "test-targets",
    requirement:
      "Test targets: Barnard's Star, Epsilon Indi B, WISE 0855−0714, RW Aurigae, R Draconis",
    status: "implemented",
    detail:
      "All five targets have a marker in the 3D sky, stored frames for detectors D1 to D6 and a " +
      "guide entry.",
    missing: null,
    actionLabel: "Fly to WISE 0855−0714",
    action: { kind: "flyToTarget", targetSlug: "wise_0855_0714" },
  },
  {
    identifier: "easy-updates",
    requirement: "Easy to update with the latest data releases",
    status: "implemented",
    detail:
      "A command (python -m app.precompute_frames) refreshes the stored frames from the archive. " +
      "Any other position is searched live in Data Release 1 and Quick Release 3.",
    missing: null,
    actionLabel: "Try a live search",
    action: { kind: "focusCoordinates" },
  },
  {
    identifier: "infrared-bands",
    requirement: "A creative display of the 102 infrared bands",
    status: "implemented",
    detail:
      "The Time machine lays out detectors D1 to D6 by epoch, and the Pixel scale spectrum plots " +
      "every exposure at its own wavelength.",
    missing: null,
    actionLabel: "Show the spectrum",
    action: { kind: "showSpectrum" },
  },
  {
    identifier: "detector-coadds",
    requirement: "Add together the data of each of the six detector arrays",
    status: "implemented",
    detail:
      "The exposures of each epoch are co-added per detector, weighted by inverse variance, on a " +
      "shared grid. The six detectors cover different wavelengths, so they are shown side by " +
      "side and in one spectrum rather than summed into a single image.",
    missing: null,
    actionLabel: "See the six detectors",
    action: { kind: "openTimeMachine", targetSlug: EXAMPLE_TARGET_SLUG },
  },
  {
    identifier: "spectra-on-the-fly",
    requirement: "Spectra on the fly",
    status: "implemented",
    detail:
      "The backend measures every exposure at the target position when frames are requested, and " +
      "the Pixel scale view plots the result, with an optional logarithmic flux axis. Stored " +
      "results are reused for the five targets.",
    missing: null,
    actionLabel: "Show the spectrum",
    action: { kind: "showSpectrum" },
  },
  {
    identifier: "add-subtract-images",
    requirement: "Add or subtract images taken at different times",
    status: "implemented",
    detail:
      "Difference shows each epoch minus the first epoch. Stack shows the inverse-variance " +
      "combination of all epochs.",
    missing: null,
    actionLabel: "Switch to Difference",
    action: {
      kind: "showMode",
      targetSlug: EXAMPLE_TARGET_SLUG,
      mode: "difference",
      epochIndex: 1,
    },
  },
  {
    identifier: "field-of-view",
    requirement: "Let users choose the field of view",
    status: "partial",
    detail:
      "The backend accepts a size from 8 to 96 pixels at 6.15″ per pixel. The page always asks " +
      "for the default 32 pixels, about 3.3′ across. Zoom from 1× to 8× magnifies that fixed " +
      "field and does not change it.",
    missing: "No control in the page chooses the size of the field.",
    actionLabel: "Open the zoom controls",
    action: { kind: "openTimeMachine", targetSlug: EXAMPLE_TARGET_SLUG },
  },
  {
    identifier: "other-telescope-overlays",
    requirement: "Overlay data from other telescopes, such as Gaia or WISE",
    status: "partial",
    detail:
      "A predicted-position marker and a track are drawn on the frames from the Gaia DR3 or " +
      "CatWISE2020 catalogue position and proper motion. The 3D sky shows Gaia DR3 and " +
      "Hipparcos stars.",
    missing: "No catalogue stars or WISE sources are drawn over the SPHEREx frames.",
    actionLabel: "Show marker and track",
    action: { kind: "openTimeMachine", targetSlug: EXAMPLE_TARGET_SLUG },
  },
  {
    identifier: "coordinates-in-url",
    requirement: "Query the tool with coordinates in the URL",
    status: "implemented",
    detail:
      "The target or the ra and dec parameters, with the detector, view, mode, colour map, " +
      "stretch and zoom, are read on load and rewritten as the view changes.",
    missing: null,
    actionLabel: "Copy a link to this view",
    action: { kind: "copyLink" },
  },
  {
    identifier: "metadata-and-flags",
    requirement: "Display metadata such as contamination flags",
    status: "partial",
    detail:
      "Hovering a pixel shows its value, variance, coverage and saturated fraction. Saturation " +
      "can be tinted on the frame, and each frame lists its data release, exposure count and " +
      "citation.",
    missing: "Only the saturation flags are used; other flag bits are not shown.",
    actionLabel: "Tint saturated pixels",
    action: { kind: "showSaturationTint", targetSlug: EXAMPLE_TARGET_SLUG },
  },
  {
    identifier: "astropy",
    requirement: "Use Astropy",
    status: "implemented",
    detail:
      "The backend uses Astropy for sky coordinates, times, world coordinate systems, FITS " +
      "files and archive tables.",
    missing: null,
    actionLabel: "See the result",
    action: { kind: "openTimeMachine", targetSlug: EXAMPLE_TARGET_SLUG },
  },
  {
    identifier: "aladin",
    requirement: "Use Aladin",
    status: "notIncluded",
    detail: "Aladin is not used. The 3D sky is drawn directly from Gaia DR3 and Hipparcos data.",
    missing: "No Aladin viewer is included.",
    actionLabel: null,
    action: null,
  },
];
