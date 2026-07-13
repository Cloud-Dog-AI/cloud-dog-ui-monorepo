// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0

import * as React from "react";
import { Button, DataTable, StatusBadge, type DataColumn } from "@cloud-dog/ui";
import { useSbomState } from "../state/AppState";
import { PageHeader, StatusLine, useEntityList } from "../lib/ui";
import type { ScheduledScan } from "../lib/types";

const COLUMNS: DataColumn<ScheduledScan>[] = [
  { id: "name", header: "Name", sortable: true, sortValue: (r) => r.name, cell: (r) => r.name },
  {
    id: "description",
    header: "Description",
    sortable: true,
    sortValue: (r) => r.description ?? "",
    cell: (r) =>
      r.description ? (
        <span data-testid="scheduled-description">{r.description}</span>
      ) : (
        "—"
      ),
  },
  { id: "boundary", header: "Boundary", sortable: true, sortValue: (r) => r.boundary, cell: (r) => r.boundary },
  { id: "target", header: "Target", sortable: true, sortValue: (r) => r.target, cell: (r) => <span className="font-mono text-xs">{r.target}</span> },
  { id: "schedule", header: "Schedule", sortable: true, sortValue: (r) => r.schedule, cell: (r) => <code className="text-xs">{r.schedule}</code> },
  {
    id: "enabled",
    header: "Enabled",
    sortable: true,
    sortValue: (r) => (r.enabled ? "1" : "0"),
    cell: (r) => <StatusBadge value={r.enabled ? "enabled" : "disabled"} />,
  },
  { id: "next_run_at", header: "Next run", sortable: true, sortValue: (r) => r.next_run_at ?? "", cell: (r) => r.next_run_at ?? "—" },
  {
    id: "last_status",
    header: "Last",
    sortable: true,
    sortValue: (r) => r.last_status ?? "",
    cell: (r) => (r.last_status ? <StatusBadge value={r.last_status} /> : "—"),
  },
];

export function ScheduledScansPage() {
  const { api, appVersion } = useSbomState();
  const { rows, loading, error, reload } = useEntityList<ScheduledScan>(
    () => api.listScheduled(100),
    [api]
  );

  return (
    <div className="space-y-6">
      <PageHeader
        title="Scheduled Scans"
        version={appVersion}
        description="Recurring and future-dated scans (W28L-1519)."
      >
        <Button variant="secondary" size="sm" onClick={() => void reload()}>
          Refresh
        </Button>
      </PageHeader>
      <StatusLine loading={loading} error={error} />
      <DataTable
        columns={COLUMNS}
        rows={rows}
        getRowId={(r) => r.scheduled_scan_id}
        emptyMessage="No scheduled scans yet."
        pageSize={25}
        columnPickerEnabled
        tableId="sbom-mcp-scheduled"
      />
    </div>
  );
}
