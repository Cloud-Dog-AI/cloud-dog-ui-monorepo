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
  ActionableError,
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
  createDataTableActionColumn,
  type DataColumn,
  type EntityFieldDef,
  type SavedQueryOption,
  SavedQueryControls,
} from "@cloud-dog/ui";
import { exportRowsJson } from "../lib/exportRows";
import { ProfileSelect } from "../components/ProfileSelect";
import { FilterBuilder } from "../components/FilterBuilder";
import { JsonPanel } from "../components/JsonPanel";
import { canCreateOrUpdateData, canDeleteData } from "../lib/access";
import { buildFilterPayload, emptyFilterCondition } from "../lib/filter";
import { useDbMcpState } from "../state/AppState";
import type { EntityItem, FilterGroupDraft, NamespaceItem, SavedQuerySummary } from "../lib/types";

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

function profileAllowsDataMutation(profile: { allowed_permissions?: string[] } | null | undefined): boolean {
  const permissions = profile?.allowed_permissions ?? [];
  return permissions.includes("*") || permissions.some((permission) => ["data.create", "data.update", "data.delete"].includes(permission));
}

export function DataBrowserPage() {
  const auth = useAuth();
  const { profileId = "", ns = "", entity = "" } = useParams();
  const routeProfileId = decodeURIComponent(profileId);
  const routeNamespace = decodeURIComponent(ns);
  const routeEntity = decodeURIComponent(entity);
  const { api, currentProfile, setSelectedProfileId } = useDbMcpState();
  const [namespaces, setNamespaces] = React.useState<NamespaceItem[]>([]);
  const [entities, setEntities] = React.useState<EntityItem[]>([]);
  const [activeNamespace, setActiveNamespace] = React.useState(routeNamespace);
  const [activeEntity, setActiveEntity] = React.useState(routeEntity);
  const [limit, setLimit] = React.useState("10");
  const [filter, setFilter] = React.useState<FilterGroupDraft>(EMPTY_FILTER);
  const [savedQueries, setSavedQueries] = React.useState<SavedQuerySummary[]>([]);
  const [selectedSavedQueryId, setSelectedSavedQueryId] = React.useState("");
  const [queryDraftName, setQueryDraftName] = React.useState("");
  const [savedQueriesLoading, setSavedQueriesLoading] = React.useState(false);
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

  const profileAllowsWrites = profileAllowsDataMutation(currentProfile);
  const mayCreateOrUpdateData = canCreateOrUpdateData(auth.user) && profileAllowsWrites;
  const mayDeleteData = canDeleteData(auth.user) && profileAllowsWrites;
  const filterPayload = React.useMemo(() => buildFilterPayload(filter), [filter]);
  const fieldMasks = React.useMemo(() => currentProfile?.field_masks ?? {}, [currentProfile?.field_masks]);

  React.useEffect(() => {
    if (routeProfileId) {
      setSelectedProfileId(routeProfileId);
    }
  }, [routeProfileId, setSelectedProfileId]);

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

  const loadSavedQueries = React.useCallback(async () => {
    setSavedQueriesLoading(true);
    try {
      const items = await api.listSavedQueries("data-browser");
      setSavedQueries(items);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load saved queries.");
    } finally {
      setSavedQueriesLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    void loadSavedQueries();
  }, [loadSavedQueries]);

  const savedQueryOptions = React.useMemo<SavedQueryOption[]>(
    () =>
      savedQueries.map((query) => ({
        id: String(query.id),
        name: query.name,
        description: query.description,
        shared: query.shared,
      })),
    [savedQueries]
  );

  const saveQuery = React.useCallback(async () => {
    const name = queryDraftName.trim();
    if (!name) {
      setError("Query name is required.");
      return;
    }
    if (!currentProfile || !activeNamespace || !activeEntity) {
      setError("Select a profile, namespace and entity before saving a query.");
      return;
    }
    try {
      const saved = await api.createSavedQuery({
        page_key: "data-browser",
        name,
        payload: {
          profile_id: currentProfile.profile_id,
          namespace: activeNamespace,
          entity: activeEntity,
          limit,
          filter,
        },
        description: "",
        shared: false,
      });
      setSelectedSavedQueryId(String(saved.id));
      setStatus(`Saved query ${name}.`);
      setError(null);
      await loadSavedQueries();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save query.");
    }
  }, [activeEntity, activeNamespace, api, currentProfile, filter, limit, loadSavedQueries, queryDraftName]);

  const selectSavedQuery = React.useCallback(
    (option: SavedQueryOption | null) => {
      setSelectedSavedQueryId(option?.id ?? "");
      if (!option) return;
      const saved = savedQueries.find((query) => String(query.id) === option.id);
      if (!saved) return;
      const payload = saved.payload;
      if (typeof payload.profile_id === "string" && payload.profile_id.trim()) {
        setSelectedProfileId(payload.profile_id);
      }
      if (typeof payload.namespace === "string") {
        setActiveNamespace(payload.namespace);
      }
      if (typeof payload.entity === "string") {
        setActiveEntity(payload.entity);
      }
      if (typeof payload.limit === "string" || typeof payload.limit === "number") {
        setLimit(String(payload.limit));
      }
      if (payload.filter && typeof payload.filter === "object" && !Array.isArray(payload.filter)) {
        setFilter(payload.filter as FilterGroupDraft);
      }
      setQueryDraftName(saved.name);
      setStatus(`Loaded saved query ${saved.name}.`);
      setError(null);
    },
    [savedQueries, setSelectedProfileId]
  );

  const deleteSavedQuery = React.useCallback(
    async (option: SavedQueryOption) => {
      try {
        await api.deleteSavedQuery(Number(option.id));
        setSelectedSavedQueryId("");
        setQueryDraftName("");
        setStatus(`Deleted saved query ${option.name}.`);
        setError(null);
        await loadSavedQueries();
      } catch (deleteError) {
        setError(deleteError instanceof Error ? deleteError.message : "Failed to delete saved query.");
      }
    },
    [api, loadSavedQueries]
  );

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
    const findRawRow = (row: Record<string, unknown>) =>
      rows.find((item, index) => String(item._id ?? item.id ?? index + 1) === row.__row_id) ?? null;
    return [
      ...baseColumns,
      createDataTableActionColumn<Record<string, unknown>>((row) => {
        const rawRow = findRawRow(row);
        return [
          {
            id: "view",
            label: "View",
            onClick: () => {
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
            },
          },
          ...(mayCreateOrUpdateData
            ? [
                {
                  id: "update",
                  label: "Update",
                  onClick: () => {
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
                  },
                },
              ]
            : []),
          ...(mayDeleteData
            ? [
                {
                  id: "delete",
                  label: "Delete",
                  destructive: true,
                  onClick: () => {
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
                  },
                },
              ]
            : []),
        ];
      }),
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
        <p className="text-sm text-muted-foreground" aria-label="Data Browser scope">
          {currentProfile && activeNamespace && activeEntity
            ? `${currentProfile.profile_id} / ${activeNamespace} / ${activeEntity}`
            : "Select a profile, namespace and entity"}
        </p>
      </header>
      {!mayCreateOrUpdateData && currentProfile ? (
        <ActionableError
          title="Read-only profile"
          message="This session can read data but cannot create, update or delete records. Grant data.create, data.update or data.delete before running write actions."
          action={{
            href: `/admin/profiles?profile_id=${encodeURIComponent(currentProfile.profile_id)}&focus=permissions`,
            label: "Edit profile permissions",
          }}
        />
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
          <SavedQueryControls
            queries={savedQueryOptions}
            selectedId={selectedSavedQueryId}
            draftName={queryDraftName}
            onDraftNameChange={setQueryDraftName}
            onSelect={selectSavedQuery}
            onSave={() => void saveQuery()}
            onDelete={(query) => void deleteSavedQuery(query)}
            loading={savedQueriesLoading}
            disabled={!currentProfile || !activeNamespace || !activeEntity}
          />
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
            ariaLabel="Data Browser results"
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
                exportRowsJson(selected, `data-export-${new Date().toISOString().slice(0, 10)}.json`);
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
