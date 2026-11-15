import { fetchFrames } from "./api";
import { DETECTOR_BANDS } from "./detectors";
import { prepareFrames, type PreparedFrames } from "./preparedFrames";
import type { SkyCoordinatesInput } from "./urlState";

export interface FramesCache {
  get(detector: number): PreparedFrames | undefined;
  all(): ReadonlyMap<number, PreparedFrames>;
  store(detector: number, prepared: PreparedFrames): void;
  switchSubject(subjectKey: string): void;
  clear(): void;
  signal(): AbortSignal;
  isPending(detector: number): boolean;
  setPending(detector: number, isPending: boolean): void;
  subscribe(listener: () => void): void;
}

export interface MissingDetectorsRequest {
  targetSlug: string | null;
  coordinates: SkyCoordinatesInput;
}

export function createFramesCache(): FramesCache {
  const preparedByDetector = new Map<number, PreparedFrames>();
  const pendingDetectors = new Set<number>();
  const listeners: Array<() => void> = [];
  let activeSubjectKey = "";
  let subjectAbort = new AbortController();

  function notify(): void {
    for (const listener of listeners) {
      listener();
    }
  }

  function clear(): void {
    preparedByDetector.clear();
    pendingDetectors.clear();
    activeSubjectKey = "";
    subjectAbort.abort();
    subjectAbort = new AbortController();
    notify();
  }

  return {
    get: (detector) => preparedByDetector.get(detector),
    all: () => preparedByDetector,
    store(detector, prepared): void {
      preparedByDetector.set(detector, prepared);
      notify();
    },
    switchSubject(subjectKey): void {
      if (subjectKey === activeSubjectKey) {
        return;
      }
      clear();
      activeSubjectKey = subjectKey;
    },
    clear,
    signal: () => subjectAbort.signal,
    isPending: (detector) => pendingDetectors.has(detector),
    setPending(detector, isPending): void {
      if (isPending) {
        pendingDetectors.add(detector);
      } else {
        pendingDetectors.delete(detector);
      }
    },
    subscribe(listener): void {
      listeners.push(listener);
    },
  };
}

export function fetchMissingDetectors(cache: FramesCache, request: MissingDetectorsRequest): void {
  const signal = cache.signal();
  for (const band of DETECTOR_BANDS) {
    if (cache.get(band.number) || cache.isPending(band.number)) {
      continue;
    }
    cache.setPending(band.number, true);
    fetchFrames({ detector: band.number, ...request }, signal)
      .then((response) => {
        if (!signal.aborted) {
          cache.store(band.number, prepareFrames(response));
        }
      })
      .catch(() => undefined)
      .finally(() => {
        if (!signal.aborted) {
          cache.setPending(band.number, false);
        }
      });
  }
}
