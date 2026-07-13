// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0
import * as React from "react";
import { useNavigate } from "react-router-dom";
import { Button, DataTable, MetricCard, QuickActionBar, Spinner, type DataColumn } from "@cloud-dog/ui";
import { DashboardLayout, VersionInfo } from "@cloud-dog/shell";
import { useSearchState } from "../state/AppState";
import { errMessage } from "../lib/ui";
import type { BackendRow, ResearchReport } from "../lib/types";

const cols: DataColumn<ResearchReport>[] = [
  { id: "query", header: "Query", cell: (r) => String(r.query ?? "—") },
  { id: "status", header: "Status", cell: (r) => String(r.status ?? "—") },
  { id: "job", header: "Job", cell: (r) => String(r.job_id ?? "—") },
];

export function DashboardPage() {
  const { api, appVersion } = useSearchState();
  const navigate = useNavigate();
  const [backends, setBackends] = React.useState<BackendRow[]>([]);
  const [recent, setRecent] = React.useState<ResearchReport[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const [b, r] = await Promise.all([api.backends(), api.researchList(10)]);
      setBackends(b.backends); setRecent(r.items ?? r.jobs ?? []);
    } catch (e) { setError(errMessage(e, "Failed to load dashboard.")); }
    finally { setLoading(false); }
  }, [api]);
  React.useEffect(() => { setLoading(true); void load(); }, [load]);

  const enabled = backends.filter((b) => b.enabled).length;
  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <VersionInfo version={appVersion} />
        <Button variant="secondary" size="sm" onClick={() => void load()} disabled={loading}>Refresh</Button>
      </header>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {loading ? <div role="status" aria-live="polite" className="flex items-center gap-2 text-sm text-muted-foreground"><Spinner className="h-5 w-5" /> Loading dashboard…</div> : null}
      <DashboardLayout
        metricCards={<>
          <MetricCard label="Backends enabled" value={enabled} />
          <MetricCard label="Backends total" value={backends.length} />
          <MetricCard label="Recent reports" value={recent.length} />
        </>}
        quickActions={<QuickActionBar actions={[
          { label: "New research", onClick: () => navigate("/research") },
          { label: "Watches", onClick: () => navigate("/watches") },
          { label: "Backends", onClick: () => navigate("/backends") },
          { label: "Audit log", onClick: () => navigate("/audit-log") },
        ]} />}
        recentActivity={<DataTable columns={cols} rows={recent} getRowId={(r) => String(r.job_id ?? r.query ?? Math.random())}
          ariaLabel="Recent research" emptyMessage="No recent research in the audit log." />}
      />
    </div>
  );
}
