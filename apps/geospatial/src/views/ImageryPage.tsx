// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0.

import { QueryPanel } from "./_QueryPanel";

/** Imagery page — search keyless STAC imagery via geo_search_imagery
 * (geo.imagery.search). Readers (geo.viewer) get an inline 403. */
export function ImageryPage() {
  return (
    <QueryPanel
      title="Imagery"
      description="Search keyless STAC imagery catalogues (Sentinel-2 / Landsat) by bbox + date range (geo_search_imagery). Requires geo.imagery.search."
      submitLabel="Search Imagery"
      testId="imagery"
      fields={[
        { name: "bbox", label: "Bounding box (minLon,minLat,maxLon,maxLat)", placeholder: "13.37,52.51,13.39,52.53" },
        { name: "datetime", label: "Date range (ISO/ISO)", placeholder: "2024-06-01T00:00:00Z/2024-06-30T23:59:59Z" },
        { name: "collection", label: "Collection", placeholder: "sentinel-2-l2a" },
        { name: "max_cloud_cover", label: "Max cloud cover (%)", type: "number", defaultValue: "30" },
        { name: "limit", label: "Max scenes", type: "number", defaultValue: "10" },
      ]}
      run={(api, v) =>
        api.searchImagery({
          bbox: v.bbox ? v.bbox.split(",").map((n) => Number(n.trim())) : undefined,
          datetime: v.datetime || undefined,
          collection: v.collection || undefined,
          max_cloud_cover: v.max_cloud_cover ? Number(v.max_cloud_cover) : undefined,
          limit: v.limit ? Number(v.limit) : undefined,
        })
      }
    />
  );
}
