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
import { useAuth } from "@cloud-dog/auth";
import { useSearchParams } from "react-router-dom";
import {
  ActionableError,
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  DiscoveredMultiSelect,
  EntityDialog,
  Input,
  Label,
  Select,
  Textarea,
  createDataTableActionColumn,
  type BulkAction,
  type DataColumn,
  type DataTableAction,
  type DiscoveredOption,
  type EntityFieldDef,
} from "@cloud-dog/ui";
import { ProfileSelect } from "../components/ProfileSelect";
import { canManageRelationships } from "../lib/access";
import { useDbMcpState } from "../state/AppState";
import { exportRowsJson } from "../lib/exportRows";
import type { EntityItem, NamespaceItem, RelationshipItem } from "../lib/types";

const EXPORT_BULK_ACTIONS: BulkAction[] = [{ label: "Export", action: "export" }];

type DialogMode = "add" | "edit" | "delete";

type RelationshipFormState = Readonly<{
  namespace: string;
  entity: string;
  field: string;
  target_namespace: string;
  target_entity: string;
  target_field: string;
  relationship_type: string;
  provenance: string;
  confidence: string;
  description: string;
  metadataJson: string;
}>;

const RELATIONSHIP_TYPE_OPTIONS = ["reference_candidate", "curated_reference", "join_key", "foreign_key", "manual_link"] as const;
const PROVENANCE_OPTIONS = ["inferred", "curated", "manual"] as const;

const DELETE_FIELDS: EntityFieldDef[] = [
  { name: "summary", label: "Relationship", type: "text", readOnly: true },
];

function toFormState(item: RelationshipItem | null, namespace: string, entity: string): RelationshipFormState {
  const targetField = typeof item?.metadata?.target_field === "string" ? item.metadata.target_field : "";
  return {
    namespace: item?.namespace ?? namespace,
    entity: item?.entity ?? entity,
    field: item?.field ?? "customer_id",
    target_namespace: item?.target_namespace ?? namespace,
    target_entity: item?.target_entity ?? "",
    target_field: targetField,
    relationship_type: item?.relationship_type ?? "curated_reference",
    provenance: item?.provenance ?? "curated",
    confidence: item?.confidence == null ? "" : String(item.confidence),
    description: item?.description ?? "",
    metadataJson: JSON.stringify(item?.metadata ?? {}, null, 2),
  };
}

function parseMetadataJson(value: string): Record<string, unknown> {
  if (!value.trim()) return {};
  return JSON.parse(value) as Record<string, unknown>;
}

function toDiscoveredOptions(items: Array<{ name: string }>): DiscoveredOption[] {
  return items.map((item) => ({ value: item.name, label: item.name }));
}

