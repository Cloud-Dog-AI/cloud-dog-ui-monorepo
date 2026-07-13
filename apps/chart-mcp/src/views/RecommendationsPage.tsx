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
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  JsonExplorer,
  Label,
  Textarea,
} from "@cloud-dog/ui";
import { useChartState } from "../state/AppState";
import { PageHeader, StatusLine, errMessage } from "../lib/ui";
import { buildInputBody, specFromRecommendation, svgDataUri } from "../lib/input";
import type { Recommendation } from "../lib/types";

const SAMPLE_CSV = `category,value
Marketing,42
Sales,67
Support,28
Research,15`;

export function RecommendationsPage() {
  const { api, appVersion } = useChartState();
  const [input, setInput] = React.useState(SAMPLE_CSV);
  const [llmAssisted, setLlmAssisted] = React.useState(false);
  const [recommendation, setRecommendation] = React.useState<Recommendation | null>(null);
  const [renderResult, setRenderResult] = React.useState<Record<string, unknown> | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);

  const recommend = async () => {
    setError(null);
    setStatus(null);
    setRenderResult(null);
    setBusy(true);
    try {
      const body = { ...buildInputBody(input), llm_assisted: llmAssisted };
      const rec = await api.recommend(body);
      setRecommendation(rec);
      setStatus(`Recommended ${rec.chart_type ?? "chart"}${rec.confidence != null ? ` (confidence ${(rec.confidence * 100).toFixed(0)}%)` : ""}.`);
    } catch (e) {
      setRecommendation(null);
      setError(errMessage(e, "Recommendation failed."));
    } finally {
      setBusy(false);
    }
  };

  const renderPreview = async () => {
    if (!recommendation) return;
    setError(null);
    setBusy(true);
    try {
      const body = { ...buildInputBody(input), spec: specFromRecommendation(recommendation) };
      const result = await api.render(body);
      setRenderResult(result);
      setStatus("Render preview generated.");
    } catch (e) {
      setRenderResult(null);
      setError(errMessage(e, "Render preview failed."));
    } finally {
      setBusy(false);
    }
  };

  const downloadJson = () => {
    const payload = { input, recommendation, render: renderResult };
    const href = `data:application/json;base64,${btoa(unescape(encodeURIComponent(JSON.stringify(payload, null, 2))))}`;
    const link = document.createElement("a");
    link.href = href;
    link.download = "chart-recommendation.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
  };

  const preview = renderResult ? svgDataUri(renderResult) : null;

  return (
    <div className="space-y-6">
      <PageHeader title="Recommendations" version={appVersion} description="Sandbox: paste data, get a deterministic chart recommendation, then render a preview." />

      <StatusLine loading={busy} error={error} status={status} />

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Input data</h2>
            <p className="text-sm text-muted-foreground">CSV text or a JSON array of row objects.</p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Label htmlFor="reco-input">Data</Label>
            <Textarea
              id="reco-input"
              rows={10}
              className="font-mono text-xs"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              aria-label="Sandbox data input"
            />
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={llmAssisted} onChange={(e) => setLlmAssisted(e.currentTarget.checked)} />
              <span>LLM-assisted titles &amp; labels (optional, post-validation)</span>
            </label>
            <div className="flex flex-wrap gap-2">
              <Button onClick={() => void recommend()} disabled={busy} data-testid="recommend-button">
                Recommend
              </Button>
              <Button variant="secondary" onClick={() => void renderPreview()} disabled={busy || !recommendation}>
                Render Preview
              </Button>
              <Button variant="secondary" onClick={() => setInput(SAMPLE_CSV)} disabled={busy}>
                Reset Sample
              </Button>
              <Button variant="ghost" onClick={downloadJson} disabled={!recommendation}>
                Download JSON
              </Button>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Result</h2>
          </CardHeader>
          <CardContent className="space-y-4">
            {recommendation ? (
              <div className="flex flex-wrap items-center gap-2">
                <Badge>{recommendation.chart_type ?? "chart"}</Badge>
                {recommendation.x ? <Badge variant="secondary">x: {recommendation.x}</Badge> : null}
                {recommendation.y ? <Badge variant="secondary">y: {recommendation.y}</Badge> : null}
                {recommendation.confidence != null ? (
                  <Badge variant="secondary">{(recommendation.confidence * 100).toFixed(0)}%</Badge>
                ) : null}
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">Run a recommendation to see the result.</p>
            )}

            {preview ? (
              <div className="rounded border p-2">
                <img src={preview} alt="Chart render preview" className="max-h-72 w-full object-contain" />
              </div>
            ) : null}

            {recommendation ? <JsonExplorer data={recommendation} title="Recommendation" defaultExpanded /> : null}
            {renderResult ? <JsonExplorer data={renderResult} title="Render result" /> : null}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
