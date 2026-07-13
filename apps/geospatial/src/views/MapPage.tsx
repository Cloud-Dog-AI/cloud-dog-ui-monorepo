// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0.

// GE-DEF-001: the geospatial WebUI's primary surface is now a REAL interactive
// map (Leaflet) — basemap tiles, a bbox draw tool, a query-result feature
// overlay, and a layer toggle — not a result-only JSON tree. Readers
// (geo.viewer) still get an inline 403 (reader-cannot-render).

import * as React from "react";
import { Alert, Button, Card, CardContent, CardHeader, Input, Label, tryNormaliseAssetReference } from "@cloud-dog/ui";
import { PageHeader, errMessage } from "../lib/ui";
import { useGeoState } from "../state/AppState";
import { isForbidden } from "../lib/api";
import { LeafletMap } from "../components/LeafletMap";
import { bboxCenter, parseBbox, formatBbox, type Bbox } from "../lib/bbox";

const DEFAULT_BBOX = "-0.51,51.28,0.33,51.69";
const DEFAULT_FEATURE_SELECTOR = "amenity";
const DEFAULT_FEATURE_RADIUS_M = "250";

export function MapPage() {
  const { api, appVersion } = useGeoState();
  const [bboxText, setBboxText] = React.useState(DEFAULT_BBOX);
  const [basemap, setBasemap] = React.useState("osm");
  const [featureSelector, setFeatureSelector] = React.useState(DEFAULT_FEATURE_SELECTOR);
  const [featureRadiusM, setFeatureRadiusM] = React.useState(DEFAULT_FEATURE_RADIUS_M);
  const [drawing, setDrawing] = React.useState(false);
  const [result, setResult] = React.useState<Record<string, unknown> | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [forbidden, setForbidden] = React.useState(false);
  const [loading, setLoading] = React.useState(false);

  const bbox: Bbox | null = React.useMemo(() => parseBbox(bboxText), [bboxText]);
  const imageSrc = result ? renderImageSrc(result) : null;

  const onBboxDrawn = React.useCallback((drawn: Bbox) => {
    setBboxText(formatBbox(drawn));
    setDrawing(false);
  }, []);

  const submit = async () => {
    setLoading(true);
    setError(null);
    setForbidden(false);
    setResult(null);
    try {
      const parsed = parseBbox(bboxText);
      const center = parsed ? bboxCenter(parsed) : bboxCenter(parseBbox(DEFAULT_BBOX) as Bbox);
      const basemapTile = await api.basemapTiles(tileFor(center[0], center[1], 15));
      const featureResult = await api.discoverFeatures({
        lat: center[0],
        lon: center[1],
        radius_m: Number(featureRadiusM) || Number(DEFAULT_FEATURE_RADIUS_M),
        selectors: [featureSelector.trim() || DEFAULT_FEATURE_SELECTOR],
        limit: 25,
      });
      const featureGeojson = featureResultToGeojson(featureResult);
      const res = await api.renderMap({
        bbox: parsed ? Array.from(parsed) : undefined,
        basemap: basemap || undefined,
        transfer_mode: "url",
        spec: parsed
          ? {
              title: "Geospatial WebUI render",
              bbox: Array.from(parsed),
              basemap: basemap || undefined,
              width: 640,
              height: 480,
              layers: featureCollectionToRenderLayers(featureGeojson),
            }
          : undefined,
      });
      setResult({ ...res, geojson: featureGeojson, feature_result: featureResult, basemap_tile: basemapTile });
    } catch (e) {
      if (isForbidden(e)) setForbidden(true);
      else setError(errMessage(e, "Render failed."));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6" data-testid="page-map">
      <PageHeader
        title="Map"
        version={appVersion}
        description="Draw a bounding box on the interactive map (or type one), pick a basemap, and render a governed map (geo_render_map). Requires geo.map.render."
      />
      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold">Map query</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-1">
            <Label htmlFor="map-bbox">Bounding box (minLon,minLat,maxLon,maxLat)</Label>
            <Input
              id="map-bbox"
              data-testid="map-bbox"
              value={bboxText}
              placeholder={DEFAULT_BBOX}
              aria-invalid={bbox === null}
              onChange={(e) => setBboxText(e.target.value)}
            />
            {bbox === null ? (
              <p className="text-xs text-red-600" data-testid="map-bbox-invalid">
                Enter four comma-separated numbers: minLon,minLat,maxLon,maxLat.
              </p>
            ) : null}
          </div>
          <div className="space-y-1">
            <Label htmlFor="map-basemap">Basemap</Label>
            <Input id="map-basemap" data-testid="map-basemap" value={basemap}
                   onChange={(e) => setBasemap(e.target.value)} />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="map-feature-selector">Feature selector</Label>
              <Input
                id="map-feature-selector"
                data-testid="map-feature-selector"
                value={featureSelector}
                placeholder={DEFAULT_FEATURE_SELECTOR}
                onChange={(e) => setFeatureSelector(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="map-feature-radius">Feature radius (m)</Label>
              <Input
                id="map-feature-radius"
                data-testid="map-feature-radius"
                type="number"
                min="1"
                value={featureRadiusM}
                placeholder={DEFAULT_FEATURE_RADIUS_M}
                onChange={(e) => setFeatureRadiusM(e.target.value)}
              />
            </div>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              data-testid="map-draw"
              variant={drawing ? "default" : "secondary"}
              aria-pressed={drawing}
              onClick={() => setDrawing((d) => !d)}
            >
              {drawing ? "Click two corners on the map…" : "Draw bbox on map"}
            </Button>
            <Button data-testid="map-submit" onClick={() => void submit()} disabled={loading || bbox === null}>
              {loading ? "Rendering…" : "Render Map"}
            </Button>
          </div>
          {forbidden ? (
            <Alert variant="destructive" data-testid="map-forbidden">
              You do not have permission to run this operation (403 permission_denied).
            </Alert>
          ) : null}
          {error ? (
            <Alert variant="destructive" data-testid="map-error">{error}</Alert>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-sm font-semibold">Interactive map</h2>
        </CardHeader>
        <CardContent>
          <div data-testid="map-canvas">
            <LeafletMap bbox={bbox} features={result} drawing={drawing} onBboxDrawn={onBboxDrawn} />
          </div>
          <p className="mt-2 text-xs text-gray-500">
            Basemap tiles &copy; OpenStreetMap contributors. The blue rectangle is the
            current query bounding box; green markers are returned features.
          </p>
        </CardContent>
      </Card>

      {result != null ? (
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">Render result</h2>
          </CardHeader>
          <CardContent>
            {imageSrc ? (
              <img
                data-testid="map-render-image"
                className="mb-4 w-full max-w-3xl rounded border"
                src={imageSrc}
                alt="Rendered map asset returned by /api/v1/render/map"
              />
            ) : null}
            <dl data-testid="map-result" className="grid grid-cols-2 gap-1 text-sm">
              {Object.entries(flattenResult(result)).map(([k, v]) => (
                <React.Fragment key={k}>
                  <dt className="text-gray-500">{k}</dt>
                  <dd className="font-mono break-all">{v}</dd>
                </React.Fragment>
              ))}
            </dl>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}

/** Reduce a render envelope to a small displayable key/value summary. */
function flattenResult(result: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  const data = (result.data as Record<string, unknown>) ?? result;
  for (const key of ["transfer_mode", "job_id", "status"]) {
    if (result[key] != null) out[key] = String(result[key]);
  }
  for (const key of ["asset_id", "storage_path", "asset_url", "url", "width", "height", "crs"]) {
    if (data && data[key] != null) out[key] = String(data[key]);
  }
  if (Object.keys(out).length === 0) out.result = "rendered";
  return out;
}

function renderImageSrc(result: Record<string, unknown>): string | null {
  const data = (result.data as Record<string, unknown>) ?? result;
  const asset = data.asset && typeof data.asset === "object" ? data.asset as Record<string, unknown> : {};
  const reference = tryNormaliseAssetReference({
    storage_path: data.storage_path ?? asset.storage_path,
    url: data.asset_url ?? data.url ?? asset.asset_url ?? asset.url,
    content_type: data.content_type ?? asset.content_type,
  });
  return reference?.url ?? null;
}

function tileFor(lat: number, lon: number, z: number): { z: number; x: number; y: number } {
  const n = 2 ** z;
  const latRad = lat * Math.PI / 180;
  const x = Math.floor(((lon + 180) / 360) * n);
  const y = Math.floor((1 - Math.log(Math.tan(latRad) + 1 / Math.cos(latRad)) / Math.PI) / 2 * n);
  return { z, x, y };
}

function featureResultToGeojson(result: unknown): GeoJSON.FeatureCollection {
  const items = featureItems(result);
  return {
    type: "FeatureCollection",
    features: items.flatMap((item) => {
      const feature = item.feature && typeof item.feature === "object" ? item.feature as Record<string, unknown> : item;
      const geometry = feature.geometry;
      if (!geometry || typeof geometry !== "object") return [];
      const names = Array.isArray(feature.names) ? feature.names as Array<Record<string, unknown>> : [];
      const name = names.map((row) => row.value).find((value) => typeof value === "string");
      return [{
        type: "Feature",
        geometry,
        properties: {
          id: feature.feature_id,
          label: name,
          categories: feature.categories,
          distance_m: item.distance_m,
        },
      } as GeoJSON.Feature];
    }),
  };
}

function featureItems(result: unknown): Array<Record<string, unknown>> {
  const body = result && typeof result === "object" ? result as Record<string, unknown> : {};
  const data = body.data && typeof body.data === "object" ? body.data as Record<string, unknown> : body;
  const items = data.items;
  return Array.isArray(items) ? items.filter((item): item is Record<string, unknown> => item && typeof item === "object") : [];
}

function featureCollectionToRenderLayers(fc: GeoJSON.FeatureCollection): Array<Record<string, unknown>> {
  return fc.features.slice(0, 25).flatMap((feature) => {
    if (!feature.geometry) return [];
    const label = feature.properties && typeof feature.properties.label === "string" ? feature.properties.label : undefined;
    return [{
      type: feature.geometry.type === "Point" ? "point" : "annotation",
      geometry: feature.geometry,
      radius: 5,
      label,
    }];
  });
}
