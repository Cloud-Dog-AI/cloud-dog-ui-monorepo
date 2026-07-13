// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0.

// @cloud-dog/app-geospatial — Canonical DashboardLayout wrapper (W28E-1837 / CX-180).

import * as React from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout, VersionInfo } from "@cloud-dog/shell";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  MetricCard,
  QuickActionBar,
  Spinner,
  type QuickAction,
} from "@cloud-dog/ui";
import { useGeoState } from "../state/AppState";

type Counts = { profiles: number; sessions: number; providers: number; assets: number; jobs: number };

export function DashboardPage() {
  const { api, appVersion } = useGeoState();
  const navigate = useNavigate();
  const [counts, setCounts] = React.useState<Counts | null>(null);
  const [health, setHealth] = React.useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    let isInitial = false;
    setLoading((prev) => { if (prev) isInitial = true; return true; });
    try {
      const [profiles, sessions, providers, assets, jobs, h] = await Promise.all([
        api.listProfiles().catch(() => []),
        api.listSessions().catch(() => []),
        api.listProviders().catch(() => []),
        api.listAssets().catch(() => []),
        api.listJobs().catch(() => []),
        api.health().catch(() => ({})),
      ]);
      setCounts({ profiles: profiles.length, sessions: sessions.length, providers: providers.length, assets: assets.length, jobs: jobs.length });
      setHealth(h);
      void isInitial;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load dashboard.");
    } finally {
      setLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  // W28E-1837 / CX-180: QuickActionBar uses real route paths from App.tsx — no invented routes.
  const quickActions: QuickAction[] = [
    { label: "Map", onClick: () => navigate("/map") },
    { label: "Geocode", onClick: () => navigate("/geocode") },
    { label: "Features", onClick: () => navigate("/features") },
    { label: "Imagery", onClick: () => navigate("/imagery") },
    { label: "Profiles", onClick: () => navigate("/profiles") },
    { label: "Sessions", onClick: () => navigate("/sessions") },
    { label: "Providers", onClick: () => navigate("/providers") },
    { label: "Assets", onClick: () => navigate("/assets") },
    { label: "Reports", onClick: () => navigate("/reports") },
  ];

  if (loading) {
    return (
      <div
        className="flex min-h-[40vh] items-center gap-2 text-sm text-muted-foreground"
        role="status"
        aria-live="polite"
      >
        <Spinner className="h-5 w-5" />
        Loading dashboard…
      </div>
    );
  }

  return (
    <div className="space-y-6" data-testid="page-dashboard">
      {/* W28E-1837: canonical h1 + version + Refresh control. */}
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Dashboard</h1>
          <VersionInfo version={appVersion} />
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Geospatial MCP — service overview across profiles, sessions, providers, assets and jobs.
        </p>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      {/* W28E-1837 / CX-180: canonical DashboardLayout.
          CX-180: ServiceStatusBar is rendered by App.tsx at shell level — MUST NOT appear here.
          healthWidgets prop is intentionally omitted (deprecated). */}
      <DashboardLayout
        metricCards={
          <>
            <MetricCard label="Profiles" value={String(counts?.profiles ?? "—")} />
            <MetricCard label="Sessions" value={String(counts?.sessions ?? "—")} />
            <MetricCard label="Providers" value={String(counts?.providers ?? "—")} />
            <MetricCard label="Assets" value={String(counts?.assets ?? "—")} />
            <MetricCard label="Jobs" value={String(counts?.jobs ?? "—")} />
          </>
        }
        quickActions={<QuickActionBar actions={quickActions} />}
      >
        {/* Service health JSON explorer — domain extension slot (children). */}
        <Card>
          <CardHeader>
            <h2 className="text-sm font-semibold">Service health</h2>
          </CardHeader>
          <CardContent>
            <pre
              tabIndex={0}
              role="region"
              aria-label="Service health JSON"
              className="overflow-auto rounded bg-muted p-3 text-xs"
              data-testid="dashboard-health"
            >
              {JSON.stringify(health ?? {}, null, 2)}
            </pre>
          </CardContent>
        </Card>
      </DashboardLayout>
    </div>
  );
}
