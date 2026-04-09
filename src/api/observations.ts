/**
 * Avalanche.org Observations API client
 * Base URL: https://api.avalanche.org/obs/v1/public/
 * Requires Referer header from a registered avalanche center domain.
 */

import type { ObservationListResponse, Observation } from "../lib/types.js";

const BASE = "https://api.avalanche.org/obs/v1/public";

async function fetchObs<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    headers: {
      Origin: "https://nwac.us",
      Referer: "https://nwac.us/observations",
      "User-Agent": "avymcp/1.0",
    },
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Observations API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

/** List observations with filters */
export async function listObservations(opts: {
  centerId?: string;
  startDate: string;
  endDate: string;
  page?: number;
  pageSize?: number;
}): Promise<ObservationListResponse> {
  const params = new URLSearchParams();
  params.set("start_date[gte]", opts.startDate);
  params.set("start_date[lte]", opts.endDate);
  params.set("sort_by", "start_date");
  params.set("sort_order", "desc");
  params.set("page", String(opts.page ?? 1));
  params.set("page_size", String(opts.pageSize ?? 10));
  if (opts.centerId) params.set("center_id", opts.centerId);

  return fetchObs<ObservationListResponse>(
    `${BASE}/observation/list/?${params.toString()}`,
  );
}

/** Get a single observation by UUID */
export async function getObservation(id: string): Promise<Observation> {
  return fetchObs<Observation>(`${BASE}/observation/${id}`);
}
