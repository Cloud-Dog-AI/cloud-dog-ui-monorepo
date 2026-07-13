// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0

// W28E-1837 / CX-180: canonical DashboardLayout adoption for sbom-mcp
// (snag W28E-1831-SNAG-0026). DashboardLayout + MetricCard from shared
// packages; no body-level ServiceStatusBar / healthWidgets.

import * as React from "react";
import { useNavigate } from "react-router-dom";
import { DashboardLayout, VersionInfo } from "@cloud-dog/shell";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  MetricCard,
  QuickActionBar,
  Spinner,
  type DataColumn,
} from "@cloud-dog/ui";
import { useSbomState } from "../state/AppState";
import { errMessage } from "../lib/ui";
import type { CapabilitiesResponse, ScanListItem, ScanListResponse } from "../lib/types";

// ---------------------------------------------------------------------------
// DataTable columns — built from real ScanListItem fields (types.ts).
// ---------------------------------------------------------------------------
const scanColumns: DataColumn<ScanListItem>[] = [
  {
    id: "scan_id",
    header: "Scan ID",
    cell: (row) => <span className="font-mono text-xs">{row.scan_id}</span>,
    sortable: true,
    sortValue: (row) => row.scan_id,
  },
  {
    id: "status",
    header: "Status",
    cell: (row) => row.status,
    sortable: true,
    sortValue: (row) => row.status,
  },
  {
    id: "verdict",
    header: "Verdict",
    cell: (row) => row.verdict ?? "—",
    sortable: true,
    sortValue: (row) => row.verdict ?? "",
  },
  {
    id: "boundary",
    header: "Boundary",
    cell: (row) => row.boundary,
    sortable: true,
    sortValue: (row) => row.boundary,
  },
  {
    id: "target_type",
    header: "Target Type",
    cell: (row) => row.target_type,
    sortable: true,
    sortValue: (row) => row.target_type,
  },
  {
    id: "target",
    header: "Target",
    cell: (row) => <span className="font-mono text-xs break-all">{row.target}</span>,
    sortable: true,
    sortValue: (row) => row.target,
  },
  {
    id: "created_at",
    header: "Created",
    cell: (row) => <span className="font-mono text-xs">{formatLocalTimestamp(row.created_at)}</span>,
    sortable: true,
    sortValue: (row) => row.created_at,
  },
];

function formatLocalTimestamp(value?: string): string {
  if (!value) return "—";
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return value;
  return parsed.toLocaleString();
}

// ---------------------------------------------------------------------------
// DashboardPage
// ---------------------------------------------------------------------------
export function DashboardPage() {
  const { api, appVersion } = useSbomState();
  const navigate = useNavigate();
  const [caps, setCaps] = React.useState<CapabilitiesResponse | null>(null);
  const [scans, setScans] = React.useState<ScanListResponse | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const [c, s] = await Promise.all([api.capabilities(), api.listScans(10)]);
      setCaps(c);
      setScans(s);
    } catch (e) {
      setError(errMessage(e, "Failed to load dashboard."));
    } finally {
      setLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [c, s] = await Promise.all([api.capabilities(), api.listScans(10)]);
        if (!cancelled) {
          setCaps(c);
          setScans(s);
        }
      } catch (e) {
        if (!cancelled) setError(errMessage(e, "Failed to load dashboard."));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [api]);

  const recent = scans?.items ?? [];
  const queued = recent.filter((s) => s.status === "queued" || s.status === "running").length;
  const failed = recent.filter((s) => s.verdict === "FAIL" || s.status === "completed_fail").length;
  const passed = recent.filter((s) => s.verdict === "PASS" || s.status === "completed_pass").length;

  return (
    <div className="space-y-6">
      {/* Header: single h1 + version + refresh */}
      <header className="space-y-1">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">SBOM MCP</h1>
          <VersionInfo version={appVersion} />
          <Button type="button" variant="secondary" size="sm" onClick={() => void load()}>
            Refresh
          </Button>
        </div>
        <p className="text-sm text-muted-foreground">
          Scan submission, verdict review, and capability overview.
        </p>
      </header>

      {/* Loading indicator — role="status" required (CX-180 / W28E-1837) */}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
          <Spinner className="h-4 w-4" /> Loading…
        </div>
      ) : null}

      {/* Error banner — role="alert" required */}
      {error ? (
        <div className="rounded border border-rose-300 bg-rose-50 p-2 text-sm text-rose-700" role="alert">
          {error}
        </div>
      ) : null}

      {/* W28E-1837 / STD-F02: canonical DashboardLayout
          CX-180: NO healthWidgets / ServiceStatusBar in body. */}
      <DashboardLayout
        metricCards={
          <>
            <MetricCard
              data-testid="kpi-total"
              label="Scans (last 10)"
              value={recent.length}
            />
            <MetricCard
              data-testid="kpi-queued"
              label="In flight"
              value={queued}
            />
            <MetricCard
              data-testid="kpi-pass"
              label="PASS"
              value={passed}
              tone="success"
            />
            <MetricCard
              data-testid="kpi-fail"
              label="FAIL"
              value={failed}
              tone="danger"
            />
          </>
        }
        quickActions={
          <QuickActionBar
            actions={[
              {
                label: "Submit Scan",
                onClick: () => void navigate("/scans/new"),
              },
              {
                label: "Scan History",
                onClick: () => void navigate("/scans"),
              },
              {
                label: "Report Files",
                onClick: () => void navigate("/report-files"),
              },
            ]}
          />
        }
        recentActivity={
          <DataTable
            columns={scanColumns}
            rows={recent}
            getRowId={(row: ScanListItem) => row.scan_id}
            emptyMessage="No recent scans recorded."
            ariaLabel="Recent scans"
          />
        }
      >
        {/* Service-extension slot: Scanner + Capabilities detail cards (NO-LOSS). */}
        <div className="grid gap-4 md:grid-cols-2">
          <Card data-testid="card-scanner">
            <CardHeader>
              <h2 className="text-lg font-semibold">Scanner</h2>
            </CardHeader>
            <CardContent className="text-sm">
              <div>
                <span className="text-muted-foreground">Container:</span>{" "}
                <code>{caps?.scanner.container ?? "…"}</code>
              </div>
              <div>
                <span className="text-muted-foreground">Entrypoint:</span>{" "}
                <code>{caps?.scanner.entrypoint ?? "…"}</code>
              </div>
              <div>
                <span className="text-muted-foreground">Service version:</span>{" "}
                <code>{caps?.version ?? "…"}</code>
              </div>
            </CardContent>
          </Card>
          <Card data-testid="card-caps">
            <CardHeader>
              <h2 className="text-lg font-semibold">Capabilities</h2>
            </CardHeader>
            <CardContent>
              <ul className="list-inside list-disc text-sm">
                <li>Target types: {caps?.target_types.join(", ") ?? "…"}</li>
                <li>Storage backends: {caps?.storage_backends.join(", ") ?? "…"}</li>
                <li>Roles: {caps?.roles.length ?? "…"}</li>
                <li>Permissions: {caps?.permissions.length ?? "…"}</li>
              </ul>
            </CardContent>
          </Card>
        </div>
      </DashboardLayout>
    </div>
  );
}
