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
import { Link, useNavigate, useParams } from "react-router-dom";
import {
  ActionableError,
  Badge,
  Button,
  DataTable,
  MasterDetailLayout,
  Select,
  createDataTableActionColumn,
  type DataColumn,
} from "@cloud-dog/ui";
import { ProfileSelect } from "../components/ProfileSelect";
import { useDbMcpState } from "../state/AppState";
import type { EntityDetail, EntityField, EntityItem, IndexItem, NamespaceItem, RelationshipItem } from "../lib/types";

type NamespaceRow = NamespaceItem & Readonly<{ entityCount?: number | null }>;
type DetailTab = "schema" | "indexes" | "relationships" | "samples";

function hasCatalogRead(profile: { allowed_permissions?: string[] } | null | undefined): boolean {
  const permissions = profile?.allowed_permissions ?? [];
  return permissions.includes("*") || permissions.includes("catalog.read") || permissions.includes("catalogue.read");
}

function encodePathPart(value: string): string {
  return encodeURIComponent(value);
}

function fieldType(field: EntityField): string {
  const record = field as EntityField & { type?: string; nullable?: boolean; default?: unknown };
  return record.type ?? field.types?.join(", ") ?? "unknown";
}

function sampleColumns(rows: Array<Record<string, unknown>>): DataColumn<Record<string, unknown>>[] {
  const keys = Array.from(new Set(rows.flatMap((row) => Object.keys(row)))).slice(0, 8);
  return keys.map((key) => ({
    id: key,
    header: key,
    cell: (row) => {
      const value = row[key];
      if (value === null || value === undefined) return "";
      if (typeof value === "object") return JSON.stringify(value);
      return String(value);
    },
    sortable: true,
    sortValue: (row) => {
      const value = row[key];
      if (typeof value === "number" || typeof value === "string") return value;
      return value === null || value === undefined ? "" : JSON.stringify(value);
    },
  }));
}

const fieldColumns: DataColumn<EntityField>[] = [
  { id: "name", header: "Field", cell: (field) => field.name, sortable: true, sortValue: (field) => field.name },
  { id: "type", header: "Type", cell: fieldType, sortable: true, sortValue: fieldType },
  {
    id: "nullable",
    header: "Nullable",
    cell: (field) => String((field as EntityField & { nullable?: boolean }).nullable ?? ""),
    sortable: true,
    sortValue: (field) => String((field as EntityField & { nullable?: boolean }).nullable ?? ""),
  },
  {
    id: "default",
    header: "Default",
    cell: (field) => String((field as EntityField & { default?: unknown }).default ?? ""),
    sortable: true,
    sortValue: (field) => String((field as EntityField & { default?: unknown }).default ?? ""),
  },
];

