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
import { Button, Card, CardContent, CardHeader, Input, Label, Select, Spinner } from "@cloud-dog/ui";
import { JsonPanel } from "../components/JsonPanel";
import { ProfileSelect } from "../components/ProfileSelect";
import { useDbMcpState } from "../state/AppState";
import type { EntityField, EntityItem, NamespaceItem } from "../lib/types";

export function SchemaPage() {
  const { api, currentProfile } = useDbMcpState();
  const [namespace, setNamespace] = React.useState("dbmcp_ui_e2e");
  const [entity, setEntity] = React.useState("orders");
  const [indexName, setIndexName] = React.useState("orders_customer_status_idx");
  const [indexField, setIndexField] = React.useState("customer_id");
  const [planned, setPlanned] = React.useState<Record<string, unknown> | null>(null);
  const [applied, setApplied] = React.useState<Record<string, unknown> | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [namespaceList, setNamespaceList] = React.useState<NamespaceItem[]>([]);
  const [entityList, setEntityList] = React.useState<EntityItem[]>([]);
  const [fieldList, setFieldList] = React.useState<EntityField[]>([]);
  const [loadingFields, setLoadingFields] = React.useState(false);

  React.useEffect(() => {
    if (!currentProfile) return;
    void api.listNamespaces(currentProfile.profile_id).then(setNamespaceList).catch(() => {});
  }, [api, currentProfile]);

  React.useEffect(() => {
    if (!currentProfile || !namespace) { setEntityList([]); return; }
    void api.listEntities(currentProfile.profile_id, namespace).then(setEntityList).catch(() => {});
  }, [api, currentProfile, namespace]);

  React.useEffect(() => {
    if (!currentProfile || !namespace || !entity) { setFieldList([]); return; }
    setLoadingFields(true);
    void api.describeFields(currentProfile.profile_id, namespace, entity)
      .then((result) => setFieldList((result.fields ?? []) as EntityField[]))
      .catch(() => setFieldList([]))
      .finally(() => setLoadingFields(false));
  }, [api, currentProfile, namespace, entity]);

  const plan = async () => {
    if (!currentProfile) return;
    setError(null);
    try {
      const result = await api.planSchemaChange(currentProfile.profile_id, {
        operation: "create_index",
        namespace,
        entity,
        name: indexName,
        keys: [{ field: indexField, direction: "asc" }],
      });
      setPlanned(result);
    } catch (planError) {
      setError(planError instanceof Error ? planError.message : "Failed to plan schema change.");
    }
  };

  const apply = async () => {
    if (!currentProfile || !planned) return;
    const result = await api.applySchemaChange(currentProfile.profile_id, planned);
    setApplied(result);
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Schema Change</h1>
      </header>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Create index</h2></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3 md:items-end">
            <ProfileSelect id="schema-profile" />
            <div className="space-y-1">
              <Label htmlFor="schema-namespace">Namespace</Label>
              {namespaceList.length > 0 ? (
                <Select id="schema-namespace" value={namespace} onChange={(event) => setNamespace(event.target.value)}>
                  <option value="">Select namespace</option>
                  {namespaceList.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                </Select>
              ) : (
                <Input id="schema-namespace" value={namespace} onChange={(event) => setNamespace(event.target.value)} placeholder="e.g. dbmcp_ui_e2e" />
              )}
            </div>
            <div className="space-y-1">
              <Label htmlFor="schema-entity">Entity</Label>
              {entityList.length > 0 ? (
                <Select id="schema-entity" value={entity} onChange={(event) => setEntity(event.target.value)}>
                  <option value="">Select entity</option>
                  {entityList.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                </Select>
              ) : (
                <Input id="schema-entity" value={entity} onChange={(event) => setEntity(event.target.value)} placeholder="e.g. orders" />
              )}
            </div>
          </div>
          <div className="grid gap-4 md:grid-cols-3 md:items-end">
            <div className="space-y-1">
              <Label htmlFor="schema-index-name">Index name</Label>
              <Input id="schema-index-name" value={indexName} onChange={(event) => setIndexName(event.target.value)} placeholder="e.g. orders_customer_idx" />
            </div>
            <div className="space-y-1">
              <Label htmlFor="schema-index-field">Index field {loadingFields ? <Spinner className="inline h-3 w-3" /> : null}</Label>
              {fieldList.length > 0 ? (
                <Select id="schema-index-field" value={indexField} onChange={(event) => setIndexField(event.target.value)}>
                  <option value="">Select field</option>
                  {fieldList.map((f) => <option key={f.name} value={f.name}>{f.name} ({f.types?.join("/") ?? "unknown"})</option>)}
                </Select>
              ) : (
                <Input id="schema-index-field" value={indexField} onChange={(event) => setIndexField(event.target.value)} placeholder="e.g. customer_id" />
              )}
            </div>
            <div className="flex gap-2 items-end">
              <Button variant="secondary" onClick={() => void plan()}>Plan</Button>
              <Button onClick={() => void apply()} disabled={!planned}>Apply</Button>
            </div>
          </div>
        </CardContent>
      </Card>
      <JsonPanel title="Plan preview" value={planned ?? { note: "Run Plan to preview the schema change before applying." }} />
      <JsonPanel title="Apply result" value={applied ?? { note: "No schema change applied yet. Run Plan first, then Apply." }} />
    </div>
  );
}
