export type ValueScale = (value: number) => number;

export interface FluxAxis {
  toPixel: ValueScale;
  ticks: number[];
  isLogarithmic: boolean;
  bottomPixel: number;
  topPixel: number;
}

const LINEAR_HEADROOM = 1.08;
const LOGARITHMIC_LOWER_MARGIN = 0.85;
const LOGARITHMIC_UPPER_MARGIN = 1.15;
const TARGET_TICK_COUNT = 5;
const LOGARITHMIC_TICK_MULTIPLIERS = [1, 2, 5];
const SIGNIFICANT_DIGITS = 3;
const THOUSAND = 1000;

export function linearScale(
  domainStart: number,
  domainEnd: number,
  rangeStart: number,
  rangeEnd: number,
): ValueScale {
  const span = domainEnd - domainStart;
  return (value) => rangeStart + ((value - domainStart) / span) * (rangeEnd - rangeStart);
}

export function logarithmicScale(
  domainStart: number,
  domainEnd: number,
  rangeStart: number,
  rangeEnd: number,
): ValueScale {
  const linear = linearScale(Math.log10(domainStart), Math.log10(domainEnd), rangeStart, rangeEnd);
  return (value) => linear(Math.log10(value));
}

function niceStep(rawStep: number): number {
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const fraction = rawStep / magnitude;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return niceFraction * magnitude;
}

export function linearTicks(minimum: number, maximum: number): number[] {
  const step = niceStep((maximum - minimum) / TARGET_TICK_COUNT);
  const ticks: number[] = [];
  for (let index = Math.ceil(minimum / step); ; index++) {
    const tick = Number((index * step).toPrecision(12));
    if (tick > maximum) {
      return ticks;
    }
    ticks.push(tick);
  }
}

export function logarithmicTicks(minimum: number, maximum: number): number[] {
  const ticks: number[] = [];
  for (
    let power = Math.floor(Math.log10(minimum));
    power <= Math.ceil(Math.log10(maximum));
    power++
  ) {
    for (const multiplier of LOGARITHMIC_TICK_MULTIPLIERS) {
      const tick = Number((multiplier * 10 ** power).toPrecision(12));
      if (tick >= minimum && tick <= maximum) {
        ticks.push(tick);
      }
    }
  }
  return ticks;
}

export function formatTick(value: number): string {
  const text = String(Number(value.toPrecision(SIGNIFICANT_DIGITS)));
  return Math.abs(value) >= THOUSAND ? `${Number(text) / THOUSAND}k` : text;
}

export function buildFluxAxis(
  values: readonly number[],
  isLogarithmic: boolean,
  bottomPixel: number,
  topPixel: number,
): FluxAxis | null {
  const usable = isLogarithmic ? values.filter((value) => value > 0) : [...values];
  if (usable.length === 0) {
    return null;
  }
  const lowest = Math.min(...usable);
  const highest = Math.max(...usable);
  if (isLogarithmic) {
    const domainStart = lowest * LOGARITHMIC_LOWER_MARGIN;
    const domainEnd = highest * LOGARITHMIC_UPPER_MARGIN;
    return {
      toPixel: logarithmicScale(domainStart, domainEnd, bottomPixel, topPixel),
      ticks: logarithmicTicks(domainStart, domainEnd),
      isLogarithmic,
      bottomPixel,
      topPixel,
    };
  }
  const domainStart = Math.min(0, lowest);
  const upperEdge = highest > 0 ? highest * LINEAR_HEADROOM : 0;
  const domainEnd = upperEdge > domainStart ? upperEdge : domainStart + 1;
  return {
    toPixel: linearScale(domainStart, domainEnd, bottomPixel, topPixel),
    ticks: linearTicks(domainStart, domainEnd),
    isLogarithmic,
    bottomPixel,
    topPixel,
  };
}

export function errorBarEnds(
  flux: number,
  fluxError: number | null,
  axis: FluxAxis,
): { topPixel: number; bottomPixel: number } | null {
  if (fluxError === null) {
    return null;
  }
  const lowerFlux = flux - fluxError;
  const lowerPixel =
    axis.isLogarithmic && lowerFlux <= 0 ? axis.bottomPixel : axis.toPixel(lowerFlux);
  return { topPixel: axis.toPixel(flux + fluxError), bottomPixel: lowerPixel };
}
