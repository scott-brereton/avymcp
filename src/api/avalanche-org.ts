/**
 * Avalanche.org REST API client
 * Base URL: https://api.avalanche.org/v2/public/
 * No authentication required.
 */

import type {
  MapLayerResponse,
  ForecastProduct,
  CenterInfo,
} from "../lib/types.js";

const BASE = "https://api.avalanche.org/v2/public";

async function fetchJSON<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`API error ${res.status}: ${text.slice(0, 200)}`);
  }
  return res.json() as Promise<T>;
}

/** Get GeoJSON map layer with danger ratings for all zones */
export async function getMapLayer(
  centerId?: string,
  date?: string,
): Promise<MapLayerResponse> {
  let url = centerId
    ? `${BASE}/products/map-layer/${centerId}`
    : `${BASE}/products/map-layer`;

  if (date) url += `?datetime=${date}`;
  return fetchJSON<MapLayerResponse>(url);
}

/** Get full forecast product for a center + zone */
export async function getForecastProduct(
  centerId: string,
  zoneId: number,
): Promise<ForecastProduct> {
  return fetchJSON<ForecastProduct>(
    `${BASE}/product?type=forecast&center_id=${centerId}&zone_id=${zoneId}`,
  );
}

/** Get a product by its numeric ID */
export async function getProductById(
  productId: number,
): Promise<ForecastProduct> {
  return fetchJSON<ForecastProduct>(`${BASE}/product/${productId}`);
}

/** Get center metadata including zones */
export async function getCenterInfo(centerId: string): Promise<CenterInfo> {
  return fetchJSON<CenterInfo>(`${BASE}/avalanche-center/${centerId}`);
}

/** List products for a center within a date range */
export async function listProducts(
  centerId: string,
  dateStart: string,
  dateEnd: string,
): Promise<ForecastProduct[]> {
  return fetchJSON<ForecastProduct[]>(
    `${BASE}/products?avalanche_center_id=${centerId}&date_start=${dateStart}&date_end=${dateEnd}`,
  );
}
