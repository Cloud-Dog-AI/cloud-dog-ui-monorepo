// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0
import * as React from "react";
import { Button, DataTable, StatusBadge, type DataColumn } from "@cloud-dog/ui";
import { useSearchState } from "../state/AppState";
import { PageHeader, StatusLine, errMessage } from "../lib/ui";
import type { JobRow } from "../lib/types";

const cols: DataColumn<JobRow>[] = [
  { id: "id", header: "Job ID", sortable: true, sortValue: (r) => String(r.job_id ?? r.id ?? ""), cell: (r) => <span className="font-mono text-xs">{String(r.job_id ?? r.id ?? "—")}</span> },
  { id: "type", header: "Type", sortable: true, sortValue: (r) => String(r.type ?? ""), cell: (r) => String(r.type ?? "research") },
  { id: "status", header: "Status", sortable: true, sortValue: (r) => String(r.status ?? ""), cell: (r) => <StatusBadge value={String(r.status ?? "unknown")} /> },
  { id: "created", header: "Created", sortable: true, sortValue: (r) => String(r.created_at ?? ""), cell: (r) => <span className="text-xs text-muted-foreground">{String(r.created_at ?? "—")}</span> },
];

export function JobsPage() {
  const { api, appVersion } = useSearchState();
  const [rows, setRows] = React.useState<JobRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const load = React.useCallback(async () => {
    setLoading(true); setError(null);
    try { const d = await api.jobs(); setRows(d.items ?? d.jobs ?? []); }
    catch (e) { setError(errMessage(e, "Failed to load jobs.")); }
    finally { setLoading(false); }
  }, [api]);
  React.useEffect(() => { void load(); }, [load]);
  return (
    <div className="space-y-6">
      <PageHeader title="Jobs" version={appVersion} description="AJOBS async-job browser — research and watch jobs with canonical lifecycle states.">
        <Button variant="secondary" size="sm" onClick={() => void load()}>Refresh</Button>
      </PageHeader>
      <StatusLine loading={loading} error={error} />
      <DataTable columns={cols} rows={rows} getRowId={(r) => String(r.job_id ?? r.id ?? Math.random())}
        emptyMessage="No jobs in the queue." pageSize={25} columnPickerEnabled tableId="search-mcp-jobs" />
    </div>
  );
}
