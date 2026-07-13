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

// FR1.40 page kind: Licence Status (renderer policy / FR1.4 / FR1.5).
// Role-visibility: chart.renderer_admin+ (and chart.admin / chart.auditor).
// Surfaces every renderer's licence_class + offline-approved status from /api/renderers,
// plus blocked-reason details. No bespoke table — uses shared DataTable.

import * as React from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  MetricCard,
  StatusBadge,
  type DataColumn,
} from "@cloud-dog/ui";
import { useChartState } from "../state/AppState";
import { JsonDetailDialog, PageHeader, StatusLine, errMessage, useEntityList } from "../lib/ui";
import type { RendererDetail } from "../lib/types";

type LicenceRow = Readonly<{
  renderer_id: string;
  state: "allowed" | "blocked";
  licence_class: string;
  offline: boolean;
  network: boolean;
  reason: string;
  detail: RendererDetail;
}>;

export function LicenceStatusPage() {
  const { api, appVersion } = useChartState();
  const { rows, loading, error, reload } = useEntityList<LicenceRow>(async () => {
    const status = await api.listRenderers();
    const allowed = Object.entries(status.allowed ?? {}).map<LicenceRow>(([renderer_id, detail]) => ({
      renderer_id,
      state: "allowed",
      licence_class: detail.licence_class ?? "(unspecified)",
      offline: !!detail.approved_for_offline,
      network: !!detail.requires_network,
      reason: detail.reason ?? "",
      detail,
    }));
    const blocked = Object.entries(status.blocked ?? {}).map<LicenceRow>(([renderer_id, detail]) => ({
      renderer_id,
      state: "blocked",
      licence_class: detail.licence_class ?? "(unspecified)",
      offline: !!detail.approved_for_offline,
      network: !!detail.requires_network,
      reason: detail.reason ?? "licence-blocked",
      detail,
    }));
    return [...allowed, ...blocked];
  }, [api]);
  const [detail, setDetail] = React.useState<LicenceRow | null>(null);
  const [acceptError, setAcceptError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (error) setAcceptError(errMessage(error, "Failed to load renderer policy."));
  }, [error]);

  const columns: DataColumn<LicenceRow>[] = [
    {
      id: "renderer_id",
      header: "Renderer",
      sortable: true,
      sortValue: (row) => row.renderer_id,
      cell: (row) => (
        <button type="button" className="text-left font-medium text-primary hover:underline" onClick={() => setDetail(row)}>
          {row.renderer_id}
        </button>
      ),
    },
    {
      id: "state",
      header: "Policy",
      sortable: true,
      sortValue: (row) => row.state,
      cell: (row) => (
        <StatusBadge value={row.state === "allowed" ? "allowed" : "blocked"} tone={row.state === "allowed" ? "ok" : "error"} />
      ),
    },
    { id: "licence_class", header: "Licence Class", sortable: true, sortValue: (row) => row.licence_class, cell: (row) => row.licence_class },
    {
      id: "offline",
      header: "Offline",
      sortable: true,
      sortValue: (row) => (row.offline ? "yes" : "no"),
      cell: (row) => (row.offline ? <Badge>approved</Badge> : <Badge variant="secondary">no</Badge>),
    },
    {
      id: "network",
      header: "Network",
      sortable: true,
      sortValue: (row) => (row.network ? "yes" : "no"),
      cell: (row) => (row.network ? <Badge variant="secondary">requires</Badge> : <Badge>not required</Badge>),
    },
    {
      id: "reason",
      header: "Reason / Notes",
      cell: (row) => row.reason || <span className="text-muted-foreground">—</span>,
    },
  ];

  const allowedCount = rows.filter((r) => r.state === "allowed").length;
  const blockedCount = rows.length - allowedCount;
  const offlineApproved = rows.filter((r) => r.offline).length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Licence Status"
        version={appVersion}
        description="FR1.4 / FR1.5: which renderers are allowed by the licence policy and which are blocked / require network."
      >
        <Button size="sm" variant="secondary" onClick={() => void reload()}>
          Refresh
        </Button>
      </PageHeader>

      <StatusLine loading={loading} error={acceptError} />

      <div className="grid grid-cols-3 gap-4">
        <MetricCard label="Allowed" value={allowedCount} tone="success" />
        <MetricCard label="Blocked" value={blockedCount} tone={blockedCount > 0 ? "warning" : "success"} />
        <MetricCard label="Offline-approved" value={offlineApproved} />
      </div>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Renderer licence policy</h2>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            rows={rows}
            getRowId={(row) => row.renderer_id}
            emptyMessage="No renderers registered."
            pageSize={25}
            tableId="chart-mcp-licence-status"
          />
        </CardContent>
      </Card>

      <JsonDetailDialog
        open={!!detail}
        onOpenChange={(open) => { if (!open) setDetail(null); }}
        label={`Renderer ${detail?.renderer_id ?? ""}`}
        data={detail ? { renderer_id: detail.renderer_id, policy: detail.state, ...detail.detail } : {}}
      />
    </div>
  );
}
