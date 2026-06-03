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
import { Link, useParams } from "react-router-dom";
import { Card, CardContent, CardHeader, DataTable, type DataColumn } from "@cloud-dog/ui";
import { JsonPanel } from "../components/JsonPanel";
import { useDbMcpState } from "../state/AppState";
import type { EntityDetail, EntityField, IndexItem, RelationshipItem } from "../lib/types";

const actionLinkClass =
  "inline-flex h-9 items-center justify-center rounded-md px-3 text-sm font-medium transition-colors " +
  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";
const secondaryActionLinkClass = `${actionLinkClass} bg-secondary text-secondary-foreground hover:bg-secondary/80`;
const primaryActionLinkClass = `${actionLinkClass} bg-primary text-primary-foreground hover:bg-primary/90`;

export function EntityDetailPage() {
  const { ns = "", entity = "" } = useParams();
  const namespace = decodeURIComponent(ns);
  const entityName = decodeURIComponent(entity);
  const { api, currentProfile } = useDbMcpState();
  const [detail, setDetail] = React.useState<EntityDetail | null>(null);
  const [fields, setFields] = React.useState<EntityField[]>([]);
  const [indexes, setIndexes] = React.useState<IndexItem[]>([]);
  const [samples, setSamples] = React.useState<Array<Record<string, unknown>>>([]);
  const [relationships, setRelationships] = React.useState<RelationshipItem[]>([]);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    if (!currentProfile) return;
    void Promise.all([
      api.getEntity(currentProfile.profile_id, namespace, entityName),
      api.describeFields(currentProfile.profile_id, namespace, entityName),
      api.listIndexes(currentProfile.profile_id, namespace, entityName),
      api.sampleShapes(currentProfile.profile_id, namespace, entityName, 3),
      api.listRelationships(currentProfile.profile_id, namespace, entityName),
    ])
      .then(([detailResult, fieldsResult, indexResult, sampleResult, relationshipResult]) => {
        setDetail(detailResult);
        setFields((fieldsResult.fields ?? []) as EntityField[]);
        setIndexes(indexResult);
        setSamples(sampleResult);
        setRelationships(relationshipResult);
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Failed to load entity detail."));
  }, [api, currentProfile, entityName, namespace]);

  const fieldColumns: DataColumn<EntityField>[] = [
    { id: "name", header: "Field", cell: (item) => item.name, sortable: true, sortValue: (item) => item.name },
    { id: "types", header: "Types", cell: (item) => item.types?.join(", ") ?? "unknown", sortable: true, sortValue: (item) => item.types?.join(", ") ?? "unknown" },
  ];
  const indexColumns: DataColumn<IndexItem>[] = [
    { id: "name", header: "Index", cell: (item) => item.name, sortable: true, sortValue: (item) => item.name },
    { id: "keys", header: "Keys", cell: (item) => JSON.stringify(item.keys), sortable: true, sortValue: (item) => JSON.stringify(item.keys) },
    { id: "unique", header: "Unique", cell: (item) => (item.unique ? "Yes" : "No"), sortable: true, sortValue: (item) => (item.unique ? 1 : 0) },
    { id: "sparse", header: "Sparse", cell: (item) => (item.sparse ? "Yes" : "No"), sortable: true, sortValue: (item) => (item.sparse ? 1 : 0) },
  ];
  const relationshipColumns: DataColumn<RelationshipItem>[] = [
    { id: "field", header: "Field", cell: (item) => item.field, sortable: true, sortValue: (item) => item.field },
    { id: "target", header: "Target", cell: (item) => `${item.target_namespace}.${item.target_entity}`, sortable: true, sortValue: (item) => `${item.target_namespace}.${item.target_entity}` },
    { id: "type", header: "Type", cell: (item) => item.relationship_type, sortable: true, sortValue: (item) => item.relationship_type },
    { id: "provenance", header: "Provenance", cell: (item) => item.provenance, sortable: true, sortValue: (item) => item.provenance },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Entity Detail</h1>
        <Link
          className={secondaryActionLinkClass}
          to={`/data/${encodeURIComponent(namespace)}/${encodeURIComponent(entityName)}`}
        >
          Open data browser
        </Link>
        <Link
          className={primaryActionLinkClass}
          to={`/relationships?namespace=${encodeURIComponent(namespace)}&entity=${encodeURIComponent(entityName)}`}
        >
          Open relationships
        </Link>
      </header>
      <p className="text-sm text-muted-foreground">{namespace}.{entityName}</p>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <div className="grid gap-6 xl:grid-cols-2">
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Schema</h2></CardHeader>
          <CardContent>
            <DataTable columns={fieldColumns} rows={fields} emptyMessage="No fields discovered." tableId="db-mcp-entity-fields" getRowId={(item) => item.name} />
          </CardContent>
        </Card>
        <Card>
          <CardHeader><h2 className="text-lg font-semibold">Indexes</h2></CardHeader>
          <CardContent>
            <DataTable columns={indexColumns} rows={indexes} emptyMessage="No indexes available." tableId="db-mcp-entity-indexes" getRowId={(item) => item.name} />
          </CardContent>
        </Card>
      </div>
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Relationships</h2></CardHeader>
        <CardContent>
          <DataTable
            columns={relationshipColumns}
            rows={relationships}
            emptyMessage="No relationships stored."
            tableId="db-mcp-entity-relationships"
            getRowId={(item) => item.relationship_id}
          />
        </CardContent>
      </Card>
      <div className="grid gap-6 xl:grid-cols-2">
        <JsonPanel
          title="Entity metadata"
          value={detail ?? { namespace, entity: entityName }}
        />
        <JsonPanel
          title="Sample document shapes"
          value={samples}
        />
      </div>
    </div>
  );
}
