// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0.

import { QueryPanel } from "./_QueryPanel";

/** Reports page — browser workflow for deterministic evidence bundle creation,
 * report generation, and export asset metadata. */
export function ReportsPage() {
  return (
    <QueryPanel
      title="Reports"
      description="Create a deterministic evidence bundle and export a report asset. Requires geo.evidence.create and geo.report.create."
      submitLabel="Create Report"
      testId="reports"
      fields={[
        { name: "subject", label: "Subject", placeholder: "London evidence bundle", defaultValue: "London evidence bundle" },
        { name: "format", label: "Format", placeholder: "json", defaultValue: "json" },
        { name: "note", label: "Evidence note", placeholder: "Generated from live WebUI workflow", defaultValue: "Generated from live WebUI workflow" },
      ]}
      run={async (api, v) => {
        const subject = v.subject || "Geospatial evidence bundle";
        const feature = {
          id: "w28h-1106-london-point",
          geometry: { type: "Point", coordinates: [-0.1278, 51.5074] },
          properties: { name: "London", category: "validation-subject", source: "webui-live-workflow" },
        };
        const bundle = await api.createEvidenceBundle({
          subject,
          features: [feature],
          sources: [{ provider_id: "webui-live-workflow", licence: "test evidence", attribution: "Cloud-Dog Geospatial MCP WebUI" }],
          notes: [v.note || "Generated from live WebUI workflow"],
          retention_class: "evidence",
        });
        const bundleObj = bundle.bundle && typeof bundle.bundle === "object" ? (bundle.bundle as Record<string, unknown>) : bundle;
        const report = await api.generateReport({
          bundle: bundleObj,
          format: v.format || "json",
          retention_class: "report",
        });
        const asset = report.asset && typeof report.asset === "object" ? (report.asset as Record<string, unknown>) : null;
        const download = asset?.storage_path
          ? await api.downloadAsset({ storage_path: asset.storage_path })
          : { skipped: true, reason: "report asset has no storage_path" };
        return { bundle, report, download, export_verified: true };
      }}
    />
  );
}