export function CataloguePage() {
  const navigate = useNavigate();
  const { profileId = "", namespaceId = "", entityId = "" } = useParams();
  const decodedProfileId = decodeURIComponent(profileId);
  const decodedNamespace = decodeURIComponent(namespaceId);
  const decodedEntity = decodeURIComponent(entityId);
  const { api, profiles, currentProfile, selectedProfileId, setSelectedProfileId, refreshProfiles } = useDbMcpState();
  const effectiveProfileId = decodedProfileId || selectedProfileId || currentProfile?.profile_id || "";
  const effectiveProfile = profiles.find((profile) => profile.profile_id === effectiveProfileId) ?? currentProfile;
  const [namespaces, setNamespaces] = React.useState<NamespaceRow[]>([]);
  const [entities, setEntities] = React.useState<EntityItem[]>([]);
  const [selectedNamespace, setSelectedNamespace] = React.useState(decodedNamespace);
  const [namespacePage, setNamespacePage] = React.useState(1);
  const [entityPage, setEntityPage] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    void refreshProfiles();
  }, [refreshProfiles]);

  React.useEffect(() => {
    if (decodedProfileId && decodedProfileId !== selectedProfileId) {
      setSelectedProfileId(decodedProfileId);
    }
  }, [decodedProfileId, selectedProfileId, setSelectedProfileId]);

  const loadEntities = React.useCallback(async (namespace: string, refresh = false) => {
    if (!effectiveProfileId || !namespace) {
      setEntities([]);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const discovered = await api.discoverEntities({ profile_id: effectiveProfileId, namespace, refresh });
      setEntities(discovered.items);
      setNamespaces((current) => current.map((item) => item.name === namespace ? { ...item, entityCount: discovered.items.length } : item));
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load entities.");
    } finally {
      setLoading(false);
    }
  }, [api, effectiveProfileId]);

  const loadCatalogue = React.useCallback(async (refresh = false) => {
    if (!effectiveProfileId) {
      setNamespaces([]);
      setEntities([]);
      setSelectedNamespace("");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const discovered = await api.discoverNamespaces({ profile_id: effectiveProfileId, refresh });
      const rows = discovered.items.map((item) => ({ ...item, entityCount: null }));
      setNamespaces(rows);
      const nextNamespace = decodedNamespace || selectedNamespace || rows[0]?.name || "";
      setSelectedNamespace(nextNamespace);
      if (nextNamespace) await loadEntities(nextNamespace, refresh);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load catalogue.");
    } finally {
      setLoading(false);
    }
  }, [api, decodedNamespace, effectiveProfileId, loadEntities, selectedNamespace]);

  React.useEffect(() => {
    setSelectedNamespace(decodedNamespace);
  }, [decodedNamespace]);

  React.useEffect(() => {
    void loadCatalogue(false);
  }, [loadCatalogue]);

  const permissionError = effectiveProfile && !hasCatalogRead(effectiveProfile)
    ? `Profile ${effectiveProfile.name} does not grant catalog.read.`
    : null;

  const namespaceColumns: DataColumn<NamespaceRow>[] = [
    {
      id: "name",
      header: "Namespace",
      cell: (item) => (
        <button
          className="text-primary underline underline-offset-2 hover:no-underline"
          onClick={() => {
            setSelectedNamespace(item.name);
            void loadEntities(item.name, true);
          }}
          role="link"
          type="button"
        >
          {item.name}
        </button>
      ),
      sortable: true,
      sortValue: (item) => item.name,
    },
    { id: "type", header: "Type", cell: (item) => item.type ?? "namespace", sortable: true, sortValue: (item) => item.type ?? "namespace" },
    { id: "entityCount", header: "Entities", cell: (item) => item.entityCount ?? "-", sortable: true, sortValue: (item) => item.entityCount ?? -1 },
  ];

  const entityColumns: DataColumn<EntityItem>[] = [
    {
      id: "name",
      header: "Entity",
      cell: (item) => (
        <Link
          aria-label={`View entity ${item.name}`}
          className="text-primary underline underline-offset-2 hover:no-underline"
          to={`/catalogue/${encodePathPart(effectiveProfileId)}/${encodePathPart(selectedNamespace)}/${encodePathPart(item.name)}`}
        >
          {item.name}
        </Link>
      ),
      sortable: true,
      sortValue: (item) => item.name,
    },
    { id: "type", header: "Type", cell: (item) => item.type ?? "entity", sortable: true, sortValue: (item) => item.type ?? "entity" },
    { id: "indexes", header: "Indexes", cell: (item) => String((item as EntityItem & { index_count?: number }).index_count ?? "-"), sortable: true, sortValue: (item) => (item as EntityItem & { index_count?: number }).index_count ?? -1 },
    { id: "rows", header: "Rows ~", cell: (item) => String((item as EntityItem & { estimated_rows?: number }).estimated_rows ?? "-"), sortable: true, sortValue: (item) => (item as EntityItem & { estimated_rows?: number }).estimated_rows ?? -1 },
    createDataTableActionColumn<EntityItem>((item) => [
      { id: "detail", label: "Entity Detail", href: () => `/catalogue/${encodePathPart(effectiveProfileId)}/${encodePathPart(selectedNamespace)}/${encodePathPart(item.name)}` },
      { id: "data", label: "Data", href: () => `/data/${encodePathPart(effectiveProfileId)}/${encodePathPart(selectedNamespace)}/${encodePathPart(item.name)}` },
    ]),
  ];

  const toolbar = (
    <div className="grid w-full gap-3 lg:grid-cols-[minmax(220px,1fr)_minmax(180px,280px)_auto]">
      <ProfileSelect id="catalogue-profile" />
      <div className="space-y-2">
        <label className="text-sm font-medium" htmlFor="catalogue-namespace">Namespace</label>
        <Select
          disabled={!effectiveProfileId || namespaces.length === 0}
          id="catalogue-namespace"
          value={selectedNamespace}
          onChange={(event) => {
            const namespace = event.target.value;
            setSelectedNamespace(namespace);
            navigate(`/catalogue/${encodePathPart(effectiveProfileId)}/${encodePathPart(namespace)}`);
            void loadEntities(namespace, true);
          }}
        >
          {namespaces.length === 0 ? <option value="">No namespaces</option> : null}
          {namespaces.map((namespace) => <option key={namespace.name} value={namespace.name}>{namespace.name}</option>)}
        </Select>
      </div>
      <div className="flex items-end">
        <Button disabled={loading || !effectiveProfileId} onClick={() => void loadCatalogue(true)} type="button" variant="secondary">
          Refresh discovery
        </Button>
      </div>
    </div>
  );

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Catalogue</h1>
      </header>
      {permissionError ? (
        <ActionableError
          action={{ href: `/admin/profiles?profile_id=${encodePathPart(effectiveProfileId)}&focus=permissions`, label: "Edit profile permissions" }}
          message={permissionError}
        />
      ) : null}
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      <MasterDetailLayout
        detail={decodedEntity ? (
          <EntityDetailPanel
            entity={decodedEntity}
            namespace={decodedNamespace}
            profileId={effectiveProfileId}
          />
        ) : (
          <div className="space-y-3 p-4">
            <h2 className="text-lg font-semibold">Entities{selectedNamespace ? ` in ${selectedNamespace}` : ""}</h2>
            <DataTable
              ariaLabel="Catalogue entities"
              columnPickerEnabled
              columns={entityColumns}
              emptyMessage="Select a namespace to browse entities."
              getRowId={(item) => item.name}
              onPageChange={setEntityPage}
              page={entityPage}
              pageSize={10}
              rows={entities}
              tableId="db-mcp-catalogue-entities"
            />
          </div>
        )}
        detailLabel={decodedEntity ? "Entity detail" : "Entities"}
        master={(
          <div className="space-y-3 p-4">
            <h2 className="text-lg font-semibold">Namespaces</h2>
            <DataTable
              ariaLabel="Catalogue namespaces"
              columnPickerEnabled
              columns={namespaceColumns}
              emptyMessage="No namespaces available for the selected profile."
              getRowId={(item) => item.name}
              onPageChange={setNamespacePage}
              page={namespacePage}
              pageSize={8}
              rows={namespaces}
              tableId="db-mcp-catalogue-namespaces"
            />
          </div>
        )}
        masterLabel="Namespaces"
        toolbar={toolbar}
      />
    </div>
  );
}

