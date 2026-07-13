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

// FR1.40 page kind: ChartSpec Editor. Role-visibility: chart.designer+.
// Editable ChartSpec form bound to the workflow state. Persists to workflow.setSpec().

import * as React from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  Input,
  Label,
  Select,
  Textarea,
  JsonExplorer,
} from "@cloud-dog/ui";
import { useNavigate } from "react-router-dom";
import { useChartState } from "../state/AppState";
import { PageHeader, StatusLine, errMessage } from "../lib/ui";
import { useChartWorkflow } from "../state/ChartWorkflow";
import type { Capabilities, ChartSpec } from "../lib/types";

const FALLBACK_CHART_TYPES = ["bar", "column", "line", "pie", "scatter", "area", "table"];
const FALLBACK_FORMATS = ["svg", "png", "pdf"];

export function ChartSpecEditorPage() {
  const { api, appVersion } = useChartState();
  const navigate = useNavigate();
  const workflow = useChartWorkflow();
  const seedSpec: ChartSpec = workflow.spec ?? {
    chart_type: workflow.recommendation?.chart_type ?? "bar",
    x: workflow.recommendation?.x ?? workflow.mapping.x ?? null,
    y: workflow.recommendation?.y ?? workflow.mapping.y ?? null,
    title: "Chart workflow preview",
    output_formats: ["svg"],
  };
  const [chartType, setChartType] = React.useState<string>(seedSpec.chart_type);
  const [title, setTitle] = React.useState<string>(seedSpec.title ?? "");
  const [renderer, setRenderer] = React.useState<string>(seedSpec.renderer ?? "");
  const [outputs, setOutputs] = React.useState<string[]>(seedSpec.output_formats ?? ["svg"]);
  const [optionsText, setOptionsText] = React.useState<string>(JSON.stringify(seedSpec.options ?? {}, null, 2));
  const [accessibilityText, setAccessibilityText] = React.useState<string>(
    JSON.stringify(seedSpec.accessibility ?? {}, null, 2)
  );
  const [caps, setCaps] = React.useState<Capabilities | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [validation, setValidation] = React.useState<Record<string, unknown> | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    api.capabilities()
      .then((c) => {
        if (!cancelled) setCaps(c);
      })
      .catch(() => {
        if (!cancelled) setCaps(null);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  const chartTypes = React.useMemo(() => {
    const set = new Set<string>(FALLBACK_CHART_TYPES);
    if (caps) {
      Object.values(caps.renderers?.allowed ?? {}).forEach((r) => {
        r.supported_chart_types?.forEach((t) => set.add(t));
      });
    }
    return Array.from(set);
  }, [caps]);

  const formats = React.useMemo(() => {
    const set = new Set<string>(FALLBACK_FORMATS);
    caps?.formats?.forEach((f) => set.add(f));
    return Array.from(set);
  }, [caps]);

  const renderers = React.useMemo(() => Object.keys(caps?.renderers?.allowed ?? {}), [caps]);

  const toggleOutput = (fmt: string, checked: boolean) => {
    setOutputs((prev) => {
      const set = new Set(prev);
      if (checked) set.add(fmt);
      else set.delete(fmt);
      return Array.from(set);
    });
  };

  // Save the edited ChartSpec, then VALIDATE it against the real chart-mcp backend
  // (POST /validate enforces renderer policy + spec/data coherence). Closes CH-DEF-002
  // for the ChartSpec Editor page ("ChartSpecEditor -> validate"). "ChartSpec saved" is
  // set synchronously; the backend validation result lands in its own card.
  const apply = async () => {
    setError(null);
    setStatus(null);
    setValidation(null);
    let spec: ChartSpec;
    try {
      const options = optionsText.trim() ? JSON.parse(optionsText) : undefined;
      const accessibility = accessibilityText.trim() ? JSON.parse(accessibilityText) : undefined;
      spec = {
        chart_type: chartType,
        x: workflow.mapping.x ?? null,
        y: workflow.mapping.y ?? null,
        title: title || undefined,
        renderer: renderer || undefined,
        output_formats: outputs.length ? outputs : ["svg"],
        ...(options ? { options } : {}),
        ...(accessibility ? { accessibility } : {}),
        ...(workflow.locale.locale ? { locale: workflow.locale.locale } : {}),
        ...(workflow.style ? { style: workflow.style } : {}),
      };
    } catch (e) {
      setError(errMessage(e, "Invalid ChartSpec JSON."));
      return;
    }
    workflow.setSpec(spec);
    setStatus(`ChartSpec saved (${spec.chart_type}).`);
    if (!workflow.data) return;
    setBusy(true);
    try {
      const result = await api.validate({ ...workflow.data.body, spec });
      setValidation(result);
    } catch (e) {
      setError(errMessage(e, "ChartSpec validate failed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="ChartSpec Editor"
        version={appVersion}
        description="Edit the canonical ChartSpec (chart_type, options, accessibility) for the active workflow."
      >
        <Button size="sm" variant="secondary" onClick={() => navigate("/field-mapping")}>
          Back to Mapping
        </Button>
        <Button size="sm" disabled={busy} onClick={() => void apply()} data-testid="chartspec-apply">
          Save ChartSpec
        </Button>
      </PageHeader>

      <StatusLine loading={busy} error={error} status={status} />

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Basics</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="cs-type">chart_type</Label>
              <Select id="cs-type" value={chartType} onChange={(e) => setChartType(e.target.value)}>
                {chartTypes.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label htmlFor="cs-title">title</Label>
              <Input
                id="cs-title"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="Chart title"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cs-renderer">renderer (optional)</Label>
              <Select id="cs-renderer" value={renderer} onChange={(e) => setRenderer(e.target.value)}>
                <option value="">(auto-select)</option>
                {renderers.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-1">
              <Label>output_formats</Label>
              <div className="flex flex-wrap gap-3 text-sm">
                {formats.map((fmt) => (
                  <label key={fmt} className="flex items-center gap-2">
                    <Checkbox
                      checked={outputs.includes(fmt)}
                      onChange={(e) => toggleOutput(fmt, e.currentTarget.checked)}
                    />
                    <span>{fmt}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="flex flex-wrap gap-2 text-xs">
              <Badge>x: {workflow.mapping.x ?? "—"}</Badge>
              <Badge>y: {workflow.mapping.y ?? "—"}</Badge>
              {workflow.style ? <Badge variant="secondary">style: {workflow.style}</Badge> : null}
              {workflow.locale.locale ? <Badge variant="secondary">locale: {workflow.locale.locale}</Badge> : null}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Advanced</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="cs-options">options (JSON)</Label>
              <Textarea
                id="cs-options"
                rows={6}
                className="font-mono text-xs"
                value={optionsText}
                onChange={(e) => setOptionsText(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="cs-a11y">accessibility (JSON, alt_text / aria_label / description)</Label>
              <Textarea
                id="cs-a11y"
                rows={6}
                className="font-mono text-xs"
                value={accessibilityText}
                onChange={(e) => setAccessibilityText(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>
      </div>

      {workflow.spec ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Saved spec</h2>
          </CardHeader>
          <CardContent>
            <JsonExplorer data={workflow.spec} defaultExpanded title="ChartSpec" />
          </CardContent>
        </Card>
      ) : null}

      {validation ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Backend validation</h2>
            <p className="text-sm text-muted-foreground">
              Result from the chart-mcp <code>/validate</code> API for the saved ChartSpec.
            </p>
          </CardHeader>
          <CardContent>
            <JsonExplorer data={validation} defaultExpanded title="Validate result" />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
