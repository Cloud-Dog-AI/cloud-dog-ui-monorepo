// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0.

import { QueryPanel } from "./_QueryPanel";

/** Geocode page — forward geocode via geo_geocode (geo.geocode.run). Readers
 * (geo.viewer) get an inline 403 (reader-cannot-geocode). */
export function GeocodePage() {
  return (
    <QueryPanel
      title="Geocode"
      description="Forward-geocode a place name to coordinates via keyless providers (geo_geocode). Requires geo.geocode.run."
      submitLabel="Geocode"
      testId="geocode"
      fields={[
        { name: "query", label: "Place / address", placeholder: "Trafalgar Square, London" },
        { name: "limit", label: "Max results", type: "number", defaultValue: "5" },
      ]}
      run={(api, v) => api.geocode({ query: v.query, limit: v.limit ? Number(v.limit) : undefined })}
    />
  );
}
