import type { SkyCoordinatesInput } from "./urlState";

export interface SkyPosition {
  right_ascension: number;
  declination: number;
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

export interface PredictedPosition {
  column: number;
  row: number;
  right_ascension: number;
  declination: number;
}

export interface ExposureMeasurement {
  observation_id: string;
  data_release: string;
  epoch_number: number;
  modified_julian_date: number;
  wavelength_micrometers: number;
  bandwidth_micrometers: number;
  flux_millijansky: number | null;
  flux_error_millijansky: number | null;
  saturated_fraction: number | null;
  non_finite_fraction: number | null;
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
  predicted_position: PredictedPosition;
}

export interface FramesResponse {
  reference_position: SkyPosition;
  reference_date: string;
  grid: GridDescription;
  unit: string;
  display_range: DisplayRange | null;
  citations: string[];
  frames: Frame[];
  exposures: ExposureMeasurement[];
  flux_unit: string;
  notes: string[];
  served_from_cache: boolean;
  computed_at: string;
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

export interface TargetFacts {
  slug: string;
  name: string;
  catalogue_source_id: string;
  reference_epoch: string;
  right_ascension_degrees: number;
  declination_degrees: number;
  proper_motion_right_ascension_milliarcseconds_per_year: number;
  proper_motion_declination_milliarcseconds_per_year: number;
  total_proper_motion_arcseconds_per_year: number;
  distance_parsecs: number | null;
  distance_source: string;
}

export interface TargetsResponse {
  targets: TargetFacts[];
}

export function fetchTargets(signal: AbortSignal): Promise<TargetsResponse> {
  return fetchJson<TargetsResponse>("/api/targets", signal);
}
