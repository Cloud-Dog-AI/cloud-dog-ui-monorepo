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

// FR1.40 page kind: Field Mapping. Role-visibility: chart.operator+.
// Maps captured-data columns to chart axes (x/y/group/aggregate) for downstream ChartSpec.

import * as React from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Label,
  Select,
  Badge,
  JsonExplorer,
} from "@cloud-dog/ui";
import { useNavigate } from "react-router-dom";
import { useChartState } from "../state/AppState";
import { PageHeader, StatusLine, errMessage } from "../lib/ui";
import { useChartWorkflow } from "../state/ChartWorkflow";

const AGGREGATES = ["", "sum", "avg", "count", "min", "max"];

export function FieldMappingPage() {
  const { api, appVersion } = useChartState();
  const navigate = useNavigate();
  const workflow = useChartWorkflow();
  const [x, setX] = React.useState<string>(workflow.mapping.x ?? "");
  const [y, setY] = React.useState<string>(workflow.mapping.y ?? "");
  const [group, setGroup] = React.useState<string>(workflow.mapping.group ?? "");
  const [aggregate, setAggregate] = React.useState<string>(workflow.mapping.aggregate ?? "");
  const [status, setStatus] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [binding, setBinding] = React.useState<Record<string, unknown> | null>(null);
  const [bindingError, setBindingError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (workflow.recommendation) {
      if (!x && workflow.recommendation.x) setX(workflow.recommendation.x);
      if (!y && workflow.recommendation.y) setY(workflow.recommendation.y);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workflow.recommendation]);

  // Save the mapping, then BIND the mapped fields into a candidate ChartSpec and
  // validate that binding against the real chart-mcp backend (POST /validate needs
  // {data, spec}; the spec.x/spec.y come from this mapping). Closes CH-DEF-002 for
  // the Field Mapping page. "Mapping saved." is set synchronously so it is observable
  // immediately; the backend binding result lands in its own card.
  const apply = async () => {
    const mapping = {
      x: x || null,
      y: y || null,
      group: group || null,
      aggregate: aggregate || null,
    };
    workflow.setMapping(mapping);
    setStatus("Mapping saved.");
    setBinding(null);
    setBindingError(null);
    if (!workflow.data) return;
    const spec = {
      chart_type: workflow.recommendation?.chart_type ?? "bar",
      x: mapping.x,
      y: mapping.y,
      title: "Field mapping binding",
      output_formats: ["svg"],
    };
    setBusy(true);
    try {
      const result = await api.validate({ ...workflow.data.body, spec });
      setBinding(result);
    } catch (e) {
      setBindingError(errMessage(e, "Binding validate failed."));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <PageHeader
        title="Field Mapping"
        version={appVersion}
        description="Bind captured-data columns to chart axes / group / aggregate. Required before ChartSpec edit."
      >
        <Button size="sm" variant="secondary" onClick={() => navigate("/data-preview")}>
          Back to Preview
        </Button>
        <Button size="sm" disabled={busy} onClick={() => void apply()} data-testid="field-mapping-apply">
          Save Mapping
        </Button>
      </PageHeader>

      <StatusLine loading={busy} error={bindingError} status={status} />

      {workflow.columns.length === 0 ? (
        <Card>
          <CardContent>
            <p className="text-sm text-muted-foreground">No columns yet — capture data on Data Input first.</p>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Mapping</h2>
            <p className="text-sm text-muted-foreground">
              {workflow.columns.length} column(s) available · {workflow.rows.length} row(s)
            </p>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="map-x">X axis</Label>
              <Select id="map-x" value={x} onChange={(e) => setX(e.target.value)} aria-label="X axis column">
                <option value="">(none)</option>
                {workflow.columns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="map-y">Y axis</Label>
              <Select id="map-y" value={y} onChange={(e) => setY(e.target.value)} aria-label="Y axis column">
                <option value="">(none)</option>
                {workflow.columns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="map-group">Group / series</Label>
              <Select id="map-group" value={group} onChange={(e) => setGroup(e.target.value)} aria-label="Group column">
                <option value="">(none)</option>
                {workflow.columns.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="map-agg">Aggregate</Label>
              <Select id="map-agg" value={aggregate} onChange={(e) => setAggregate(e.target.value)} aria-label="Aggregate function">
                {AGGREGATES.map((a) => (
                  <option key={a || "_none"} value={a}>{a || "(none)"}</option>
                ))}
              </Select>
            </div>
            <div className="md:col-span-2 flex flex-wrap items-center gap-2 text-xs">
              <Badge>x: {x || "—"}</Badge>
              <Badge>y: {y || "—"}</Badge>
              <Badge variant="secondary">group: {group || "—"}</Badge>
              <Badge variant="secondary">aggregate: {aggregate || "—"}</Badge>
            </div>
          </CardContent>
        </Card>
      )}

      {binding ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Binding validated by chart-mcp</h2>
            <p className="text-sm text-muted-foreground">
              The mapped fields were bound into a candidate ChartSpec and checked by the
              <code> /validate</code> API.
            </p>
          </CardHeader>
          <CardContent>
            <JsonExplorer data={binding} defaultExpanded title="Validate result" />
          </CardContent>
        </Card>
      ) : null}

      {workflow.recommendation ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Recommendation (for reference)</h2>
          </CardHeader>
          <CardContent>
            <JsonExplorer data={workflow.recommendation} title="Recommendation" />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
