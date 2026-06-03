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
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  EntityDialog,
  Input,
  Label,
  Select,
  Textarea,
  type DataColumn,
  type EntityFieldDef,
} from "@cloud-dog/ui";
import { ProfileSelect } from "../components/ProfileSelect";
import { canManageRelationships } from "../lib/access";
import { useDbMcpState } from "../state/AppState";
import type { EntityItem, NamespaceItem, RelationshipItem } from "../lib/types";

type DialogMode = "add" | "edit" | "delete";

type RelationshipFormState = Readonly<{
  namespace: string;
  entity: string;
  field: string;
  target_namespace: string;
  target_entity: string;
  relationship_type: string;
  provenance: string;
  confidence: string;
  description: string;
  metadataJson: string;
}>;

const RELATIONSHIP_FIELDS: EntityFieldDef[] = [
  { name: "namespace", label: "Namespace", type: "text", required: true },
  { name: "entity", label: "Entity", type: "text", required: true },
  { name: "field", label: "Field", type: "text", required: true },
  { name: "target_namespace", label: "Target namespace", type: "text", required: true },
  { name: "target_entity", label: "Target entity", type: "text", required: true },
  {
    name: "relationship_type",
    label: "Relationship type",
    type: "select",
    options: ["reference_candidate", "curated_reference", "join_key", "foreign_key", "manual_link"],
  },
  {
    name: "provenance",
    label: "Provenance",
    type: "select",
    options: ["inferred", "curated", "manual"],
  },
  { name: "confidence", label: "Confidence", type: "number" },
  { name: "description", label: "Description", type: "text" },
];

const DELETE_FIELDS: EntityFieldDef[] = [
  { name: "summary", label: "Relationship", type: "text", readOnly: true },
];

function toFormState(item: RelationshipItem | null, namespace: string, entity: string): RelationshipFormState {
  return {
    namespace: item?.namespace ?? namespace,
    entity: item?.entity ?? entity,
    field: item?.field ?? "customer_id",
    target_namespace: item?.target_namespace ?? namespace,
    target_entity: item?.target_entity ?? "",
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
        metadata: parseMetadataJson(form.metadataJson),
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

  const columns: DataColumn<RelationshipItem>[] = [
    { id: "field", header: "Field", cell: (item) => item.field, sortable: true, sortValue: (item) => item.field },
    { id: "target", header: "Target", cell: (item) => `${item.target_namespace}.${item.target_entity}`, sortable: true, sortValue: (item) => `${item.target_namespace}.${item.target_entity}` },
    { id: "type", header: "Type", cell: (item) => item.relationship_type, sortable: true, sortValue: (item) => item.relationship_type },
    { id: "provenance", header: "Provenance", cell: (item) => item.provenance, sortable: true, sortValue: (item) => item.provenance },
    {
      id: "actions",
      header: "Actions",
      cell: (item) => (
        <div className="flex flex-wrap gap-2">
          {mayManageRelationships && item.provenance === "inferred" ? (
            <Button size="sm" onClick={() => void promote(item)}>Promote</Button>
          ) : null}
          {mayManageRelationships ? <Button size="sm" variant="secondary" onClick={() => openDialog("edit", item)}>Edit</Button> : null}
          {mayManageRelationships ? <Button size="sm" variant="destructive" onClick={() => openDialog("delete", item)}>Delete</Button> : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Relationship Explorer</h1>
        {mayManageRelationships ? <Button onClick={() => openDialog("add")}>Create manual relationship</Button> : null}
      </header>
      {!mayManageRelationships ? (
        <p className="text-sm text-muted-foreground">Relationship curation requires the <span className="font-medium">relationship.change</span> permission.</p>
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
              columns={columns}
              rows={curatedRelationships}
              emptyMessage="No curated relationships found."
              tableId="db-mcp-relationships-curated"
              getRowId={(item) => item.relationship_id}
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Inferred relationships</h2></CardHeader>
          <CardContent>
            <DataTable
              columns={columns}
              rows={inferredRelationships}
              emptyMessage="No inferred relationships found."
              tableId="db-mcp-relationships-inferred"
              getRowId={(item) => item.relationship_id}
            />
          </CardContent>
        </Card>
      </div>
      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={
          dialogMode === "add"
            ? "Create relationship"
            : dialogMode === "edit"
              ? "Edit relationship"
              : "Delete relationship"
        }
        fields={dialogMode === "delete" ? DELETE_FIELDS : RELATIONSHIP_FIELDS}
        values={
          dialogMode === "delete"
            ? { summary: selectedRelationship ? `${selectedRelationship.namespace}.${selectedRelationship.entity}.${selectedRelationship.field} -> ${selectedRelationship.target_namespace}.${selectedRelationship.target_entity}` : "" }
            : (form as unknown as Record<string, unknown>)
        }
        onChange={(name, value) => {
          if (dialogMode === "delete") return;
          setForm((current) => ({ ...current, [name]: String(value ?? "") }));
        }}
        onSubmit={() => {
          void submit();
        }}
        onCancel={closeDialog}
        mode={dialogMode === "delete" ? "edit" : dialogMode === "add" ? "add" : "edit"}
        submitLabel={dialogMode === "delete" ? "Delete" : dialogMode === "edit" ? "Save changes" : "Create relationship"}
        extra={dialogMode === "delete" ? (
          <p className="text-sm text-muted-foreground">This removes the stored relationship metadata record.</p>
        ) : (
          <div className="space-y-2">
            <Label htmlFor="relationship-metadata-json">Metadata (JSON)</Label>
            <Textarea
              id="relationship-metadata-json"
              rows={6}
              value={form.metadataJson}
              onChange={(event) => setForm((current) => ({ ...current, metadataJson: event.target.value }))}
            />
          </div>
        )}
      />
    </div>
  );
}
