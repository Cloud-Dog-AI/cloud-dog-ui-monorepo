// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0
//
// W28K-1422 — Dashboard (W28E-1837 / CX-180: DashboardLayout canonical;
// body-level HealthWidget removed — service status lives in shell ServiceStatusBar only).

import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  DataTable,
  MetricCard,
  QuickActionBar,
  RelativeTime,
  StatusBadge,
  type DataColumn,
} from "@cloud-dog/ui";
import { DashboardLayout } from "@cloud-dog/shell";
import { useAppState } from "../state/AppState";
import { ErrorBanner } from "../lib/ui";
import type { ScheduleRunDto } from "../lib/types";

export function DashboardPage() {
  const navigate = useNavigate();
  const { api } = useAppState();
  const [counts, setCounts] = React.useState({ schedules: 0, chains: 0, runs: 0, registry: 0 });
  const [recent, setRecent] = React.useState<ScheduleRunDto[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const [s, c, r, reg] = await Promise.all([
        api.listSchedules().catch(() => ({ items: [], count: 0 } as any)),
        api.listChains().catch(() => ({ items: [], count: 0 } as any)),
        api.listRuns().catch(() => ({ items: [], count: 0 } as any)),
        api.listRegistryProjects().catch(() => ({ items: [], count: 0 } as any)),
      ]);
      setCounts({
        schedules: Number(s?.count ?? 0),
        chains: Number(c?.count ?? 0),
        runs: Number(r?.count ?? 0),
        registry: Number(reg?.count ?? 0),
      });
      // PS-77 §CW-T3 default sort: scheduled_for desc — take first 5.
      const runs = Array.isArray(r?.items) ? [...r.items] : [];
      runs.sort((a: ScheduleRunDto, b: ScheduleRunDto) =>
        String(b.scheduled_for ?? "").localeCompare(String(a.scheduled_for ?? "")),
      );
      setRecent(runs.slice(0, 5));
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }, [api]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    load().finally(() => {
      if (!cancelled) setLoading(false);
    });
    return () => { cancelled = true; };
  }, [load]);

  const recentColumns: DataColumn<ScheduleRunDto>[] = React.useMemo(() => [
    { id: "run_id", header: "Run ID", cell: (r) => <code className="text-xs">{r.schedule_run_id}</code> },
    { id: "schedule", header: "Schedule", cell: (r) => <code className="text-xs">{r.schedule_id}</code> },
    { id: "status", header: "Status", cell: (r) => r.status ? <StatusBadge value={r.status} /> : "—" },
    { id: "scheduled", header: "Scheduled for", cell: (r) => r.scheduled_for ? <RelativeTime timestamp={r.scheduled_for} /> : "—" },
  ], []);

  if (loading) {
    return (
      <div role="status" className="flex min-h-[40vh] items-center gap-2 text-sm text-muted-foreground">
        Loading dashboard...
      </div>
    );
  }

  return (
    <div data-testid="scheduler-dashboard-page">
      <div className="flex flex-wrap items-center gap-3 px-4 pt-4">
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <button
          type="button"
          className="rounded border px-3 py-1 text-sm"
          onClick={() => void load()}
        >
          Refresh
        </button>
      </div>
      {error ? <ErrorBanner error={error} /> : null}
      {/* W28E-1837 / CX-180: canonical DashboardLayout — metricCards + quickActions + recentActivity.
          Body-level HealthWidget removed; service status is shell-level only (ServiceStatusBar in App.tsx). */}
      <DashboardLayout
        metricCards={
          <>
            <MetricCard label="Schedules" value={counts.schedules} />
            <MetricCard label="Chains" value={counts.chains} />
            <MetricCard label="Runs" value={counts.runs} />
            <MetricCard label="Registry" value={counts.registry} />
          </>
        }
        quickActions={
          <QuickActionBar
            actions={[
              { label: "New schedule", onClick: () => navigate("/schedules") },
              { label: "New chain", onClick: () => navigate("/chains") },
              { label: "Browse runs", onClick: () => navigate("/runs"), variant: "outline" },
              { label: "View audit", onClick: () => navigate("/audit-log"), variant: "outline" },
            ]}
          />
        }
        recentActivity={
          <section aria-label="Recent runs" data-testid="dashboard-recent-runs">
            <h2 className="mb-2 text-sm font-semibold tracking-wide text-muted-foreground">RECENT RUNS</h2>
            <DataTable<ScheduleRunDto>
              columns={recentColumns}
              rows={recent}
              totalRows={recent.length}
              getRowId={(r) => r.schedule_run_id}
              tableId="scheduler-dashboard-recent"
              emptyMessage="No runs yet."
            />
          </section>
        }
      />
    </div>
  );
}
