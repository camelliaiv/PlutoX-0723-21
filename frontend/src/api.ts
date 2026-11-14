import type { SkyCoordinatesInput } from "./urlState";

export interface Epoch {
  number: number;
  start_date: string;
  end_date: string;
  image_count: number;
  image_count_by_band: Record<string, number>;
}

export interface ObservationsResponse {
  target: { right_ascension: number; declination: number };
  collection: string;
  citation: string;
  search_url: string;
  image_count: number;
  epochs: Epoch[];
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

export async function fetchObservations(
  coordinates: SkyCoordinatesInput,
  signal: AbortSignal,
): Promise<ObservationsResponse> {
  const query = new URLSearchParams({
    ra: coordinates.rightAscension,
    dec: coordinates.declination,
  });
  let response: Response;
  try {
    response = await fetch(`/api/observations?${query}`, { signal });
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
  return (await response.json()) as ObservationsResponse;
}
