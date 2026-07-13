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

// FR1.40 page kind: Data Preview. Role-visibility: chart.operator+.
// Renders the captured workflow rows + columns + Recommend/Validate hooks (W28F-930 endpoints).

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
import { PageHeader, StatusLine, errMessage } from "../lib/ui";
import { useChartWorkflow } from "../state/ChartWorkflow";

type PreviewRow = Record<string, unknown> & { __row_id: string };

export function DataPreviewPage() {
  const { api, appVersion } = useChartState();
  const navigate = useNavigate();
  const workflow = useChartWorkflow();
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [validateResult, setValidateResult] = React.useState<Record<string, unknown> | null>(null);

  const previewRows: PreviewRow[] = React.useMemo(
    () =>
      workflow.rows.slice(0, 200).map((row, idx) => ({
        ...row,
        __row_id: `${idx}`,
      })),
    [workflow.rows]
  );

  const columns: DataColumn<PreviewRow>[] = React.useMemo(() => {
    return [
      { id: "__row_id", header: "#", cell: (row) => row.__row_id, sortable: true, sortValue: (row) => Number(row.__row_id) },
      ...workflow.columns.map<DataColumn<PreviewRow>>((col) => ({
        id: col,
        header: col,
        sortable: true,
        sortValue: (row) => {
          const value = row[col];
          if (value == null) return "";
          if (typeof value === "number") return value;
          return String(value);
        },
        cell: (row) => {
          const value = row[col];
          if (value == null) return <span className="text-muted-foreground">—</span>;
          if (typeof value === "object") return <code className="text-xs">{JSON.stringify(value)}</code>;
          return String(value);
        },
      })),
    ];
  }, [workflow.columns]);

  const recommend = async () => {
    if (!workflow.data) {
      setError("Capture data on the Data Input page first.");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const rec = await api.recommend(workflow.data.body);
      workflow.setRecommendation(rec);
      setStatus(`Recommended ${rec.chart_type ?? "chart"}.`);
    } catch (e) {
      setError(errMessage(e, "Recommend failed."));
    } finally {
      setBusy(false);
    }
  };

  const validate = async () => {
    if (!workflow.data) {
      setError("Capture data on the Data Input page first.");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    setValidateResult(null);
    try {
      // POST /validate requires {data, spec}; bind a candidate spec from the current
      // recommendation/mapping/columns so the preview validates real spec+data coherence.
      const spec = {
        chart_type: workflow.recommendation?.chart_type ?? "bar",
        x: workflow.recommendation?.x ?? workflow.mapping.x ?? workflow.columns[0] ?? null,
        y: workflow.recommendation?.y ?? workflow.mapping.y ?? workflow.columns[1] ?? null,
        title: "Data preview validation",
        output_formats: ["svg"],
      };
      const result = await api.validate({ ...workflow.data.body, spec });
      setValidateResult(result);
      setStatus("Validate succeeded.");
    } catch (e) {
      setError(errMessage(e, "Validate failed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Preview"
        version={appVersion}
        description="Inspect the captured table, run recommend, and validate the data shape before mapping fields."
      >
        <Button size="sm" variant="secondary" disabled={!workflow.data} onClick={() => navigate("/data-input")}>
          Edit Data
        </Button>
        <Button size="sm" variant="secondary" disabled={busy || !workflow.data} onClick={() => void validate()}>
          Validate
        </Button>
        <Button size="sm" disabled={busy || !workflow.data} onClick={() => void recommend()} data-testid="data-preview-recommend">
          Recommend
        </Button>
      </PageHeader>

      <StatusLine loading={busy} error={error} status={status} />

      {!workflow.data ? (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">No data captured. Go to Data Input to paste CSV / JSON or upload a file.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          <Card>
            <CardHeader>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-lg font-semibold">Rows</h2>
                <Badge variant="secondary">{workflow.rows.length} total</Badge>
                <Badge>{workflow.columns.length} columns</Badge>
                {workflow.dataSource ? <Badge>{workflow.dataSource}</Badge> : null}
              </div>
            </CardHeader>
            <CardContent>
              <DataTable
                columns={columns}
                rows={previewRows}
                getRowId={(row) => row.__row_id}
                emptyMessage="No rows in captured data."
                pageSize={25}
                tableId="chart-mcp-data-preview"
              />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <h2 className="text-lg font-semibold">Recommendation</h2>
            </CardHeader>
            <CardContent className="space-y-3">
              {workflow.recommendation ? (
                <JsonExplorer data={workflow.recommendation} defaultExpanded title="Recommendation" />
              ) : (
                <p className="text-sm text-muted-foreground">Run Recommend to populate.</p>
              )}
              {validateResult ? <JsonExplorer data={validateResult} title="Validate result" /> : null}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}
