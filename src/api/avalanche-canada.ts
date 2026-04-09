/**
 * Avalanche Canada API client
 * Base URL: https://api.avalanche.ca/
 * No authentication required.
 */

import type { CanadaForecast } from "../lib/types.js";

const BASE = "https://api.avalanche.ca";

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Avalanche Canada API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

/** Get forecast by lat/lon coordinates */
export async function getForecastByPoint(
  lat: number,
  lon: number,
  lang: "en" | "fr" = "en",
): Promise<CanadaForecast> {
  const wrapper = await fetchJSON<{ report: CanadaForecast }>(
    `${BASE}/forecasts/${lang}/products/point?lat=${lat}&long=${lon}`,
  );
  return wrapper.report;
}

/** Get all forecast areas as GeoJSON */
export async function getForecastAreas(
  lang: "en" | "fr" = "en",
): Promise<unknown> {
  return fetchJSON(`${BASE}/forecasts/${lang}/areas`);
}
