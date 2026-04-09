/**
 * Resolves human-readable zone names to numeric feature IDs.
 * Also provides point-in-polygon matching for lat/lon queries.
 */

import type { MapLayerFeature, MapLayerResponse } from "./types.js";

interface ZoneEntry {
  featureId: number;
  name: string;
  centerId: string;
  centerName: string;
  state: string;
}

let cachedZones: ZoneEntry[] | null = null;
let cachedFeatures: MapLayerFeature[] | null = null;
let cacheTime = 0;
const CACHE_TTL = 3600_000; // 1 hour

async function ensureCache(): Promise<void> {
  if (cachedZones && Date.now() - cacheTime < CACHE_TTL) return;

  const res = await fetch(
    "https://api.avalanche.org/v2/public/products/map-layer",
  );
  if (!res.ok) throw new Error(`Failed to fetch map layer: ${res.status}`);
  const data = (await res.json()) as MapLayerResponse;

  cachedFeatures = data.features;
  cachedZones = data.features.map((f) => ({
    featureId: f.id,
    name: f.properties.name,
    centerId: f.properties.center_id,
    centerName: f.properties.center,
    state: f.properties.state,
  }));
  cacheTime = Date.now();
}

/** Fuzzy match a zone name. Returns the best match or null. */
export async function resolveZone(
  query: string,
  centerId?: string,
): Promise<ZoneEntry | null> {
  await ensureCache();

  const q = query.toLowerCase().trim();
  let zones = cachedZones!;

  if (centerId) {
    zones = zones.filter(
      (z) => z.centerId.toLowerCase() === centerId.toLowerCase(),
    );
  }

  // Exact match
  const exact = zones.find((z) => z.name.toLowerCase() === q);
  if (exact) return exact;

  // Starts with
  const starts = zones.find((z) => z.name.toLowerCase().startsWith(q));
  if (starts) return starts;

  // Contains
  const contains = zones.find((z) => z.name.toLowerCase().includes(q));
  if (contains) return contains;

  // Word match - any word in query matches any word in zone name
  const queryWords = q.split(/\s+/);
  const wordMatch = zones.find((z) => {
    const nameWords = z.name.toLowerCase().split(/\s+/);
    return queryWords.some((qw) => nameWords.some((nw) => nw.includes(qw)));
  });
  if (wordMatch) return wordMatch;

  return null;
}

/** Search zones by name, returning all matches */
export async function searchZones(query: string): Promise<ZoneEntry[]> {
  await ensureCache();
  const q = query.toLowerCase().trim();
  return cachedZones!.filter(
    (z) =>
      z.name.toLowerCase().includes(q) ||
      z.centerId.toLowerCase().includes(q) ||
      z.centerName.toLowerCase().includes(q) ||
      z.state.toLowerCase() === q,
  );
}

/** Get all unique center IDs from the map layer */
export async function getAllCenters(): Promise<
  Array<{ id: string; name: string; state: string }>
> {
  await ensureCache();
  const seen = new Map<string, { id: string; name: string; state: string }>();
  for (const z of cachedZones!) {
    if (!seen.has(z.centerId)) {
      seen.set(z.centerId, {
        id: z.centerId,
        name: z.centerName,
        state: z.state,
      });
    }
  }
  return [...seen.values()].sort((a, b) => a.id.localeCompare(b.id));
}

/** Simple point-in-polygon using ray casting */
function pointInPolygon(
  lat: number,
  lon: number,
  ring: number[][],
): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const xi = ring[i][1],
      yi = ring[i][0];
    const xj = ring[j][1],
      yj = ring[j][0];
    if (yi > lon !== yj > lon && lat < ((xj - xi) * (lon - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

/** Find the zone containing a lat/lon point */
export async function findZoneByPoint(
  lat: number,
  lon: number,
): Promise<MapLayerFeature | null> {
  await ensureCache();
  if (!cachedFeatures) return null;

  for (const feature of cachedFeatures) {
    const geom = feature.geometry;
    let rings: number[][][] = [];

    if (geom.type === "Polygon") {
      rings = geom.coordinates as number[][][];
    } else if (geom.type === "MultiPolygon") {
      for (const poly of geom.coordinates as number[][][][]) {
        rings.push(...poly);
      }
    }

    for (const ring of rings) {
      if (pointInPolygon(lat, lon, ring)) {
        return feature;
      }
    }
  }

  return null;
}