export function RelationshipsPage() {
  const auth = useAuth();
  const [searchParams] = useSearchParams();
  const seededNamespace = searchParams.get("namespace") ?? "dbmcp_ui_e2e";
  const seededEntity = searchParams.get("entity") ?? "orders";
  const { api, currentProfile } = useDbMcpState();
  const [namespace, setNamespace] = React.useState(seededNamespace);
  const [entity, setEntity] = React.useState(seededEntity);
  const [namespaceList, setNamespaceList] = React.useState<NamespaceItem[]>([]);
  const [entityList, setEntityList] = React.useState<EntityItem[]>([]);
  const [sourceEntityOptions, setSourceEntityOptions] = React.useState<EntityItem[]>([]);
  const [targetEntityOptions, setTargetEntityOptions] = React.useState<EntityItem[]>([]);
  const [sourceFieldOptions, setSourceFieldOptions] = React.useState<Array<{ name: string }>>([]);
  const [targetFieldOptions, setTargetFieldOptions] = React.useState<Array<{ name: string }>>([]);
  const [relationships, setRelationships] = React.useState<RelationshipItem[]>([]);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<DialogMode>("add");
  const [selectedRelationship, setSelectedRelationship] = React.useState<RelationshipItem | null>(null);
  const [form, setForm] = React.useState<RelationshipFormState>(toFormState(null, seededNamespace, seededEntity));
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const mayManageRelationships = canManageRelationships(auth.user);

  React.useEffect(() => {
    if (!currentProfile) return;
    void api.listNamespaces(currentProfile.profile_id).then(setNamespaceList).catch(() => {});
  }, [api, currentProfile]);

  React.useEffect(() => {
    if (!currentProfile || !namespace) { setEntityList([]); return; }
    void api.listEntities(currentProfile.profile_id, namespace).then(setEntityList).catch(() => {});
  }, [api, currentProfile, namespace]);

  React.useEffect(() => {
    if (!dialogOpen || !currentProfile || !form.namespace) {
      setSourceEntityOptions([]);
      return;
    }
    void api.listEntities(currentProfile.profile_id, form.namespace).then(setSourceEntityOptions).catch(() => setSourceEntityOptions([]));
  }, [api, currentProfile, dialogOpen, form.namespace]);

  React.useEffect(() => {
    if (!dialogOpen || !currentProfile || !form.target_namespace) {
      setTargetEntityOptions([]);
      return;
    }
    void api.listEntities(currentProfile.profile_id, form.target_namespace).then(setTargetEntityOptions).catch(() => setTargetEntityOptions([]));
  }, [api, currentProfile, dialogOpen, form.target_namespace]);

  React.useEffect(() => {
    if (!dialogOpen || !currentProfile || !form.namespace || !form.entity) {
      setSourceFieldOptions([]);
      return;
    }
    void api.describeFields(currentProfile.profile_id, form.namespace, form.entity)
      .then((result) => setSourceFieldOptions(result.fields.map((field) => ({ name: String(field.name ?? "") })).filter((field) => field.name)))
      .catch(() => setSourceFieldOptions([]));
  }, [api, currentProfile, dialogOpen, form.entity, form.namespace]);

  React.useEffect(() => {
    if (!dialogOpen || !currentProfile || !form.target_namespace || !form.target_entity) {
      setTargetFieldOptions([]);
      return;
    }
    void api.describeFields(currentProfile.profile_id, form.target_namespace, form.target_entity)
      .then((result) => setTargetFieldOptions(result.fields.map((field) => ({ name: String(field.name ?? "") })).filter((field) => field.name)))
      .catch(() => setTargetFieldOptions([]));
  }, [api, currentProfile, dialogOpen, form.target_entity, form.target_namespace]);

  const load = React.useCallback(async () => {
    if (!currentProfile || !namespace || !entity) return;
    setError(null);
    try {
      const items = await api.listRelationships(currentProfile.profile_id, namespace, entity);
      setRelationships(items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load relationships.");
    }
  }, [api, currentProfile, entity, namespace]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openDialog = (mode: DialogMode, item: RelationshipItem | null = null) => {
    setDialogMode(mode);
    setSelectedRelationship(item);
    setForm(toFormState(item, namespace, entity));
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSelectedRelationship(null);
    setForm(toFormState(null, namespace, entity));
  };

  const infer = async () => {
    if (!currentProfile || !mayManageRelationships) return;
    try {
      await api.inferRelationships(currentProfile.profile_id, namespace, entity);
      setStatus(`Inferred relationships for ${namespace}.${entity}.`);
      await load();
    } catch (inferError) {
      setError(inferError instanceof Error ? inferError.message : "Failed to infer relationships.");
    }
  };

  const promote = async (item: RelationshipItem) => {
    try {
      await api.updateRelationship(item.relationship_id, {
        provenance: "curated",
        relationship_type: item.relationship_type === "reference_candidate" ? "curated_reference" : item.relationship_type,
      });
      setStatus(`Promoted ${item.field} to curated.`);
      await load();
    } catch (promoteError) {
      setError(promoteError instanceof Error ? promoteError.message : "Failed to promote relationship.");
    }
  };

  const submit = async () => {
    if (!currentProfile) return;
    try {
      const metadata = parseMetadataJson(form.metadataJson);
      if (form.target_field.trim()) {
        metadata.target_field = form.target_field.trim();
      }
      const payload = {
        profile_id: currentProfile.profile_id,
        namespace: form.namespace.trim(),
        entity: form.entity.trim(),
        field: form.field.trim(),
        target_namespace: form.target_namespace.trim(),
        target_entity: form.target_entity.trim(),
        relationship_type: form.relationship_type,
        provenance: form.provenance,
        confidence: form.confidence.trim() ? Number(form.confidence) : undefined,
        description: form.description.trim(),
        metadata,
      };
      if (dialogMode === "add") {
        await api.createRelationship(payload);
        setStatus(`Created relationship ${payload.field} -> ${payload.target_namespace}.${payload.target_entity}.`);
      } else if (dialogMode === "edit" && selectedRelationship) {
        await api.updateRelationship(selectedRelationship.relationship_id, payload);
        setStatus(`Updated relationship ${selectedRelationship.relationship_id}.`);
      } else if (dialogMode === "delete" && selectedRelationship) {
        await api.deleteRelationship(selectedRelationship.relationship_id);
        setStatus(`Deleted relationship ${selectedRelationship.relationship_id}.`);
      }
      closeDialog();
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save relationship.");
    }
  };

  const inferredRelationships = relationships.filter((item) => item.provenance === "inferred");
  const curatedRelationships = relationships.filter((item) => item.provenance !== "inferred");
  const inferredBulkActions: BulkAction[] = mayManageRelationships
    ? [...EXPORT_BULK_ACTIONS, { label: "Promote selected", action: "promote" }]
    : EXPORT_BULK_ACTIONS;

  const columns: DataColumn<RelationshipItem>[] = [
    {
      id: "field",
      header: "Field",
      cell: (item) =>
        mayManageRelationships ? (
          <button
            type="button"
            role="link"
            className="text-primary underline underline-offset-2 hover:no-underline"
            onClick={() => openDialog("edit", item)}
          >
            {item.field}
          </button>
        ) : (
          item.field
        ),
      sortable: true,
      sortValue: (item) => item.field,
    },
    { id: "target", header: "Target", cell: (item) => `${item.target_namespace}.${item.target_entity}`, sortable: true, sortValue: (item) => `${item.target_namespace}.${item.target_entity}` },
    { id: "type", header: "Type", cell: (item) => item.relationship_type, sortable: true, sortValue: (item) => item.relationship_type },
    { id: "provenance", header: "Provenance", cell: (item) => item.provenance, sortable: true, sortValue: (item) => item.provenance },
    createDataTableActionColumn<RelationshipItem>((item) => {
      const actions: DataTableAction<RelationshipItem>[] = [
        { id: "audit", label: "Audit & Log", href: () => `/audit-log?relationship_id=${encodeURIComponent(item.relationship_id)}`, title: () => `View audit for ${item.relationship_id}` },
      ];
      if (mayManageRelationships && item.provenance === "inferred") {
        actions.push({ id: "promote", label: "Promote", onClick: () => void promote(item), title: () => `Promote ${item.field} to curated` });
      }
      if (mayManageRelationships) {
        actions.push({ id: "edit", label: "Edit", onClick: () => openDialog("edit", item), title: () => `Edit ${item.field}` });
        actions.push({ id: "delete", label: "Delete", destructive: true, onClick: () => openDialog("delete", item), title: () => `Delete ${item.field}` });
      }
      return actions;
    }),
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Relationship Explorer</h1>
        <div className="ml-auto flex flex-wrap gap-2">
          <Button variant="secondary" onClick={() => void load()}>Refresh</Button>
          {mayManageRelationships ? <Button onClick={() => openDialog("add")}>Add Relationship</Button> : null}
        </div>
      </header>
      {!mayManageRelationships ? (
        <ActionableError
          title="Read-only relationships"
          message="Relationship curation requires relationship.change permission."
          action={{ href: "/admin/roles?permission=relationship.change", label: "Review roles" }}
        />
      ) : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Entity selection</h2></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4 md:items-end">
          <ProfileSelect id="relationship-profile" />
          <div className="space-y-1">
            <Label htmlFor="rel-namespace">Namespace</Label>
            {namespaceList.length > 0 ? (
              <Select id="rel-namespace" value={namespace} onChange={(event) => setNamespace(event.target.value)}>
                <option value="">Select namespace</option>
                {namespaceList.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
              </Select>
            ) : (
              <Input id="rel-namespace" value={namespace} onChange={(event) => setNamespace(event.target.value)} placeholder="e.g. dbmcp_ui_e2e" />
            )}
          </div>
          <div className="space-y-1">
            <Label htmlFor="rel-entity">Entity</Label>
            {entityList.length > 0 ? (
              <Select id="rel-entity" value={entity} onChange={(event) => setEntity(event.target.value)}>
                <option value="">Select entity</option>
                {entityList.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
              </Select>
            ) : (
              <Input id="rel-entity" value={entity} onChange={(event) => setEntity(event.target.value)} placeholder="e.g. orders" />
            )}
          </div>
          <div className="flex flex-wrap gap-2">
            {mayManageRelationships ? <Button size="sm" variant="secondary" onClick={() => void infer()} title="Auto-detect relationships between entities using schema analysis">Infer Relationships</Button> : null}
            <Button size="sm" onClick={() => void load()} title="Load existing relationship definitions from the database">Load Relationships</Button>
          </div>
        </CardContent>
      </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Persisted relationships</h2></CardHeader>
          <CardContent>
            <DataTable
              ariaLabel="Persisted relationships"
              columns={columns}
              rows={curatedRelationships}
              emptyMessage="No curated relationships found."
              selectable
              bulkActions={EXPORT_BULK_ACTIONS}
              onBulkAction={(action, ids) => {
                if (action === "export") {
                  const set = new Set(ids);
                  exportRowsJson(curatedRelationships.filter((item) => set.has(item.relationship_id)), "db-mcp-relationships-curated.json");
                }
              }}
              columnPickerEnabled
              tableId="db-mcp-relationships-curated"
              getRowId={(item) => item.relationship_id}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Inferred relationships</h2></CardHeader>
          <CardContent>
            <DataTable
              ariaLabel="Inferred relationships"
              columns={columns}
              rows={inferredRelationships}
              emptyMessage="No inferred relationships found."
              selectable
              bulkActions={inferredBulkActions}
              onBulkAction={(action, ids) => {
                if (action === "export") {
                  const set = new Set(ids);
                  exportRowsJson(inferredRelationships.filter((item) => set.has(item.relationship_id)), "db-mcp-relationships-inferred.json");
                } else if (action === "promote") {
                  const set = new Set(ids);
                  void Promise.all(inferredRelationships.filter((item) => set.has(item.relationship_id)).map((item) => promote(item)));
                }
              }}
              columnPickerEnabled
              tableId="db-mcp-relationships-inferred"
              getRowId={(item) => item.relationship_id}
            />
          </CardContent>
        </Card>
      </div>
      {dialogMode === "delete" ? (
        <EntityDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title="Delete relationship"
          fields={DELETE_FIELDS}
          values={{ summary: selectedRelationship ? `${selectedRelationship.namespace}.${selectedRelationship.entity}.${selectedRelationship.field} -> ${selectedRelationship.target_namespace}.${selectedRelationship.target_entity}` : "" }}
          onChange={() => {}}
          onSubmit={() => {
            void submit();
          }}
          onCancel={closeDialog}
          mode="edit"
          submitLabel="Delete"
          extra={<p className="text-sm text-muted-foreground">This removes the stored relationship metadata record.</p>}
        />
      ) : (
        <EntityDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          title={dialogMode === "add" ? "Add Relationship" : "Edit Relationship"}
          body={(
            <form
              className="space-y-4"
              onSubmit={(event) => {
                event.preventDefault();
                void submit();
              }}
            >
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="relationship-source-namespace">Source namespace</Label>
                  <Select
                    id="relationship-source-namespace"
                    value={form.namespace}
                    onChange={(event) => setForm((current) => ({ ...current, namespace: event.target.value, entity: "", field: "" }))}
                  >
                    <option value="">Select namespace</option>
                    {namespaceList.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="relationship-target-namespace">Target namespace</Label>
                  <Select
                    id="relationship-target-namespace"
                    value={form.target_namespace}
                    onChange={(event) => setForm((current) => ({ ...current, target_namespace: event.target.value, target_entity: "", target_field: "" }))}
                  >
                    <option value="">Select namespace</option>
                    {namespaceList.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
                  </Select>
                </div>
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <DiscoveredMultiSelect
                  label="Source entity"
                  mode="single"
                  options={toDiscoveredOptions(sourceEntityOptions)}
                  values={form.entity ? [form.entity] : []}
                  onChange={(values) => setForm((current) => ({ ...current, entity: values[0] ?? "", field: "" }))}
                  placeholder="Select source entity"
                  aria-label="Source entity"
                />
                <DiscoveredMultiSelect
                  label="Target entity"
                  mode="single"
                  options={toDiscoveredOptions(targetEntityOptions)}
                  values={form.target_entity ? [form.target_entity] : []}
                  onChange={(values) => setForm((current) => ({ ...current, target_entity: values[0] ?? "", target_field: "" }))}
                  placeholder="Select target entity"
                  aria-label="Target entity"
                />
                <DiscoveredMultiSelect
                  label="Source field"
                  mode="single"
                  options={toDiscoveredOptions(sourceFieldOptions)}
                  values={form.field ? [form.field] : []}
                  onChange={(values) => setForm((current) => ({ ...current, field: values[0] ?? "" }))}
                  placeholder="Select source field"
                  aria-label="Source field"
                />
                <DiscoveredMultiSelect
                  label="Target field"
                  mode="single"
                  options={toDiscoveredOptions(targetFieldOptions)}
                  values={form.target_field ? [form.target_field] : []}
                  onChange={(values) => setForm((current) => ({ ...current, target_field: values[0] ?? "" }))}
                  placeholder="Select target field"
                  aria-label="Target field"
                />
              </div>

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="relationship-type">Relationship type</Label>
                  <Select id="relationship-type" value={form.relationship_type} onChange={(event) => setForm((current) => ({ ...current, relationship_type: event.target.value }))}>
                    {RELATIONSHIP_TYPE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="relationship-provenance">Provenance</Label>
                  <Select id="relationship-provenance" value={form.provenance} onChange={(event) => setForm((current) => ({ ...current, provenance: event.target.value }))}>
                    {PROVENANCE_OPTIONS.map((item) => <option key={item} value={item}>{item}</option>)}
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label htmlFor="relationship-confidence">Confidence</Label>
                  <Input id="relationship-confidence" type="number" value={form.confidence} onChange={(event) => setForm((current) => ({ ...current, confidence: event.target.value }))} />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="relationship-description">Description</Label>
                  <Input id="relationship-description" value={form.description} onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))} />
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="relationship-metadata-json">Metadata (JSON)</Label>
                <Textarea
                  id="relationship-metadata-json"
                  rows={6}
                  value={form.metadataJson}
                  onChange={(event) => setForm((current) => ({ ...current, metadataJson: event.target.value }))}
                />
              </div>

              <div className="flex items-center gap-2 pt-2">
                <Button type="submit">{dialogMode === "add" ? "Add Relationship" : "Save changes"}</Button>
                <Button type="button" variant="secondary" onClick={closeDialog}>Cancel</Button>
              </div>
            </form>
          )}
        />
      )}
    </div>
  );
}
