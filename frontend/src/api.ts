import type { SkyCoordinatesInput } from "./urlState";

export interface Epoch {
  number: number;
  start_date: string;
  end_date: string;
  image_count: number;
  image_count_by_band: Record<string, number>;
}

export interface SkyPosition {
  right_ascension: number;
  declination: number;
}

export interface ObservationsResponse {
  target: SkyPosition;
  collection: string;
  citation: string;
  search_url: string;
  image_count: number;
  epochs: Epoch[];
}

export interface GridDescription {
  size_pixels: number;
  pixel_scale_arcseconds: number;
  center: SkyPosition;
  orientation: string;
}

export interface DisplayRange {
  minimum: number;
  maximum: number;
}

export interface Frame {
  epoch_number: number;
  start_date: string;
  end_date: string;
  detector: number;
  exposure_count: number;
  skipped_exposure_count: number;
  wavelength_min_micrometers: number;
  wavelength_max_micrometers: number;
  observation_ids: string[];
  data_releases: string[];
  image: (number | null)[][];
  variance: (number | null)[][];
  coverage: number[][];
  saturated_fraction: (number | null)[][];
}

export interface FramesResponse {
  reference_position: SkyPosition;
  reference_date: string;
  grid: GridDescription;
  unit: string;
  display_range: DisplayRange | null;
  citations: string[];
  frames: Frame[];
  notes: string[];
}

export interface FramesRequest {
  detector: number;
  targetSlug: string | null;
  coordinates: SkyCoordinatesInput;
}

interface ValidationIssue {
  msg: string;
}

interface ErrorBody {
  error?: string;
  detail?: string | ValidationIssue[];
}

export function describeErrorBody(body: ErrorBody | null, httpStatus: number): string {
  if (typeof body?.error === "string") {
    return body.error;
  }
  if (typeof body?.detail === "string") {
    return body.detail;
  }
  if (Array.isArray(body?.detail)) {
    return body.detail.map((issue) => issue.msg).join("; ");
  }
  return `Request failed (HTTP ${httpStatus}).`;
}

async function fetchJson<ResponseBody>(url: string, signal: AbortSignal): Promise<ResponseBody> {
  let response: Response;
  try {
    response = await fetch(url, { signal });
  } catch (error) {
    if (signal.aborted) {
      throw error;
    }
    throw new Error("Cannot reach the PlutoX server. Please try again.");
  }
  if (!response.ok) {
    const errorBody: ErrorBody | null = await response.json().catch(() => null);
    throw new Error(describeErrorBody(errorBody, response.status));
  }
  return (await response.json()) as ResponseBody;
}

export function fetchObservations(
  coordinates: SkyCoordinatesInput,
  signal: AbortSignal,
): Promise<ObservationsResponse> {
  const query = new URLSearchParams({
    ra: coordinates.rightAscension,
    dec: coordinates.declination,
  });
  return fetchJson<ObservationsResponse>(`/api/observations?${query}`, signal);
}

export function buildFramesQuery(request: FramesRequest): string {
  const query = new URLSearchParams({ detector: String(request.detector) });
  if (request.targetSlug) {
    query.set("target", request.targetSlug);
  } else {
    query.set("ra", request.coordinates.rightAscension);
    query.set("dec", request.coordinates.declination);
  }
  return query.toString();
}

export function fetchFrames(request: FramesRequest, signal: AbortSignal): Promise<FramesResponse> {
  return fetchJson<FramesResponse>(`/api/frames?${buildFramesQuery(request)}`, signal);
}
