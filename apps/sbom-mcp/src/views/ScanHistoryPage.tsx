// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0

import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  SessionsHistoryPanel,
  StatusBadge,
  type SessionsHistoryAction,
  type SessionsHistoryRow,
  type DataColumn,
} from "@cloud-dog/ui";
import { useSbomState } from "../state/AppState";
import { useEntityList } from "../lib/ui";
import type { ScanListItem } from "../lib/types";

export function ScanHistoryPage() {
  const { api, appVersion } = useSbomState();
  const navigate = useNavigate();
  const { rows, loading, error, reload } = useEntityList<ScanListItem>(
    () => api.listScans(100),
    [api]
  );

  const panelRows = React.useMemo<SessionsHistoryRow[]>(() => rows.map((row) => ({
    id: row.scan_id,
    label: row.scan_id,
    title: <span className="font-mono">{row.scan_id}</span>,
    status: row.status,
    target: <span className="font-mono text-xs">{row.target}</span>,
    createdAt: row.created_at,
    lastActivityAt: row.finished_at ?? undefined,
    summary: `${row.boundary} ${row.target_type}`,
    details: [
      { label: "Job", value: row.job_id },
      { label: "Boundary", value: row.boundary },
      { label: "Type", value: row.target_type },
      { label: "Target", value: row.target },
      ...(row.verdict ? [{ label: "Verdict", value: <StatusBadge value={row.verdict} /> }] : []),
    ],
    relatedItems: [
      {
        id: `audit-${row.scan_id}`,
        label: "Audit Log",
        href: `/audit-log?query=scan:${encodeURIComponent(row.scan_id)}`,
      },
    ],
  })), [rows]);

  const domainColumns = React.useMemo<DataColumn<SessionsHistoryRow>[]>(() => [
    { id: "boundary", header: "Boundary", sortable: true, sortValue: (r) => String(r.details?.find((item) => item.label === "Boundary")?.value ?? ""), cell: (r) => r.details?.find((item) => item.label === "Boundary")?.value ?? "—" },
    { id: "target_type", header: "Type", sortable: true, sortValue: (r) => String(r.details?.find((item) => item.label === "Type")?.value ?? ""), cell: (r) => r.details?.find((item) => item.label === "Type")?.value ?? "—" },
    {
      id: "verdict",
      header: "Verdict",
      sortable: true,
      sortValue: (r) => String(r.details?.find((item) => item.label === "Verdict")?.value ?? ""),
      cell: (r) => r.details?.find((item) => item.label === "Verdict")?.value ?? <span className="text-muted-foreground">—</span>,
    },
  ], []);

  const actions = React.useMemo<SessionsHistoryAction[]>(() => [
      { id: "open", label: "Open", onClick: (row) => navigate(`/scans/${row.id}`) },
      {
        id: "audit",
        label: "Audit Log",
        href: (row) => `/audit-log?query=scan:${encodeURIComponent(row.id)}`,
        title: (row) => `View Audit Log for scan ${row.id}`,
      },
    ], [navigate]);

  return (
    <div className="space-y-6">
      <SessionsHistoryPanel
        title="Scan History"
        variant="scans"
        description={`Submitted scans visible to the caller.${appVersion ? ` Version ${appVersion}.` : ""}`}
        rows={panelRows}
        loading={loading}
        error={error}
        emptyMessage="No scans yet. Submit one via the Submit Scan page."
        canonicalRoute="/scans"
        onRefresh={() => void reload()}
        actions={actions}
        domainColumns={domainColumns}
        pageSize={25}
        tableId="sbom-mcp-scans"
      />
    </div>
  );
}