function EntityDetailPanel({ profileId, namespace, entity }: { profileId: string; namespace: string; entity: string }) {
  const { api } = useDbMcpState();
  const [activeTab, setActiveTab] = React.useState<DetailTab>("schema");
  const [detail, setDetail] = React.useState<EntityDetail | null>(null);
  const [fields, setFields] = React.useState<EntityField[]>([]);
  const [indexes, setIndexes] = React.useState<IndexItem[]>([]);
  const [samples, setSamples] = React.useState<Array<Record<string, unknown>>>([]);
  const [relationships, setRelationships] = React.useState<RelationshipItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!profileId || !namespace || !entity) return;
    setError(null);
    void Promise.all([
      api.getEntity(profileId, namespace, entity),
      api.describeFields(profileId, namespace, entity),
      api.listIndexes(profileId, namespace, entity),
      api.sampleShapes(profileId, namespace, entity, 5),
      api.listRelationships(profileId, namespace, entity),
    ])
      .then(([detailResult, fieldsResult, indexResult, sampleResult, relationshipResult]) => {
        setDetail(detailResult);
        setFields((fieldsResult.fields ?? []) as EntityField[]);
        setIndexes(indexResult);
        setSamples(sampleResult);
        setRelationships(relationshipResult);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Failed to load entity detail."));
  }, [api, entity, namespace, profileId]);

  const overview = {
    type: detail?.info?.type ?? detail?.options?.type ?? "entity",
    indexes: indexes.length,
    relationships: relationships.length,
    estimated_rows: detail?.document_count ?? "unknown",
  };

  return (
    <div className="space-y-4 p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold">{profileId} / {namespace} / {entity}</h2>
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            <Badge>Type: {String(overview.type)}</Badge>
            <Badge>Indexes: {overview.indexes}</Badge>
            <Badge>Relationships: {overview.relationships}</Badge>
            <Badge>Rows: {String(overview.estimated_rows)}</Badge>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild size="sm" variant="secondary">
            <Link to={`/data/${encodePathPart(profileId)}/${encodePathPart(namespace)}/${encodePathPart(entity)}`}>Data</Link>
          </Button>
          <Button asChild size="sm">
            <Link to={`/schema/${encodePathPart(profileId)}?namespace=${encodePathPart(namespace)}&entity=${encodePathPart(entity)}`}>Schema</Link>
          </Button>
        </div>
      </div>
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      <div aria-label="Entity detail tabs" className="flex flex-wrap gap-2" role="tablist">
        {(["schema", "indexes", "relationships", "samples"] as DetailTab[]).map((tab) => (
          <Button
            aria-selected={activeTab === tab}
            key={tab}
            onClick={() => setActiveTab(tab)}
            role="tab"
            size="sm"
            type="button"
            variant={activeTab === tab ? "default" : "secondary"}
          >
            {tab === "samples" ? "Sample rows" : tab[0].toUpperCase() + tab.slice(1)}
          </Button>
        ))}
      </div>
      {activeTab === "schema" ? (
        <DataTable
          ariaLabel="Schema fields"
          columnPickerEnabled
          columns={fieldColumns}
          emptyMessage="No fields available."
          getRowId={(field) => field.name}
          rows={fields}
          tableId="db-mcp-entity-fields"
        />
      ) : null}
      {activeTab === "indexes" ? (
        <div className="grid gap-3">
          {indexes.length === 0 ? <p className="text-sm text-muted-foreground">No indexes available.</p> : null}
          {indexes.map((index) => (
            <section className="rounded-md border p-3" key={index.name}>
              <h3 className="text-sm font-semibold">{index.name}</h3>
              <div className="mt-2 grid gap-2 text-sm md:grid-cols-3">
                <span>Keys: {JSON.stringify(index.keys)}</span>
                <span>Unique: {index.unique ? "Yes" : "No"}</span>
                <span>Sparse: {index.sparse ? "Yes" : "No"}</span>
              </div>
            </section>
          ))}
        </div>
      ) : null}
      {activeTab === "relationships" ? (
        <div className="grid gap-3">
          {relationships.length === 0 ? <p className="text-sm text-muted-foreground">No relationships stored.</p> : null}
          {relationships.map((relationship) => (
            <section className="rounded-md border p-3" key={relationship.relationship_id}>
              <h3 className="text-sm font-semibold">{relationship.field} {"->"} {relationship.target_namespace}.{relationship.target_entity}</h3>
              <div className="mt-2 flex flex-wrap gap-2 text-sm">
                <Badge>{relationship.relationship_type}</Badge>
                <Badge>{relationship.provenance}</Badge>
                {relationship.confidence != null ? <Badge>{Math.round(relationship.confidence * 100)}%</Badge> : null}
              </div>
            </section>
          ))}
        </div>
      ) : null}
      {activeTab === "samples" ? (
        <DataTable
          ariaLabel="Sample rows"
          columnPickerEnabled
          columns={sampleColumns(samples)}
          emptyMessage="No sample rows available."
          getRowId={(row) => String(row.id ?? row._id ?? JSON.stringify(row))}
          rows={samples}
          tableId="db-mcp-entity-samples"
        />
      ) : null}
    </div>
  );
}
