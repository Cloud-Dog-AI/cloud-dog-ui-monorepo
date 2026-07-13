// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0.

import { QueryPanel } from "./_QueryPanel";

/** Features page — search persisted features or discover live open-provider
 * features near a coordinate via geo_search_features / geo_discover_features
 * (geo.feature.search). Readers (geo.viewer) get an inline 403. */
export function FeaturesPage() {
  return (
    <QueryPanel
      title="Features"
      description="Search persisted features or discover open-provider features near a point. Requires geo.feature.search."
      submitLabel="Search Features"
      testId="features"
      fields={[
        { name: "query", label: "Feature selector key", placeholder: "amenity" },
        { name: "lat", label: "Latitude", type: "number", placeholder: "51.5074" },
        { name: "lon", label: "Longitude", type: "number", placeholder: "-0.1278" },
        { name: "radius_m", label: "Radius (m)", type: "number", defaultValue: "1000" },
      ]}
      run={(api, v) => {
        const lat = v.lat ? Number(v.lat) : undefined;
        const lon = v.lon ? Number(v.lon) : undefined;
        const radius = v.radius_m ? Number(v.radius_m) : undefined;
        if (lat !== undefined && lon !== undefined) {
          return api.discoverFeatures({
            lat,
            lon,
            radius_m: radius,
            selectors: v.query ? [v.query] : ["amenity"],
            limit: 25,
          });
        }
        return api.searchFeatures({
          query: v.query || undefined,
          radius_m: radius,
        });
      }}
    />
  );
}
