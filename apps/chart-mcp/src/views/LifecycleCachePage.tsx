// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// FR1.40 page kind: Lifecycle / Cache. Role-visibility: chart.asset_admin+ (and chart.admin).
// Surfaces asset + session + job lifecycle state and cache-mode signals derived from
// the W28F-906 backend (`/api/assets`, `/api/sessions`, `/api/jobs`, `/api/config`).

import * as React from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  JsonExplorer,
  MetricCard,
  type DataColumn,
} from "@cloud-dog/ui";
import { useChartState } from "../state/AppState";
import { PageHeader, StatusLine, errMessage } from "../lib/ui";
import type { AssetMeta, Job, Session } from "../lib/types";

type LifecycleRow = Readonly<{
  kind: "asset" | "session" | "job";
  id: string;
  status: string;
  tenant_id?: string | null;
  created_at?: string | null;
  expires_at?: string | null;
}>;

function timeRemaining(expires_at?: string | null): string {
  if (!expires_at) return "—";
  const expiry = new Date(expires_at).getTime();
  if (!Number.isFinite(expiry)) return "—";
  const delta = expiry - Date.now();
  if (delta <= 0) return "expired";
  const mins = Math.round(delta / 60_000);
  if (mins < 60) return `${mins}m`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs}h`;
  return `${Math.round(hrs / 24)}d`;
}

export function LifecycleCachePage() {
  const { api, appVersion } = useChartState();
  const [rows, setRows] = React.useState<LifecycleRow[]>([]);
  const [cacheMode, setCacheMode] = React.useState<string | null>(null);
  const [config, setConfig] = React.useState<Record<string, unknown> | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    setStatus(null);
    try {
      const [assets, sessions, jobs, cfg] = await Promise.all([
        api.listAssets().catch(() => [] as AssetMeta[]),
        api.listSessions().catch(() => [] as Session[]),
        api.listJobs().catch(() => [] as Job[]),
        api.config().catch(() => ({} as Record<string, unknown>)),
      ]);
      const merged: LifecycleRow[] = [
        ...assets.map<LifecycleRow>((a) => ({
          kind: "asset",
          id: a.asset_id,
          status: (a as { status?: string }).status ?? "stored",
          tenant_id: a.tenant_id ?? null,
          created_at: a.created_at ?? null,
          expires_at: a.expires_at ?? null,
        })),
        ...sessions.map<LifecycleRow>((s) => ({
          kind: "session",
          id: s.session_id,
          status: s.status ?? "unknown",
          tenant_id: s.tenant_id ?? null,
          created_at: s.created_at ?? null,
          expires_at: s.expires_at ?? null,
        })),
        ...jobs.map<LifecycleRow>((j) => ({
          kind: "job",
          id: j.job_id,
          status: j.status ?? "unknown",
          tenant_id: (j as { tenant_id?: string }).tenant_id ?? null,
          created_at: j.created_at ?? j.submitted_at ?? null,
          expires_at: j.expires_at ?? null,
        })),
      ];
      setRows(merged);
      setConfig(cfg);
      const cm = cfg.cache_mode as string | undefined;
      setCacheMode(cm ?? null);
      setStatus(`Loaded ${assets.length} asset(s), ${sessions.length} session(s), ${jobs.length} job(s).`);
    } catch (e) {
      setError(errMessage(e, "Failed to load lifecycle data."));
    } finally {
      setLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  const columns: DataColumn<LifecycleRow>[] = [
    { id: "kind", header: "Kind", sortable: true, sortValue: (row) => row.kind, cell: (row) => <Badge>{row.kind}</Badge> },
    { id: "id", header: "ID", sortable: true, sortValue: (row) => row.id, cell: (row) => <code className="font-mono text-xs">{row.id}</code> },
    { id: "status", header: "Status", sortable: true, sortValue: (row) => row.status, cell: (row) => row.status },
    {
      id: "tenant_id",
      header: "Tenant",
      sortable: true,
      sortValue: (row) => row.tenant_id ?? "",
      cell: (row) => row.tenant_id || "—",
    },
    { id: "created_at", header: "Created", sortable: true, sortValue: (row) => row.created_at ?? "", cell: (row) => row.created_at || "—" },
    {
      id: "expires_at",
      header: "Expires",
      sortable: true,
      sortValue: (row) => row.expires_at ?? "",
      cell: (row) => (
        <span>
          {row.expires_at || "—"} <Badge variant="secondary">{timeRemaining(row.expires_at)}</Badge>
        </span>
      ),
    },
  ];

  const assetCount = rows.filter((r) => r.kind === "asset").length;
  const sessionCount = rows.filter((r) => r.kind === "session").length;
  const jobCount = rows.filter((r) => r.kind === "job").length;
  const expiredCount = rows.filter((r) => timeRemaining(r.expires_at) === "expired").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Lifecycle / Cache"
        version={appVersion}
        description="Active asset / session / job objects, lifecycle states, and effective cache-mode policy."
      >
        <Button size="sm" variant="secondary" onClick={() => void reload()}>
          Refresh
        </Button>
      </PageHeader>

      <StatusLine loading={loading} error={error} status={status} />

      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <MetricCard label="Assets" value={assetCount} />
        <MetricCard label="Sessions" value={sessionCount} />
        <MetricCard label="Jobs" value={jobCount} />
        <MetricCard label="Expired" value={expiredCount} tone={expiredCount > 0 ? "warning" : "success"} />
      </div>

      {cacheMode ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Cache policy</h2>
          </CardHeader>
          <CardContent>
            <p className="text-sm">Effective cache mode: <Badge>{cacheMode}</Badge></p>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Lifecycle objects</h2>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            rows={rows}
            getRowId={(row) => `${row.kind}:${row.id}`}
            emptyMessage="No lifecycle objects."
            pageSize={50}
            tableId="chart-mcp-lifecycle-cache"
          />
        </CardContent>
      </Card>

      {config ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Cache-relevant config</h2>
          </CardHeader>
          <CardContent>
            <JsonExplorer data={config} title="Service config" />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
