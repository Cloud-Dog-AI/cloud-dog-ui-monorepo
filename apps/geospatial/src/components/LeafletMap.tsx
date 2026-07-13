// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0.

// GE-DEF-001 / GE-DEF-019: a REAL interactive map (Leaflet, BSD-2-Clause) —
// basemap tiles, a bbox draw tool, a query-result feature overlay, and a layer
// toggle — replacing the result-only JsonExplorer view. The map is keyboard
// navigable (Leaflet focuses the container; arrow keys pan, +/- zoom) and ARIA
// labelled. The pure bbox/feature helpers are exported for unit testing without
// a DOM-sized Leaflet instance.

import * as React from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { bboxToLeafletBounds, extractFeatures, type Bbox } from "../lib/bbox";

export type { Bbox } from "../lib/bbox";
export { parseBbox, formatBbox, bboxToLeafletBounds, bboxCenter, bboxAreaDeg2, extractFeatures } from "../lib/bbox";

const OSM_URL = "https://tile.openstreetmap.org/{z}/{x}/{y}.png";
const OSM_ATTR = "&copy; OpenStreetMap contributors";

export type LeafletMapProps = {
  bbox: Bbox | null;
  features?: unknown;
  drawing?: boolean;
  onBboxDrawn?: (bbox: Bbox) => void;
  height?: number;
  testId?: string;
};

/** Interactive Leaflet map. Renders a basemap, the current bbox rectangle, an
 * optional result-feature overlay, a layer toggle, and (when `drawing`) a
 * two-click bbox draw tool. Keyboard-navigable + ARIA-labelled (GE-DEF-019). */
export function LeafletMap(props: LeafletMapProps) {
  const { bbox, drawing, features, height, onBboxDrawn } = props;
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const mapRef = React.useRef<L.Map | null>(null);
  const bboxLayerRef = React.useRef<L.Rectangle | null>(null);
  const featureLayerRef = React.useRef<L.GeoJSON | null>(null);
  const overlayGroupRef = React.useRef<L.LayerGroup | null>(null);
  const drawCornerRef = React.useRef<L.LatLng | null>(null);
  const testId = props.testId ?? "leaflet-map";

  // One-time map init: basemap tile layer + an overlay group + a layer toggle.
  React.useEffect(() => {
    if (!containerRef.current || mapRef.current) return;
    const map = L.map(containerRef.current, { center: [51.5, -0.1], zoom: 6, keyboard: true });
    const basemap = L.tileLayer(OSM_URL, { attribution: OSM_ATTR, maxZoom: 19 });
    basemap.addTo(map);
    const overlay = L.layerGroup().addTo(map);
    L.control.layers({ "OpenStreetMap": basemap }, { "Query overlay": overlay }).addTo(map);
    overlayGroupRef.current = overlay;
    mapRef.current = map;
    // Keyboard affordance: the container is focusable; label it for AT.
    const el = containerRef.current;
    el.setAttribute("role", "application");
    el.setAttribute("aria-label", "Interactive geospatial map. Use arrow keys to pan, plus and minus to zoom.");
    el.setAttribute("tabindex", "0");
    return () => {
      map.remove();
      mapRef.current = null;
    };
  }, []);

  // Draw-tool: in drawing mode, two clicks define the bbox SW + NE corners.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    const handler = (e: L.LeafletMouseEvent) => {
      if (!drawing) return;
      if (!drawCornerRef.current) {
        drawCornerRef.current = e.latlng;
        return;
      }
      const a = drawCornerRef.current;
      const b = e.latlng;
      drawCornerRef.current = null;
      const bbox: Bbox = [
        Math.min(a.lng, b.lng), Math.min(a.lat, b.lat),
        Math.max(a.lng, b.lng), Math.max(a.lat, b.lat),
      ];
      onBboxDrawn?.(bbox);
    };
    map.on("click", handler);
    return () => {
      map.off("click", handler);
    };
  }, [drawing, onBboxDrawn]);

  // Redraw the bbox rectangle + fit bounds whenever the bbox changes.
  React.useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    if (bboxLayerRef.current) {
      bboxLayerRef.current.remove();
      bboxLayerRef.current = null;
    }
    if (bbox) {
      const bounds = bboxToLeafletBounds(bbox);
      const rect = L.rectangle(bounds, { color: "#2563eb", weight: 2, fillOpacity: 0.08 });
      rect.bindTooltip("Query bounding box");
      rect.addTo(map);
      bboxLayerRef.current = rect;
      try {
        map.fitBounds(bounds, { maxZoom: 12, padding: [20, 20] });
      } catch {
        /* jsdom / zero-size container — bounds set, no fit */
      }
    }
  }, [bbox]);

  // Overlay the result features whenever they change.
  React.useEffect(() => {
    const overlay = overlayGroupRef.current;
    if (!overlay) return;
    if (featureLayerRef.current) {
      featureLayerRef.current.remove();
      featureLayerRef.current = null;
    }
    const fc = extractFeatures(features);
    if (fc) {
      const layer = L.geoJSON(fc, {
        pointToLayer: (_f, latlng) => L.circleMarker(latlng, { radius: 6, color: "#16a34a" }),
      });
      layer.addTo(overlay);
      featureLayerRef.current = layer;
    }
  }, [features]);

  return (
    <div
      ref={containerRef}
      data-testid={testId}
      style={{ height: height ?? 480, width: "100%", borderRadius: 8 }}
    />
  );
}
