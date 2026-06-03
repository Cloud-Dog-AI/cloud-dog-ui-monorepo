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
import { useParams } from "react-router-dom";
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
import { FilterBuilder } from "../components/FilterBuilder";
import { JsonPanel } from "../components/JsonPanel";
import { canCreateOrUpdateData, canDeleteData } from "../lib/access";
import { buildFilterPayload, emptyFilterCondition } from "../lib/filter";
import { useDbMcpState } from "../state/AppState";
import type { EntityItem, FilterGroupDraft, NamespaceItem } from "../lib/types";

const EMPTY_FILTER: FilterGroupDraft = {
  op: "and",
  conditions: [emptyFilterCondition()],
};

type MutationMode = "create" | "update" | "delete" | "view";

type MutationFormState = Readonly<{
  namespace: string;
  entity: string;
  documentJson: string;
  filterJson: string;
  updateJson: string;
}>;

const MUTATION_FIELDS: EntityFieldDef[] = [
  { name: "namespace", label: "Namespace", type: "text", readOnly: true },
  { name: "entity", label: "Entity", type: "text", readOnly: true },
];

function formatCellValue(value: unknown): string {
  if (value == null) return "";
  if (typeof value === "string") return value;
  if (typeof value === "number" || typeof value === "boolean") return String(value);
  return JSON.stringify(value);
}

function visuallyStableMask(value: string): string {
  return value.split("").join("\u2060");
}

function parseJson(value: string): Record<string, unknown> {
  if (!value.trim()) return {};
  return JSON.parse(value) as Record<string, unknown>;
}

function deriveRowFilter(row: Record<string, unknown>): Record<string, unknown> {
  if ("_id" in row) {
    return { field: "_id", operator: "eq", value: row._id };
  }
  if ("id" in row) {
    return { field: "id", operator: "eq", value: row.id };
  }
  return {};
}

