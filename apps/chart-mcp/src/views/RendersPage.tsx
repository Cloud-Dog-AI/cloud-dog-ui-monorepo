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

import * as React from "react";
import {
  Button,
  DataTable,
  RelativeTime,
  StatusBadge,
  createDataTableActionColumn,
  type DataColumn,
} from "@cloud-dog/ui";
import { useChartState } from "../state/AppState";
import { JsonDetailDialog, PageHeader, StatusLine, downloadTransfer, errMessage, useEntityList } from "../lib/ui";
import type { RenderManifest } from "../lib/types";

export function RendersPage() {
  const { api, appVersion } = useChartState();
  const { rows, loading, error, reload } = useEntityList<RenderManifest>(() => api.listRenders(), [api]);
  const [detail, setDetail] = React.useState<RenderManifest | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);

  const firstAssetId = (render: RenderManifest): string | undefined => render.assets?.[0]?.asset_id;

  const download = async (render: RenderManifest) => {
    const assetId = firstAssetId(render);
    if (!assetId) {
      setStatus(`Render ${render.manifest_id} has no downloadable asset.`);
      return;
    }
    const transfer = await api.getAssetTransfer(assetId);
    downloadTransfer(transfer);
    setStatus(`Downloaded asset ${assetId} for render ${render.manifest_id}.`);
  };

  const columns: DataColumn<RenderManifest>[] = [
    {
      id: "manifest_id",
      header: "Render",
      sortable: true,
      sortValue: (row) => row.manifest_id,
      cell: (row) => (
        <button type="button" className="text-left font-mono text-sm text-primary hover:underline" onClick={() => setDetail(row)}>
          {row.manifest_id}
        </button>
      ),
    },
    { id: "chart_type", header: "Chart Type", sortable: true, sortValue: (row) => row.chart_type ?? "", cell: (row) => row.chart_type || "—" },
    { id: "renderer", header: "Renderer", sortable: true, sortValue: (row) => row.renderer ?? "", cell: (row) => row.renderer || "—" },
    {
      id: "status",
      header: "Status",
      sortable: true,
      sortValue: (row) => row.status ?? "",
      cell: (row) => <StatusBadge value={row.status ?? "completed"} />,
    },
    {
      id: "assets",
      header: "Assets",
      sortable: true,
      sortValue: (row) => row.assets?.length ?? 0,
      cell: (row) => `${row.assets?.length ?? 0}`,
    },
    {
      id: "created",
      header: "Created",
      sortable: true,
      sortValue: (row) => row.created_at ?? "",
      cell: (row) => (row.created_at ? <RelativeTime timestamp={row.created_at} /> : "—"),
    },
    createDataTableActionColumn<RenderManifest>((row) => [
      { id: "view", label: "View", onClick: () => setDetail(row) },
      {
        id: "download",
        label: "Download Asset",
        disabled: () => !firstAssetId(row),
        onClick: () => void download(row).catch((e) => setStatus(errMessage(e, "Download failed."))),
      },
      {
        id: "audit",
        label: "Audit Log",
        href: () => `/audit-log?query=render:${encodeURIComponent(row.manifest_id)}`,
        title: () => `View Audit Log for render ${row.manifest_id}`,
      },
    ]),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Renders" version={appVersion} description="Render manifests capture renderer, style, locale and deterministic hashes for reproducibility.">
        <Button variant="secondary" size="sm" onClick={() => void reload()}>
          Refresh
        </Button>
      </PageHeader>

      <StatusLine loading={loading} error={error} status={status} />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.manifest_id}
        emptyMessage="No renders yet. Use Recommendations to create one."
        pageSize={10}
        columnPickerEnabled
        tableId="chart-mcp-renders"
      />

      <JsonDetailDialog
        open={!!detail}
        onOpenChange={(open) => { if (!open) setDetail(null); }}
        label={`Render ${detail?.manifest_id ?? ""}`}
        data={detail ?? {}}
        extra={
          detail ? (
            <div className="flex flex-wrap items-center gap-2 text-sm">
              <span className="text-muted-foreground">Status:</span>
              <StatusBadge value={detail.status ?? "completed"} />
              {firstAssetId(detail) ? (
                <Button size="sm" variant="secondary" onClick={() => void download(detail).catch((e) => setStatus(errMessage(e, "Download failed.")))}>
                  Download Asset
                </Button>
              ) : null}
            </div>
          ) : undefined
        }
      />
    </div>
  );
}
