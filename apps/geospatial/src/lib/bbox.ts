// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0.

// Pure, Leaflet-free geospatial helpers shared by MapPage + LeafletMap. Kept in
// their own module so they are unit-testable (Vitest) without importing Leaflet
// or its CSS (GE-DEF-002).

export type Bbox = readonly [number, number, number, number]; // [minLon,minLat,maxLon,maxLat]

/** Parse "minLon,minLat,maxLon,maxLat" into a validated Bbox, or null. */
export function parseBbox(input: string | undefined | null): Bbox | null {
  if (!input) return null;
  const parts = input.split(",").map((n) => Number(n.trim()));
  if (parts.length !== 4 || parts.some((n) => Number.isNaN(n))) return null;
  const [minLon, minLat, maxLon, maxLat] = parts;
  if (minLon > maxLon || minLat > maxLat) return null;
  if (minLon < -180 || maxLon > 180 || minLat < -90 || maxLat > 90) return null;
  return [minLon, minLat, maxLon, maxLat];
}

/** Format a Bbox back to the canonical "minLon,minLat,maxLon,maxLat" string. */
export function formatBbox(bbox: Bbox): string {
  return bbox.map((n) => Number(n.toFixed(5))).join(",");
}

/** Leaflet LatLngBounds order is [[south,west],[north,east]]. */
export function bboxToLeafletBounds(bbox: Bbox): [[number, number], [number, number]] {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return [[minLat, minLon], [maxLat, maxLon]];
}

/** Centre [lat,lon] of a bbox. */
export function bboxCenter(bbox: Bbox): [number, number] {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return [(minLat + maxLat) / 2, (minLon + maxLon) / 2];
}

/** Area of a bbox in square degrees. */
export function bboxAreaDeg2(bbox: Bbox): number {
  const [minLon, minLat, maxLon, maxLat] = bbox;
  return Math.abs(maxLon - minLon) * Math.abs(maxLat - minLat);
}

/** Extract a GeoJSON FeatureCollection-ish payload from an arbitrary result. */
export function extractFeatures(result: unknown): GeoJSON.GeoJsonObject | null {
  if (!result || typeof result !== "object") return null;
  const r = result as Record<string, unknown>;
  const data = r.data as Record<string, unknown> | undefined;
  const candidates = [r.features, r.geojson, data?.features, data?.geojson];
  for (const c of candidates) {
    if (Array.isArray(c) && c.length && typeof c[0] === "object") {
      return { type: "FeatureCollection", features: c } as unknown as GeoJSON.GeoJsonObject;
    }
    if (c && typeof c === "object" && (c as Record<string, unknown>).type === "FeatureCollection") {
      return c as GeoJSON.GeoJsonObject;
    }
  }
  return null;
}
