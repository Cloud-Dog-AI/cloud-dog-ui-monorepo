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

// FR1.40 page kind: Style Selector. Role-visibility: chart.designer+.
// Picks a style pack from the W28F-906 /style-packs catalogue and binds it to workflow.style.

import * as React from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  JsonExplorer,
  type DataColumn,
} from "@cloud-dog/ui";
import { useNavigate } from "react-router-dom";
import { useChartState } from "../state/AppState";
import { JsonDetailDialog, PageHeader, StatusLine, useEntityList } from "../lib/ui";
import { useChartWorkflow } from "../state/ChartWorkflow";
import type { StylePack } from "../lib/types";

export function StyleSelectorPage() {
  const { api, appVersion } = useChartState();
  const navigate = useNavigate();
  const workflow = useChartWorkflow();
  const { rows, loading, error, reload } = useEntityList<StylePack>(() => api.listStylePacks(), [api]);
  const [detail, setDetail] = React.useState<StylePack | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);

  const select = (pack: StylePack) => {
    workflow.setStyle(pack.style_id);
    setStatus(`Style "${pack.name || pack.style_id}" selected.`);
  };

  const columns: DataColumn<StylePack>[] = [
    {
      id: "style_id",
      header: "Style",
      sortable: true,
      sortValue: (row) => row.style_id,
      cell: (row) => (
        <button type="button" className="text-left font-medium text-primary hover:underline" onClick={() => setDetail(row)}>
          {row.style_id}
        </button>
      ),
    },
    { id: "name", header: "Name", sortable: true, sortValue: (row) => row.name ?? "", cell: (row) => row.name || "—" },
    {
      id: "description",
      header: "Description",
      sortable: true,
      sortValue: (row) => row.description ?? "",
      cell: (row) => row.description || <span className="text-muted-foreground">—</span>,
    },
    {
      id: "select",
      header: "",
      cell: (row) => (
        <Button
          size="sm"
          variant={workflow.style === row.style_id ? "secondary" : "default"}
          onClick={() => select(row)}
          data-testid={`style-pick-${row.style_id}`}
        >
          {workflow.style === row.style_id ? "Selected" : "Use"}
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Style Selector"
        version={appVersion}
        description="Pick a style pack for the active workflow. The chosen style flows into ChartSpec.style and the renderer."
      >
        <Button size="sm" variant="secondary" onClick={() => void reload()}>
          Refresh
        </Button>
        <Button size="sm" variant="secondary" onClick={() => navigate("/style-packs")}>
          Manage Packs
        </Button>
      </PageHeader>

      <StatusLine loading={loading} error={error} status={status} />

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="text-lg font-semibold">Available style packs</h2>
            {workflow.style ? <Badge variant="secondary">current: {workflow.style}</Badge> : null}
          </div>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            rows={rows}
            getRowId={(row) => row.style_id}
            emptyMessage="No style packs registered."
            pageSize={25}
            tableId="chart-mcp-style-selector"
          />
        </CardContent>
      </Card>

      <JsonDetailDialog
        open={!!detail}
        onOpenChange={(open) => { if (!open) setDetail(null); }}
        label={`Style ${detail?.style_id ?? ""}`}
        data={detail ?? {}}
        extra={
          detail ? (
            <Button size="sm" onClick={() => { select(detail); setDetail(null); }}>
              Use this pack
            </Button>
          ) : undefined
        }
      />

      {workflow.style ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Selected style</h2>
          </CardHeader>
          <CardContent>
            <JsonExplorer data={{ style: workflow.style }} title="Workflow style" />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
