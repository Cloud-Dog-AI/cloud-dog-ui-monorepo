// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0.

import * as React from "react";
import { Badge, Button, DataTable, createDataTableActionColumn, type DataColumn } from "@cloud-dog/ui";
import { useGeoState } from "../state/AppState";
import { JsonDetailDialog, PageHeader, StatusLine, useEntityList } from "../lib/ui";
import type { GeoProvider } from "../lib/api";

export function ProvidersPage() {
  const { api, appVersion } = useGeoState();
  const { rows, loading, error, reload } = useEntityList<GeoProvider>(() => api.listProviders(), [api]);
  const [detail, setDetail] = React.useState<GeoProvider | null>(null);

  const columns: DataColumn<GeoProvider>[] = [
    {
      id: "provider_id",
      header: "Provider",
      sortable: true,
      sortValue: (r) => r.provider_id ?? "",
      cell: (r) => (
        <button type="button" className="text-left font-medium text-primary underline-offset-2 hover:underline" onClick={() => setDetail(r)}>
          {r.provider_id}
        </button>
      ),
    },
    { id: "category", header: "Category", sortable: true, sortValue: (r) => String(r.category ?? ""), cell: (r) => String(r.category ?? "—") },
    {
      id: "enabled",
      header: "Enabled",
      sortable: true,
      sortValue: (r) => (r.enabled ? 1 : 0),
      cell: (r) => (r.enabled ? <Badge variant="default">enabled</Badge> : <Badge variant="secondary">disabled</Badge>),
    },
    {
      id: "credentialed",
      header: "Auth",
      cell: (r) => (r.requires_credentials ? "credential ref" : "keyless"),
    },
    createDataTableActionColumn<GeoProvider>((r) => [{ id: "view", label: "View", onClick: () => setDetail(r) }]),
  ];

  return (
    <div className="space-y-6" data-testid="page-providers">
      <PageHeader title="Providers" version={appVersion} description="Geospatial data providers (read-only). Credentials are stored as references and never shown in cleartext (PS-90).">
        <Button variant="secondary" size="sm" onClick={() => void reload()}>
          Refresh
        </Button>
      </PageHeader>
      <StatusLine loading={loading} error={error} />
      <DataTable columns={columns} rows={rows} getRowId={(r) => r.provider_id ?? ""} emptyMessage="No providers." pageSize={10} columnPickerEnabled tableId="geospatial-providers" />
      <JsonDetailDialog open={!!detail} onOpenChange={(o) => { if (!o) setDetail(null); }} label={`Provider ${detail?.provider_id ?? ""}`} data={detail ?? {}} />
    </div>
  );
}
