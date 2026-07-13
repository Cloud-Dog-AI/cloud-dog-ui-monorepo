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
  StatusBadge,
  createDataTableActionColumn,
  type DataColumn,
} from "@cloud-dog/ui";
import { useChartState } from "../state/AppState";
import { JsonDetailDialog, PageHeader, StatusLine, errMessage, useEntityList } from "../lib/ui";
import type { RendererDetail } from "../lib/types";

type RendererRow = Readonly<{
  renderer_id: string;
  state: "allowed" | "blocked";
  detail: RendererDetail;
}>;

const SAMPLE_DATA = { rows: [{ category: "A", value: 4 }, { category: "B", value: 7 }, { category: "C", value: 3 }] };

export function RendererHealthPage() {
  const { api, appVersion } = useChartState();
  const { rows, loading, error, reload } = useEntityList<RendererRow>(async () => {
    const status = await api.listRenderers();
    const allowed = Object.entries(status.allowed ?? {}).map(
      ([renderer_id, detail]) => ({ renderer_id, state: "allowed" as const, detail })
    );
    const blocked = Object.entries(status.blocked ?? {}).map(
      ([renderer_id, detail]) => ({ renderer_id, state: "blocked" as const, detail })
    );
    return [...allowed, ...blocked];
  }, [api]);
  const [detail, setDetail] = React.useState<RendererRow | null>(null);
  const [testing, setTesting] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);

  const testRender = async (renderer: RendererRow) => {
    setTesting(renderer.renderer_id);
    setStatus(null);
    try {
      const result = await api.render({
        data: SAMPLE_DATA,
        spec: {
          chart_type: "bar",
          x: "category",
          y: "value",
          title: `Test render — ${renderer.renderer_id}`,
          renderer: renderer.renderer_id,
          output_formats: ["svg"],
        },
      });
      const assets = (result as { assets?: unknown[] }).assets;
      setStatus(`Test render OK for ${renderer.renderer_id} (${Array.isArray(assets) ? assets.length : 0} asset(s)).`);
    } catch (e) {
      setStatus(`Test render FAILED for ${renderer.renderer_id}: ${errMessage(e, "render error")}`);
    } finally {
      setTesting(null);
    }
  };

  const columns: DataColumn<RendererRow>[] = [
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
      header: "Status",
      sortable: true,
      sortValue: (row) => (row.state === "allowed" ? "a" : "z"),
      // CW-DA8: blocked renderers render RED (error tone); allowed render green (ok).
      cell: (row) => <StatusBadge value={row.state === "allowed" ? "allowed" : "blocked"} tone={row.state === "allowed" ? "ok" : "error"} />,
    },
    {
      id: "licence",
      header: "Licence",
      sortable: true,
      sortValue: (row) => row.detail.licence_class ?? "",
      cell: (row) => row.detail.licence_class || "—",
    },
    {
      id: "offline",
      header: "Offline",
      cell: (row) => (row.detail.approved_for_offline ? "yes" : row.detail.requires_network ? "network" : "—"),
    },
    {
      id: "types",
      header: "Chart Types",
      cell: (row) => (row.detail.supported_chart_types?.slice(0, 4).join(", ") || "—"),
    },
    {
      id: "formats",
      header: "Formats",
      cell: (row) => (row.detail.supported_output_formats?.join(", ") || "—"),
    },
    createDataTableActionColumn<RendererRow>((row) => [
      { id: "view", label: "View", onClick: () => setDetail(row) },
      {
        id: "test",
        label: testing === row.renderer_id ? "Testing…" : "Test Render",
        disabled: () => row.state !== "allowed" || testing !== null,
        onClick: () => void testRender(row),
      },
    ]),
  ];

  return (
    <div className="space-y-6">
      <PageHeader title="Renderer Health" version={appVersion} description="Licence-gated renderer registry — allowed, blocked, capabilities, and live test renders.">
        <Button variant="secondary" size="sm" onClick={() => void reload()}>
          Refresh
        </Button>
      </PageHeader>

      <StatusLine loading={loading} error={error} status={status} />

      <DataTable
        columns={columns}
        rows={rows}
        getRowId={(row) => row.renderer_id}
        emptyMessage="No renderers registered."
        pageSize={25}
        columnPickerEnabled
        tableId="chart-mcp-renderers"
      />

      <JsonDetailDialog
        open={!!detail}
        onOpenChange={(open) => { if (!open) setDetail(null); }}
        label={`Renderer ${detail?.renderer_id ?? ""}`}
        data={detail ? { renderer_id: detail.renderer_id, state: detail.state, ...detail.detail } : {}}
        extra={
          detail && detail.state === "allowed" ? (
            <Button size="sm" variant="secondary" disabled={testing !== null} onClick={() => void testRender(detail)}>
              {testing === detail.renderer_id ? "Testing…" : "Test Render"}
            </Button>
          ) : undefined
        }
      />
    </div>
  );
}