export function DataBrowserPage() {
  const auth = useAuth();
  const { ns = "", entity = "" } = useParams();
  const routeNamespace = decodeURIComponent(ns);
  const routeEntity = decodeURIComponent(entity);
  const { api, currentProfile } = useDbMcpState();
  const [namespaces, setNamespaces] = React.useState<NamespaceItem[]>([]);
  const [entities, setEntities] = React.useState<EntityItem[]>([]);
  const [activeNamespace, setActiveNamespace] = React.useState(routeNamespace);
  const [activeEntity, setActiveEntity] = React.useState(routeEntity);
  const [limit, setLimit] = React.useState("10");
  const [filter, setFilter] = React.useState<FilterGroupDraft>(EMPTY_FILTER);
  const [rows, setRows] = React.useState<Array<Record<string, unknown>>>([]);
  const [count, setCount] = React.useState<number | null>(null);
  const [page, setPage] = React.useState(1);
  const [mutationOpen, setMutationOpen] = React.useState(false);
  const [mutationMode, setMutationMode] = React.useState<MutationMode>("view");
  const [mutationForm, setMutationForm] = React.useState<MutationFormState>({
    namespace: routeNamespace,
    entity: routeEntity,
    documentJson: "{}",
    filterJson: JSON.stringify(buildFilterPayload(EMPTY_FILTER), null, 2),
    updateJson: JSON.stringify({ "$set": {} }, null, 2),
  });
  const [selectedRow, setSelectedRow] = React.useState<Record<string, unknown> | null>(null);
  const [showFilterPreview, setShowFilterPreview] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const mayCreateOrUpdateData = canCreateOrUpdateData(auth.user);
  const mayDeleteData = canDeleteData(auth.user);
  const filterPayload = React.useMemo(() => buildFilterPayload(filter), [filter]);
  const fieldMasks = currentProfile?.field_masks ?? {};

  React.useEffect(() => {
    setActiveNamespace(routeNamespace);
    setActiveEntity(routeEntity);
  }, [routeEntity, routeNamespace]);

  React.useEffect(() => {
    if (!currentProfile) return;
    void api.listNamespaces(currentProfile.profile_id)
      .then((items) => {
        setNamespaces(items);
        setActiveNamespace((current) => {
          if (current && items.some((item) => item.name === current)) return current;
          if (routeNamespace && items.some((item) => item.name === routeNamespace)) return routeNamespace;
          return items[0]?.name ?? "";
        });
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Failed to load namespaces."));
  }, [api, currentProfile, routeNamespace]);

  React.useEffect(() => {
    if (!currentProfile || !activeNamespace) {
      setEntities([]);
      return;
    }
    void api.listEntities(currentProfile.profile_id, activeNamespace)
      .then((items) => {
        setEntities(items);
        setActiveEntity((current) => {
          if (current && items.some((item) => item.name === current)) return current;
          if (routeEntity && items.some((item) => item.name === routeEntity)) return routeEntity;
          return items[0]?.name ?? "";
        });
      })
      .catch((loadError) => setError(loadError instanceof Error ? loadError.message : "Failed to load entities."));
  }, [activeNamespace, api, currentProfile, routeEntity]);

  const execute = React.useCallback(async () => {
    if (!currentProfile || !activeNamespace || !activeEntity) return;
    setError(null);
    try {
      const [dataResult, countResult] = await Promise.all([
        api.dataRead({
          profile_id: currentProfile.profile_id,
          namespace: activeNamespace,
          entity: activeEntity,
          limit: Number(limit) || 10,
          offset: 0,
          filter: filterPayload,
        }),
        api.dataCount({
          profile_id: currentProfile.profile_id,
          namespace: activeNamespace,
          entity: activeEntity,
          filter: filterPayload,
        }),
      ]);
      setRows(dataResult.items);
      setCount(countResult.count);
      setPage(1);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to read data.");
    }
  }, [activeEntity, activeNamespace, api, currentProfile, filterPayload, limit]);

  React.useEffect(() => {
    void execute();
  }, [execute]);

  const visibleRows = React.useMemo(() => {
    const hiddenFields = new Set(currentProfile?.field_exclusions ?? []);
    return rows.map((row, index) => {
      const nextRow: Record<string, unknown> = { __row_id: String(row._id ?? row.id ?? index + 1) };
      for (const [key, value] of Object.entries(row)) {
        if (hiddenFields.has(key)) continue;
        nextRow[key] = key in fieldMasks ? fieldMasks[key] : value;
      }
      return nextRow;
    });
  }, [currentProfile, fieldMasks, rows]);
  const firstMaskedRowIdByKey = React.useMemo(() => {
    const first: Record<string, string> = {};
    for (const row of visibleRows) {
      for (const [key, mask] of Object.entries(fieldMasks)) {
        if (!(key in first) && row[key] === mask) {
          first[key] = String(row.__row_id ?? "");
        }
      }
    }
    return first;
  }, [fieldMasks, visibleRows]);

  const dataColumns = React.useMemo<DataColumn<Record<string, unknown>>[]>(() => {
    const keys = Array.from(new Set(visibleRows.flatMap((row) => Object.keys(row)))).filter((key) => key !== "__row_id");
    const baseColumns: DataColumn<Record<string, unknown>>[] = keys.map((key) => ({
      id: key,
      header: key,
      cell: (row) => {
        const value = formatCellValue(row[key]);
        if (key in fieldMasks && value === fieldMasks[key] && firstMaskedRowIdByKey[key] !== String(row.__row_id ?? "")) {
          return visuallyStableMask(value);
        }
        return value;
      },
      sortable: true,
      sortValue: (row) => formatCellValue(row[key]),
    }));
    return [
      ...baseColumns,
      {
        id: "actions",
        header: "Actions",
        cell: (row) => {
          const rawRow = rows.find((item, index) => String(item._id ?? item.id ?? index + 1) === row.__row_id) ?? null;
          return (
            <div className="flex flex-wrap gap-2">
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setSelectedRow(rawRow);
                  setMutationMode("view");
                  setMutationForm({
                    namespace: activeNamespace,
                    entity: activeEntity,
                    documentJson: JSON.stringify(rawRow ?? {}, null, 2),
                    filterJson: JSON.stringify(deriveRowFilter(rawRow ?? {}), null, 2),
                    updateJson: JSON.stringify({ "$set": rawRow ?? {} }, null, 2),
                  });
                  setMutationOpen(true);
                }}
              >
                View
              </Button>
              {mayCreateOrUpdateData ? (
                <Button
                  size="sm"
                  onClick={() => {
                    setSelectedRow(rawRow);
                    setMutationMode("update");
                    setMutationForm({
                      namespace: activeNamespace,
                      entity: activeEntity,
                      documentJson: "{}",
                      filterJson: JSON.stringify(deriveRowFilter(rawRow ?? {}), null, 2),
                      updateJson: JSON.stringify({ "$set": rawRow ?? {} }, null, 2),
                    });
                    setMutationOpen(true);
                  }}
                >
                  Update
                </Button>
              ) : null}
              {mayDeleteData ? (
                <Button
                  size="sm"
                  variant="destructive"
                  onClick={() => {
                    setSelectedRow(rawRow);
                    setMutationMode("delete");
                    setMutationForm({
                      namespace: activeNamespace,
                      entity: activeEntity,
                      documentJson: "{}",
                      filterJson: JSON.stringify(deriveRowFilter(rawRow ?? {}), null, 2),
                      updateJson: JSON.stringify({ "$set": {} }, null, 2),
                    });
                    setMutationOpen(true);
                  }}
                >
                  Delete
                </Button>
              ) : null}
            </div>
          );
        },
      },
    ];
  }, [activeEntity, activeNamespace, fieldMasks, firstMaskedRowIdByKey, mayCreateOrUpdateData, mayDeleteData, rows, visibleRows]);
  const resultsTableId = React.useMemo(
    () =>
      [
        "db-mcp-data-browser-results",
        currentProfile?.profile_id ?? "no-profile",
        activeNamespace || "no-namespace",
        activeEntity || "no-entity",
      ].join(":"),
    [activeEntity, activeNamespace, currentProfile?.profile_id]
  );
  const resultsTableKey = React.useMemo(
    () => `${resultsTableId}:${dataColumns.map((column) => column.id).join(",")}`,
    [dataColumns, resultsTableId]
  );

  const openMutation = (mode: Exclude<MutationMode, "view">) => {
    setMutationMode(mode);
    setSelectedRow(null);
    setMutationForm({
      namespace: activeNamespace,
      entity: activeEntity,
      documentJson: "{}",
      filterJson: JSON.stringify(filterPayload, null, 2),
      updateJson: JSON.stringify({ "$set": {} }, null, 2),
    });
    setMutationOpen(true);
  };

  const submitMutation = async () => {
    if (!currentProfile) return;
    try {
      if (mutationMode === "create") {
        await api.dataCreate({
          profile_id: currentProfile.profile_id,
          namespace: mutationForm.namespace,
          entity: mutationForm.entity,
          document: parseJson(mutationForm.documentJson),
        });
        setStatus(`Created document in ${mutationForm.namespace}.${mutationForm.entity}.`);
      } else if (mutationMode === "update") {
        await api.dataUpdate({
          profile_id: currentProfile.profile_id,
          namespace: mutationForm.namespace,
          entity: mutationForm.entity,
          filter: parseJson(mutationForm.filterJson),
          update: parseJson(mutationForm.updateJson),
        });
        setStatus(`Updated documents in ${mutationForm.namespace}.${mutationForm.entity}.`);
      } else if (mutationMode === "delete") {
        await api.dataDelete({
          profile_id: currentProfile.profile_id,
          namespace: mutationForm.namespace,
          entity: mutationForm.entity,
          filter: parseJson(mutationForm.filterJson),
        });
        setStatus(`Deleted documents from ${mutationForm.namespace}.${mutationForm.entity}.`);
      }
      setMutationOpen(false);
      await execute();
    } catch (mutationError) {
      setError(mutationError instanceof Error ? mutationError.message : "Failed to mutate data.");
    }
  };

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold">Data Browser</h1>
        <p className="text-sm text-muted-foreground">
          {activeNamespace && activeEntity ? `${activeNamespace}.${activeEntity}` : "Select a namespace and entity"}
        </p>
      </header>
      {!mayCreateOrUpdateData ? (
        <p className="text-sm text-muted-foreground">This session is read-only. Data create/update/delete actions require the corresponding data permissions.</p>
      ) : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}

      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Profile scope and selection</h2></CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-4 md:items-end">
          <ProfileSelect id="data-profile" />
          <div className="space-y-2">
            <Label htmlFor="data-namespace">Namespace</Label>
            <Select id="data-namespace" value={activeNamespace} onChange={(event) => setActiveNamespace(event.target.value)}>
              <option value="">Select namespace</option>
              {namespaces.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="data-entity">Entity</Label>
            <Select id="data-entity" value={activeEntity} onChange={(event) => setActiveEntity(event.target.value)}>
              <option value="">Select entity</option>
              {entities.map((item) => <option key={item.name} value={item.name}>{item.name}</option>)}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="data-limit">Result limit</Label>
            <Input id="data-limit" value={limit} onChange={(event) => setLimit(event.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Structured filter builder</h2></CardHeader>
        <CardContent className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <Button size="sm" onClick={() => void execute()} data-testid="data-run-query">Execute query</Button>
            <Button size="sm" variant="secondary" onClick={() => setFilter({ op: "and", conditions: [emptyFilterCondition()] })}>Reset filter</Button>
            {mayCreateOrUpdateData ? <Button size="sm" variant="secondary" onClick={() => openMutation("create")}>Create document</Button> : null}
            {mayCreateOrUpdateData ? <Button size="sm" variant="secondary" onClick={() => openMutation("update")}>Bulk update</Button> : null}
            {mayDeleteData ? <Button size="sm" variant="destructive" onClick={() => openMutation("delete")}>Bulk delete</Button> : null}
          </div>
          <FilterBuilder value={filter} onChange={setFilter} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Results</h2></CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">Matched records: {count ?? "-"}</p>
          <p className="text-sm text-muted-foreground">
            Hidden fields: {currentProfile?.field_exclusions.join(", ") || "none"} | Masks: {Object.keys(currentProfile?.field_masks ?? {}).join(", ") || "none"}
          </p>
          <DataTable
            key={resultsTableKey}
            columns={dataColumns}
            rows={visibleRows}
            emptyMessage="No rows returned."
            page={page}
            pageSize={10}
            onPageChange={setPage}
            selectable={mayDeleteData || mayCreateOrUpdateData}
            bulkActions={[
              ...(mayCreateOrUpdateData ? [{ label: "Export selected", action: "export" }] : []),
              ...(mayDeleteData ? [{ label: "Delete selected", action: "delete" }] : []),
            ]}
            onBulkAction={(action, selectedIds) => {
              if (action === "export") {
                const selected = visibleRows.filter((row) => selectedIds.includes(String(row.__row_id)));
                const blob = new Blob([JSON.stringify(selected, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const a = document.createElement("a");
                a.href = url;
                a.download = `data-export-${new Date().toISOString().slice(0, 10)}.json`;
                a.click();
                URL.revokeObjectURL(url);
              } else if (action === "delete" && currentProfile) {
                void Promise.all(
                  selectedIds.map((rowId) => {
                    const rawRow = rows.find((item, index) => String(item._id ?? item.id ?? index + 1) === rowId);
                    if (!rawRow) return Promise.resolve();
                    return api.dataDelete({
                      profile_id: currentProfile.profile_id,
                      namespace: activeNamespace,
                      entity: activeEntity,
                      filter: deriveRowFilter(rawRow),
                    });
                  })
                ).then(() => {
                  setStatus(`Deleted ${selectedIds.length} document(s).`);
                  void execute();
                });
              }
            }}
            columnPickerEnabled
            tableId={resultsTableId}
            getRowId={(item) => String(item.__row_id)}
          />
        </CardContent>
      </Card>

      <div className="space-y-2">
        <Button variant="secondary" size="sm" onClick={() => setShowFilterPreview((v) => !v)}>
          {showFilterPreview ? "Hide" : "Show"} filter &amp; selection preview
        </Button>
        {showFilterPreview ? (
          <div className="grid gap-6 xl:grid-cols-2">
            <JsonPanel title="Filter payload" value={filterPayload} />
            <JsonPanel title="Selected row" value={selectedRow ?? { note: "Choose View on a row to inspect the masked document shape." }} />
          </div>
        ) : null}
      </div>

      <EntityDialog
        open={mutationOpen}
        onOpenChange={setMutationOpen}
        title={
          mutationMode === "create"
            ? "Create document"
            : mutationMode === "update"
              ? "Update documents"
              : mutationMode === "delete"
                ? "Delete documents"
                : "View document"
        }
        fields={MUTATION_FIELDS}
        values={mutationForm as unknown as Record<string, unknown>}
        onChange={(name, value) => setMutationForm((current) => ({ ...current, [name]: String(value ?? "") }))}
        onSubmit={() => {
          if (mutationMode === "view") {
            setMutationOpen(false);
            return;
          }
          void submitMutation();
        }}
        onCancel={() => setMutationOpen(false)}
        mode={mutationMode === "view" ? "view" : "edit"}
        submitLabel={
          mutationMode === "create"
            ? "Create document"
            : mutationMode === "update"
              ? "Apply update"
              : mutationMode === "delete"
                ? "Delete documents"
                : undefined
        }
        extra={(
          <div className="space-y-4">
            {mutationMode === "create" || mutationMode === "view" ? (
              <div className="space-y-2">
                <Label htmlFor="data-document-json">Document JSON</Label>
                <Textarea
                  id="data-document-json"
                  rows={10}
                  value={mutationForm.documentJson}
                  disabled={mutationMode === "view"}
                  onChange={(event) => setMutationForm((current) => ({ ...current, documentJson: event.target.value }))}
                />
              </div>
            ) : null}
            {mutationMode === "update" || mutationMode === "delete" ? (
              <div className="space-y-2">
                <Label htmlFor="data-filter-json">Filter JSON</Label>
                <Textarea
                  id="data-filter-json"
                  rows={8}
                  value={mutationForm.filterJson}
                  onChange={(event) => setMutationForm((current) => ({ ...current, filterJson: event.target.value }))}
                />
              </div>
            ) : null}
            {mutationMode === "update" ? (
              <div className="space-y-2">
                <Label htmlFor="data-update-json">Update JSON</Label>
                <Textarea
                  id="data-update-json"
                  rows={8}
                  value={mutationForm.updateJson}
                  onChange={(event) => setMutationForm((current) => ({ ...current, updateJson: event.target.value }))}
                />
              </div>
            ) : null}
          </div>
        )}
      />
    </div>
  );
}
