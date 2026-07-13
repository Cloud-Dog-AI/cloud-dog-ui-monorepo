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
import { useParams, useSearchParams } from "react-router-dom";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  Dialog,
  DiscoveredMultiSelect,
  Input,
  JsonExplorer,
  Label,
  Select,
  Spinner,
  type DiscoveredOption,
} from "@cloud-dog/ui";
import { ProfileSelect } from "../components/ProfileSelect";
import { useDbMcpState } from "../state/AppState";
import type { EntityField, EntityItem, IndexItem, NamespaceItem } from "../lib/types";

type OperationType = "create_index" | "add_column";

function optionsFromNamed(items: Array<{ name: string }>): DiscoveredOption[] {
  return items.map((item) => ({ value: item.name, label: item.name }));
}

function getPlanId(plan: Record<string, unknown> | null): string {
  if (!plan) return "";
  const value = plan.plan_id ?? plan.id;
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}

function operationsFrom(payload: Record<string, unknown> | null): Record<string, unknown>[] {
  if (!payload) return [];
  if (Array.isArray(payload.operations)) return payload.operations.filter((item): item is Record<string, unknown> => Boolean(item && typeof item === "object"));
  const operation = payload.operation;
  if (operation && typeof operation === "object" && !Array.isArray(operation)) return [operation as Record<string, unknown>];
  return [payload];
}

