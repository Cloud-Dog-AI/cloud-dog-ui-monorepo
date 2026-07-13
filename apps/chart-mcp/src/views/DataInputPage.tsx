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

// FR1.40 page kind: Data Input. Role-visibility: chart.operator+ (operator/designer/admin).
// Capture CSV / JSON / file upload into the workflow draft so downstream pages can read it.

import * as React from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  FileDropZone,
  JsonExplorer,
  Label,
  Textarea,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@cloud-dog/ui";
import { useChartState } from "../state/AppState";
import { PageHeader, StatusLine, errMessage } from "../lib/ui";
import { useChartWorkflow } from "../state/ChartWorkflow";
import { buildInputBody } from "../lib/input";

const SAMPLE_CSV = `category,value
Marketing,42
Sales,67
Support,28
Research,15`;

const SAMPLE_JSON = `[
  { "category": "Q1", "value": 120 },
  { "category": "Q2", "value": 148 },
  { "category": "Q3", "value": 96 },
  { "category": "Q4", "value": 175 }
]`;

function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(typeof reader.result === "string" ? reader.result : "");
    reader.onerror = () => reject(new Error(`Failed to read ${file.name}`));
    reader.readAsText(file);
  });
}

export function DataInputPage() {
  const { api, appVersion } = useChartState();
  const workflow = useChartWorkflow();
  const [raw, setRaw] = React.useState(workflow.dataRaw || SAMPLE_CSV);
  const [tab, setTab] = React.useState<"csv" | "json" | "file">("csv");
  const [fileName, setFileName] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [ingest, setIngest] = React.useState<Record<string, unknown> | null>(null);

  const apply = React.useCallback(
    (next: string, source: "csv" | "json" | "file") => {
      setError(null);
      setStatus(null);
      try {
        const body = buildInputBody(next);
        workflow.setData({ raw: next, body, source });
        setStatus(`Captured ${source.toUpperCase()} payload (${next.length} chars).`);
      } catch (e) {
        setError(errMessage(e, "Invalid data input."));
      }
    },
    [workflow]
  );

  // Validate + ingest the captured payload against the real chart-mcp backend
  // (POST /recommend is the public data-ingest path: it parses the rows/CSV and
  // returns a deterministic analysis, proving the data is ingestible before the
  // author proceeds). Closes CH-DEF-002 for the Data Input page.
  const validateAndIngest = React.useCallback(async () => {
    setError(null);
    setStatus(null);
    setIngest(null);
    let body: Record<string, unknown>;
    try {
      body = buildInputBody(raw);
    } catch (e) {
      setError(errMessage(e, "Invalid data input."));
      return;
    }
    workflow.setData({ raw, body, source: tab });
    setBusy(true);
    try {
      const rec = await api.recommend(body);
      setIngest(rec);
      setStatus(`Data ingested by chart-mcp (recommended ${rec.chart_type ?? "chart"}).`);
    } catch (e) {
      setError(errMessage(e, "Backend ingest failed."));
    } finally {
      setBusy(false);
    }
  }, [api, raw, tab, workflow]);

  const onFilesSelected = async (files: File[]) => {
    const file = files[0];
    if (!file) return;
    setFileName(file.name);
    try {
      const text = await readFileAsText(file);
      setRaw(text);
      apply(text, "file");
    } catch (e) {
      setError(errMessage(e, "File read failed."));
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Data Input"
        version={appVersion}
        description="Capture the source data set for this chart workflow (CSV text, JSON array, or a small file upload)."
      >
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setRaw(SAMPLE_CSV);
            setTab("csv");
            apply(SAMPLE_CSV, "csv");
          }}
        >
          Reset Sample
        </Button>
        <Button
          size="sm"
          variant="secondary"
          data-testid="data-input-capture"
          onClick={() => apply(raw, tab)}
        >
          Capture
        </Button>
        <Button
          size="sm"
          disabled={busy}
          data-testid="data-input-ingest"
          onClick={() => void validateAndIngest()}
        >
          Validate &amp; Ingest
        </Button>
      </PageHeader>

      <StatusLine loading={busy} error={error} status={status} />

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Source</h2>
          <p className="text-sm text-muted-foreground">
            Captured payloads are forwarded to Data Preview / Field Mapping / ChartSpec Editor.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <Tabs value={tab} onValueChange={(value) => setTab(value as typeof tab)}>
            <TabsList>
              <TabsTrigger value="csv">CSV</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
              <TabsTrigger value="file">Upload</TabsTrigger>
            </TabsList>
            <TabsContent value="csv">
              <Label htmlFor="data-input-csv">CSV text</Label>
              <Textarea
                id="data-input-csv"
                rows={12}
                className="font-mono text-xs"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                aria-label="CSV data input"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setRaw(SAMPLE_CSV);
                  apply(SAMPLE_CSV, "csv");
                }}
              >
                Insert CSV sample
              </Button>
            </TabsContent>
            <TabsContent value="json">
              <Label htmlFor="data-input-json">JSON array of row objects</Label>
              <Textarea
                id="data-input-json"
                rows={12}
                className="font-mono text-xs"
                value={raw}
                onChange={(e) => setRaw(e.target.value)}
                aria-label="JSON data input"
              />
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setRaw(SAMPLE_JSON);
                  apply(SAMPLE_JSON, "json");
                }}
              >
                Insert JSON sample
              </Button>
            </TabsContent>
            <TabsContent value="file">
              <FileDropZone
                accept=".csv,.json,text/csv,application/json"
                multiple={false}
                label="Upload .csv or .json"
                description="The selected file is read in the browser and captured into this chart workflow."
                inputLabel="Upload data file"
                onDrop={(files) => void onFilesSelected(files)}
                testId="chart-data-input-file-drop-zone"
              />
              {fileName ? (
                <p className="text-xs text-muted-foreground">
                  Loaded <Badge variant="secondary">{fileName}</Badge>
                </p>
              ) : null}
            </TabsContent>
          </Tabs>
          <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
            <Badge>{tab.toUpperCase()}</Badge>
            <span>chars: {raw.length}</span>
            {workflow.dataSource ? (
              <Badge variant="secondary">workflow source: {workflow.dataSource}</Badge>
            ) : null}
          </div>
        </CardContent>
      </Card>

      {ingest ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Backend ingest result</h2>
            <p className="text-sm text-muted-foreground">
              Returned by the chart-mcp <code>/recommend</code> API for the captured data.
            </p>
          </CardHeader>
          <CardContent>
            <JsonExplorer data={ingest} defaultExpanded title="Ingest analysis" />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
