export interface ScienceNotes {
  saturation?: string;
  detectors: number[];
  motion?: string;
  observations?: string;
  visibility?: string;
  limits: string[];
}

export const SCIENCE_NOTES: Record<string, ScienceNotes> = {
  barnards_star: {
    saturation: "Cores are saturated in D1–D4; D5–D6 are least affected.",
    detectors: [5, 6],
    motion:
      "A measured northward shift of about 10.4″ over about 1 year is consistent with Gaia DR3 to about 0.5–1″.",
    limits: ["Brightness from a saturated core is a lower bound, worst in D1–D4."],
  },
  rw_aurigae: {
    saturation: "Least saturated in D1, where its brightness is measurable.",
    detectors: [1],
    limits: ["Brightness is measurable only in the least saturated detector."],
  },
  r_draconis: {
    saturation:
      "The core is saturated in all six detectors: the position is visible, but brightness is not measurable from the core.",
    detectors: [],
    limits: [
      "Brightness cannot be measured from the saturated core, so only the position is usable.",
    ],
  },
  wise_0855_0714: {
    saturation:
      "Essentially unsaturated in the science checks (no saturated pixels in almost all sampled exposures).",
    detectors: [],
    motion:
      "Its position comes from the CatWISE2020 proper motion and lies about 2′ from the challenge-statement coordinates. It passes a background field star in 2025–2026.",
    visibility: "It is visible only at the longest wavelengths.",
    limits: [
      "A background field star that is bright at short wavelengths passes close to it in 2025–2026.",
    ],
  },
  epsilon_indi_b: {
    saturation: "Essentially unsaturated, with a strong signal from 1 to 5 µm.",
    detectors: [2, 3, 5, 6],
    observations: "It has four epochs, in D2, D3, D5 and D6.",
    limits: ["Only D2, D3, D5 and D6 hold all four epochs."],
  },
};

export function findScienceNotes(targetSlug: string | null): ScienceNotes | null {
  return targetSlug === null ? null : (SCIENCE_NOTES[targetSlug] ?? null);
}
