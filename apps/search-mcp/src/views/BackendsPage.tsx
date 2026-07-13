// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0
import * as React from "react";
import { Badge, Card, CardContent, CardHeader, DataTable, type DataColumn } from "@cloud-dog/ui";
import { PageHeader, StatusLine, useEntityList } from "../lib/ui";
import { useSearchState } from "../state/AppState";
import type { BackendRow } from "../lib/types";

const columns: DataColumn<BackendRow>[] = [
  { id: "name", header: "Backend", cell: (r) => r.name },
  { id: "tier", header: "Tier", cell: (r) => (r.tier != null ? `Tier ${r.tier}` : "—") },
  { id: "enabled", header: "Enabled", cell: (r) => (r.enabled ? "yes" : "no") },
  { id: "creds", header: "Credentials", cell: (r) => (r.requires_credentials ? "required" : "open") },
];

export function BackendsPage() {
  const { api } = useSearchState();
  const { rows, loading, error } = useEntityList<BackendRow>(async () => (await api.backends()).backends, []);
  return (
    <div className="space-y-4">
      <PageHeader title="Backends" description="Backend capability matrix — enabled, tier, quota and credentials." />
      <StatusLine loading={loading} error={error} />
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Capability matrix</h2></CardHeader>
        <CardContent>
          <DataTable columns={columns} rows={rows} getRowId={(r) => r.name} ariaLabel="Backends" emptyMessage="No backends enabled." />
          <p className="mt-2 text-sm text-muted-foreground"><Badge variant="secondary">{rows.length}</Badge> backends</p>
        </CardContent>
      </Card>
    </div>
  );
}