function OperationCards({ title, payload, empty }: { title: string; payload: Record<string, unknown> | null; empty: string }) {
  const operations = operationsFrom(payload);
  if (!payload) {
    return (
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">{title}</h2></CardHeader>
        <CardContent><p className="text-sm text-muted-foreground">{empty}</p></CardContent>
      </Card>
    );
  }
  const warnings = Array.isArray(payload.warnings) ? payload.warnings : [];
  return (
    <div className="space-y-3" aria-label={title}>
      <h2 className="text-lg font-semibold">{title}</h2>
      {operations.map((operation, index) => (
        <Card key={`${title}-${index}`}>
          <CardHeader>
            <h3 className="text-base font-semibold">Operation {index + 1}: {String(operation.operation ?? operation.type ?? "schema change")}</h3>
          </CardHeader>
          <CardContent className="space-y-3">
            <dl className="grid gap-2 text-sm md:grid-cols-2">
              {Object.entries(operation).slice(0, 8).map(([key, value]) => (
                <div key={key}>
                  <dt className="font-medium">{key}</dt>
                  <dd className="text-muted-foreground">{typeof value === "object" ? JSON.stringify(value) : String(value)}</dd>
                </div>
              ))}
            </dl>
            {warnings.length ? (
              <ul className="list-disc pl-5 text-sm text-amber-700">
                {warnings.map((warning, warningIndex) => <li key={warningIndex}>{String(warning)}</li>)}
              </ul>
            ) : (
              <p className="text-sm text-muted-foreground">No warnings returned.</p>
            )}
            <details>
              <summary className="cursor-pointer text-sm font-medium">Show raw payload</summary>
              <JsonExplorer data={payload} defaultExpanded hideInternalSearch title={`${title} raw payload`} viewMode="table" />
            </details>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function SchemaPage() {
  const { profileId = "" } = useParams();
  const [searchParams] = useSearchParams();
  const routeProfileId = decodeURIComponent(profileId || searchParams.get("profile") || searchParams.get("profile_id") || "");
  const routeNamespace = searchParams.get("namespace") ?? "dbmcp_ui_e2e";
  const routeEntity = searchParams.get("entity") ?? "orders";
  const { api, currentProfile, setSelectedProfileId } = useDbMcpState();
  const [namespace, setNamespace] = React.useState(routeNamespace);
  const [entity, setEntity] = React.useState(routeEntity);
  const [operationType, setOperationType] = React.useState<OperationType>("create_index");
  const [indexName, setIndexName] = React.useState("orders_customer_status_idx");
  const [indexField, setIndexField] = React.useState("customer_id");
  const [existingIndex, setExistingIndex] = React.useState("");
  const [columnName, setColumnName] = React.useState("last_login_at");
  const [columnType, setColumnType] = React.useState("TIMESTAMP");
  const [columnNullable, setColumnNullable] = React.useState(true);
  const [planned, setPlanned] = React.useState<Record<string, unknown> | null>(null);
  const [approved, setApproved] = React.useState<Record<string, unknown> | null>(null);
  const [applied, setApplied] = React.useState<Record<string, unknown> | null>(null);
  const [approvalOpen, setApprovalOpen] = React.useState(false);
  const [approvalText, setApprovalText] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState("");
  const [namespaceList, setNamespaceList] = React.useState<NamespaceItem[]>([]);
  const [entityList, setEntityList] = React.useState<EntityItem[]>([]);
  const [fieldList, setFieldList] = React.useState<EntityField[]>([]);
  const [indexList, setIndexList] = React.useState<IndexItem[]>([]);
  const [loadingSchema, setLoadingSchema] = React.useState(false);
  const [approving, setApproving] = React.useState(false);

  React.useEffect(() => {
    if (routeProfileId) setSelectedProfileId(routeProfileId);
  }, [routeProfileId, setSelectedProfileId]);

  React.useEffect(() => {
    setNamespace(routeNamespace);
    setEntity(routeEntity);
  }, [routeEntity, routeNamespace]);

  React.useEffect(() => {
    if (!currentProfile) {
      setNamespaceList([]);
      return;
    }
    setLoadingSchema(true);
    void api.listNamespaces(currentProfile.profile_id)
      .then(setNamespaceList)
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Failed to load namespaces."))
      .finally(() => setLoadingSchema(false));
  }, [api, currentProfile]);

  React.useEffect(() => {
    if (!currentProfile || !namespace) {
      setEntityList([]);
      return;
    }
    setLoadingSchema(true);
    void api.listEntities(currentProfile.profile_id, namespace)
      .then((items) => {
        setEntityList(items);
        setEntity((current) => current || items[0]?.name || "");
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Failed to load entities."))
      .finally(() => setLoadingSchema(false));
  }, [api, currentProfile, namespace]);

  React.useEffect(() => {
    if (!currentProfile || !namespace || !entity) {
      setFieldList([]);
      setIndexList([]);
      return;
    }
    setLoadingSchema(true);
    void Promise.all([
      api.describeFields(currentProfile.profile_id, namespace, entity),
      api.listIndexes(currentProfile.profile_id, namespace, entity),
    ])
      .then(([fields, indexes]) => {
        setFieldList((fields.fields ?? []) as EntityField[]);
        setIndexList(indexes);
        setIndexField((current) => current || String(fields.fields?.[0]?.name ?? ""));
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Failed to load schema details."))
      .finally(() => setLoadingSchema(false));
  }, [api, currentProfile, entity, namespace]);

  const buildOperation = React.useCallback((): Record<string, unknown> => {
    if (operationType === "add_column") {
      return {
        operation: "add_column",
        namespace,
        entity,
        column: { name: columnName, type: columnType, nullable: columnNullable },
      };
    }
    return {
      operation: "create_index",
      namespace,
      entity,
      name: indexName,
      keys: [{ field: indexField, direction: "asc" }],
      existing_index: existingIndex || undefined,
    };
  }, [columnName, columnNullable, columnType, entity, existingIndex, indexField, indexName, namespace, operationType]);

  const plan = async () => {
    if (!currentProfile) return;
    setError(null);
    setStatus("");
    try {
      const result = await api.planSchemaChange(currentProfile.profile_id, buildOperation());
      setPlanned(result);
      setApproved(null);
      setApplied(null);
      setStatus("Schema plan generated.");
    } catch (planError) {
      setError(planError instanceof Error ? planError.message : "Failed to plan schema change.");
    }
  };

  const approve = async () => {
    const planId = getPlanId(planned);
    if (!planId || approvalText !== entity) return;
    setApproving(true);
    setError(null);
    try {
      const result = await api.approveSchemaChange(planId, { profile_id: currentProfile?.profile_id, target_name: entity });
      setApproved(result);
      setPlanned((current) => current ? { ...current, approved: true, approval: result } : current);
      setStatus(`Approved schema plan ${planId}.`);
      setApprovalOpen(false);
      setApprovalText("");
    } catch (approveError) {
      setError(approveError instanceof Error ? approveError.message : "Failed to approve schema plan.");
    } finally {
      setApproving(false);
    }
  };

  const apply = async () => {
    if (!currentProfile || !planned || !approved) return;
    try {
      const result = await api.applySchemaChange(currentProfile.profile_id, { ...planned, approval: approved });
      setApplied(result);
      setStatus("Applied approved schema plan.");
    } catch (applyError) {
      setError(applyError instanceof Error ? applyError.message : "Failed to apply schema change.");
    }
  };

  const planId = getPlanId(planned);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Schema Change</h1>
        <p className="text-sm text-muted-foreground">Plan and apply schema changes against a selected profile connection.</p>
      </header>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Scope</h2></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-3">
          <ProfileSelect id="schema-profile" />
          <DiscoveredMultiSelect
            label="Namespace"
            mode="single"
            options={optionsFromNamed(namespaceList)}
            values={namespace ? [namespace] : []}
            onChange={(values) => { setNamespace(values[0] ?? ""); setEntity(""); }}
            placeholder="Select namespace"
            aria-label="Namespace"
          />
          <DiscoveredMultiSelect
            label="Entity"
            mode="single"
            options={optionsFromNamed(entityList)}
            values={entity ? [entity] : []}
            onChange={(values) => setEntity(values[0] ?? "")}
            placeholder="Select entity"
            aria-label="Entity"
          />
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            {loadingSchema ? <Spinner className="h-4 w-4" /> : null}
            {loadingSchema ? "Loading schema..." : `${fieldList.length} fields, ${indexList.length} indexes loaded`}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Build operation</h2></CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 md:grid-cols-3 md:items-end">
            <div className="space-y-2">
              <Label htmlFor="schema-operation-type">Type</Label>
              <Select id="schema-operation-type" value={operationType} onChange={(event) => setOperationType(event.target.value as OperationType)}>
                <option value="create_index">create_index</option>
                <option value="add_column">add_column</option>
              </Select>
            </div>
            {operationType === "create_index" ? (
              <>
                <div className="space-y-2">
                  <Label htmlFor="schema-index-name">Index name</Label>
                  <Input id="schema-index-name" value={indexName} onChange={(event) => setIndexName(event.target.value)} />
                </div>
                <DiscoveredMultiSelect
                  label="Index field"
                  mode="single"
                  options={optionsFromNamed(fieldList)}
                  values={indexField ? [indexField] : []}
                  onChange={(values) => setIndexField(values[0] ?? "")}
                  placeholder="Select field"
                  aria-label="Index field"
                />
                <DiscoveredMultiSelect
                  label="Existing index"
                  mode="single"
                  options={indexList.map((item) => ({ value: item.name, label: item.name }))}
                  values={existingIndex ? [existingIndex] : []}
                  onChange={(values) => setExistingIndex(values[0] ?? "")}
                  placeholder="No existing index selected"
                  aria-label="Existing index"
                />
              </>
            ) : (
              <>
                <div className="space-y-2">
                  <Label htmlFor="schema-column-name">Column</Label>
                  <Input id="schema-column-name" value={columnName} onChange={(event) => setColumnName(event.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="schema-column-type">Column type</Label>
                  <Input id="schema-column-type" value={columnType} onChange={(event) => setColumnType(event.target.value)} />
                </div>
                <label className="flex items-center gap-2 text-sm">
                  <input type="checkbox" checked={columnNullable} onChange={(event) => setColumnNullable(event.target.checked)} />
                  Nullable
                </label>
              </>
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void plan()} disabled={!currentProfile || !namespace || !entity}>Plan changes</Button>
            <Button variant="secondary" onClick={() => setApprovalOpen(true)} disabled={!planned || !planId}>Approve plan</Button>
            <Button onClick={() => void apply()} disabled={!planned || !approved}>Apply approved plan</Button>
          </div>
        </CardContent>
      </Card>

      <OperationCards title="Plan preview" payload={planned} empty="Run Plan changes to preview the schema change before approval." />
      <OperationCards title="Apply result" payload={applied} empty="No schema change applied yet. Approve a plan before applying it." />

      <Dialog open={approvalOpen} onOpenChange={setApprovalOpen} label="Approve schema plan">
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Approve schema plan</h2>
          <p className="text-sm text-muted-foreground">Type the entity name to approve plan {planId || "unknown"}.</p>
          <p className="text-sm font-medium">{entity}</p>
          <div className="space-y-2">
            <Label htmlFor="schema-approval-entity">Entity name</Label>
            <Input id="schema-approval-entity" aria-label="Type entity name to approve" value={approvalText} onChange={(event) => setApprovalText(event.target.value)} />
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" onClick={() => setApprovalOpen(false)} disabled={approving}>Cancel</Button>
            <Button onClick={() => void approve()} disabled={approvalText !== entity || approving}>{approving ? "Approving..." : "Approve plan"}</Button>
          </div>
        </div>
      </Dialog>
    </div>
  );
}
