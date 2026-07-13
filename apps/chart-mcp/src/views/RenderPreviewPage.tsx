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

// FR1.40 page kind: Render Preview. Role-visibility: chart.operator+.
// Calls POST /render with the active workflow spec, shows the rendered preview,
// and offers download + Save-to-Gallery (jump to Assets view) operations.

import * as React from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  JsonExplorer,
} from "@cloud-dog/ui";
import { useNavigate } from "react-router-dom";
import { useChartState } from "../state/AppState";
import { PageHeader, StatusLine, errMessage } from "../lib/ui";
import { useChartWorkflow } from "../state/ChartWorkflow";
import { svgDataUri } from "../lib/input";

export function RenderPreviewPage() {
  const { api, appVersion } = useChartState();
  const navigate = useNavigate();
  const workflow = useChartWorkflow();
  const [busy, setBusy] = React.useState(false);
  const [result, setResult] = React.useState<Record<string, unknown> | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);

  const canRender = !!workflow.data && !!workflow.spec;

  const doRender = async () => {
    if (!workflow.data || !workflow.spec) {
      setError("Capture data and save a ChartSpec first.");
      return;
    }
    setBusy(true);
    setError(null);
    setStatus(null);
    try {
      const body: Record<string, unknown> = { ...workflow.data.body, spec: workflow.spec };
      const out = await api.render(body);
      setResult(out);
      const assets = (out as { assets?: unknown[] }).assets;
      setStatus(`Render OK (${Array.isArray(assets) ? assets.length : 0} asset(s)).`);
    } catch (e) {
      setError(errMessage(e, "Render failed."));
    } finally {
      setBusy(false);
    }
  };

  const downloadJson = () => {
    if (!result) return;
    const href = `data:application/json;base64,${btoa(unescape(encodeURIComponent(JSON.stringify(result, null, 2))))}`;
    const link = document.createElement("a");
    link.href = href;
    link.download = "chart-render-preview.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const preview = result ? svgDataUri(result) : null;
  const manifestId = result && typeof (result as Record<string, unknown>).manifest_id === "string"
    ? ((result as Record<string, unknown>).manifest_id as string)
    : null;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Render Preview"
        version={appVersion}
        description="Render the active workflow (data + spec + style + locale) and download / save to gallery."
      >
        <Button size="sm" variant="secondary" onClick={() => navigate("/chartspec-editor")}>
          Edit Spec
        </Button>
        <Button size="sm" disabled={busy || !canRender} onClick={() => void doRender()} data-testid="render-preview-run">
          Render
        </Button>
      </PageHeader>

      <StatusLine loading={busy} error={error} status={status} />

      {!canRender ? (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Need both captured data and a saved ChartSpec to render. Visit Data Input then ChartSpec Editor.
            </p>
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Active workflow</h2>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <p>Data source: {workflow.dataSource ? <Badge>{workflow.dataSource}</Badge> : "—"}</p>
            <p>Rows: <Badge variant="secondary">{workflow.rows.length}</Badge></p>
            <p>Spec: {workflow.spec ? <Badge>{workflow.spec.chart_type}</Badge> : "—"}</p>
            <p>Style: {workflow.style ? <Badge variant="secondary">{workflow.style}</Badge> : "—"}</p>
            <p>Locale: {workflow.locale.locale ? <Badge variant="secondary">{workflow.locale.locale}</Badge> : "—"}</p>
            {workflow.spec ? <JsonExplorer data={workflow.spec} title="ChartSpec" /> : null}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Preview</h2>
            {result ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="ghost" onClick={downloadJson} data-testid="render-preview-download">
                  Download JSON
                </Button>
                {manifestId ? (
                  <Button size="sm" variant="secondary" onClick={() => navigate("/render-assets")} data-testid="render-preview-gallery">
                    Save to Gallery
                  </Button>
                ) : null}
              </div>
            ) : null}
          </CardHeader>
          <CardContent>
            {preview ? (
              <div className="rounded border p-2">
                <img src={preview} alt="Chart workflow render preview" className="max-h-96 w-full object-contain" />
              </div>
            ) : result ? (
              <p className="text-sm text-muted-foreground">
                Render produced {(Array.isArray((result as { assets?: unknown[] }).assets)
                  ? ((result as { assets?: unknown[] }).assets as unknown[]).length
                  : 0)} asset(s). Inline preview unavailable when the asset is delivered by
                reference (transfer_mode=reference). Download JSON or open the asset from the
                Gallery to view it.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">No preview yet — click Render.</p>
            )}
            {result ? <JsonExplorer data={result} title="Render result" /> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
