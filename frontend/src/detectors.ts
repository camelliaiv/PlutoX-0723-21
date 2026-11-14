export interface DetectorBand {
  number: number;
  minimumMicrometers: number;
  maximumMicrometers: number;
}

export const DETECTOR_BANDS: DetectorBand[] = [
  { number: 1, minimumMicrometers: 0.75, maximumMicrometers: 1.09 },
  { number: 2, minimumMicrometers: 1.1, maximumMicrometers: 1.62 },
  { number: 3, minimumMicrometers: 1.63, maximumMicrometers: 2.41 },
  { number: 4, minimumMicrometers: 2.42, maximumMicrometers: 3.82 },
  { number: 5, minimumMicrometers: 3.83, maximumMicrometers: 4.41 },
  { number: 6, minimumMicrometers: 4.42, maximumMicrometers: 5.0 },
];

export function formatWavelengthRange(minimum: number, maximum: number): string {
  return `${minimum.toFixed(2)}–${maximum.toFixed(2)} µm`;
}

export function describeDetectorBand(band: DetectorBand): string {
  const range = formatWavelengthRange(band.minimumMicrometers, band.maximumMicrometers);
  return `D${band.number} (${range})`;
}
