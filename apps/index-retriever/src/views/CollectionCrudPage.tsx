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

// @cloud-dog/app-index-retriever — Collection CRUD workflow.

import * as React from "react";
import { useNavigate } from "react-router-dom";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CodeEditor,
  DataTable,
  EntityDialog,
  EntityForm,
  JsonExplorer,
  RelativeTime,
  RelatedItemsPanel,
  Textarea,
  type DataColumn,
  type EntityFieldDef,
  type EntityFormMode,
} from "@cloud-dog/ui";
import { useIndexRetrieverState } from "../state/AppState";
import type { CollectionRecord, JsonRecord, SourceConfigRecord } from "../lib/types";

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
}

function parseJsonObject(input: string): JsonRecord {
  const text = input.trim();
  if (!text) return {};
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Metadata JSON must be an object.");
  }
  return parsed as JsonRecord;
}

function parseCsv(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function asCollectionRecord(value: unknown): CollectionRecord {
  const record = asRecord(value);
  return {
    profile: String(record.profile ?? "default"),
    collection: String(record.collection ?? ""),
    description: String(record.description ?? ""),
    dimensions: typeof record.dimensions === "number" ? record.dimensions : null,
    distance_metric: String(record.distance_metric ?? "cosine"),
    metadata: asRecord(record.metadata),
    allowed_roles: asStringArray(record.allowed_roles),
  };
}

function applyCollectionEventTimes(records: CollectionRecord[], events: unknown): CollectionRecord[] {
  const rows = Array.isArray(events) ? events.map(asRecord) : [];
  const byId = new Map<string, { created_at?: string; updated_at?: string }>();
  for (const row of rows) {
    if (String(row.entity_type ?? "") !== "collection") continue;
    const entityId = String(row.entity_id ?? "").trim();
    if (!entityId) continue;
    const timestamp = String(row.created_at ?? row.timestamp ?? "").trim();
    if (!timestamp) continue;
    const current = byId.get(entityId) ?? {};
    if (String(row.action ?? "").includes("created") && !current.created_at) current.created_at = timestamp;
    current.updated_at = timestamp;
    byId.set(entityId, current);
  }
  return records.map((record) => ({ ...record, ...byId.get(`${record.profile}:${record.collection}`) }));
}

type CollectionDraft = Readonly<{
  profile: string;
  collection: string;
  description: string;
  dimensions: number;
  distance_metric: string;
  allowed_roles: string;
  metadata_json: string;
}>;

function toDraft(row?: CollectionRecord | null): CollectionDraft {
  return {
    profile: row?.profile ?? "default",
    collection: row?.collection ?? "",
    description: row?.description ?? "",
    dimensions: row?.dimensions ?? 1024,
    distance_metric: row?.distance_metric ?? "cosine",
    allowed_roles: row?.allowed_roles.join(",") || "reader,writer,maintainer,admin",
    metadata_json: JSON.stringify(row?.metadata ?? {}, null, 2),
  };
}

export function CollectionCrudPage() {
  const app = useIndexRetrieverState();
  const { api, captureFailure, recordActivity } = app;
  const navigate = useNavigate();
  const canManageCollections = app.roles.includes("admin");

  const [collections, setCollections] = React.useState<CollectionRecord[]>([]);
  const [selected, setSelected] = React.useState<CollectionRecord | null>(null);
  const [draft, setDraft] = React.useState<CollectionDraft>(toDraft({
    profile: app.sourceConfig.profile,
    collection: app.sourceConfig.collection,
    description: "",
    dimensions: null,
    distance_metric: "cosine",
    metadata: {},
    allowed_roles: [],
  }));
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<EntityFormMode>("add");
  const [relatedItems, setRelatedItems] = React.useState<{ id: string; label: string }[]>([]);
  const [result, setResult] = React.useState<unknown>(null);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const [profileBackends, setProfileBackends] = React.useState<Record<string, string>>({});

  const refreshProfiles = React.useCallback(async () => {
    try {
      const out = asRecord(await api.callTool<JsonRecord>("profiles_list", {}));
      const names = Array.isArray(out.profiles) ? out.profiles.filter((item): item is string => typeof item === "string") : [];
      const detailRows = await Promise.all(
        names.map(async (name) => {
          const detail = asRecord(await api.callTool<JsonRecord>("profile_get", { profile: name }));
          return [name, String(asRecord(detail.profile).backend ?? "chroma")] as const;
        })
      );
      setProfileBackends(Object.fromEntries(detailRows));
    } catch {
      setProfileBackends({});
    }
  }, [api]);

  React.useEffect(() => {
    void refreshProfiles();
  }, [refreshProfiles]);

  const activeBackend = React.useMemo(
    () => profileBackends[draft.profile.trim()] ?? "chroma",
    [draft.profile, profileBackends]
  );
  const metricOptions = React.useMemo(() => {
    if (activeBackend === "opensearch") return ["cosine", "dot", "euclidean"];
    if (activeBackend === "qdrant") return ["cosine", "dot", "euclidean"];
    return ["cosine", "dot", "euclidean"];
  }, [activeBackend]);

  const fields = React.useMemo<EntityFieldDef[]>(
    () => [
      { name: "profile", label: "Profile", type: "text", required: true },
      { name: "collection", label: "Collection", type: "text", required: true, readOnly: dialogMode !== "add" },
      { name: "description", label: "Description", type: "text" },
      { name: "dimensions", label: "Dimensions", type: "number", required: true },
      { name: "distance_metric", label: "Distance metric", type: "select", options: metricOptions },
      { name: "allowed_roles", label: "Allowed roles", type: "text", required: true },
    ],
    [dialogMode, metricOptions]
  );

  const errors = React.useMemo(() => {
    const next: Record<string, string> = {};
    if (!draft.profile.trim()) next.profile = "Profile is required.";
    if (!draft.collection.trim()) next.collection = "Collection is required.";
    if (!(draft.dimensions > 0)) next.dimensions = "Dimensions must be greater than zero.";
    if (parseCsv(draft.allowed_roles).length === 0) next.allowed_roles = "At least one role is required.";
    try {
      parseJsonObject(draft.metadata_json);
    } catch (parseError) {
      next.metadata_json = parseError instanceof Error ? parseError.message : "Invalid metadata JSON.";
    }
    return next;
  }, [draft]);

  const run = React.useCallback(async (action: string, fn: () => Promise<unknown>) => {
    setError(null);
    try {
      const out = await fn();
      setResult(out);
      setStatus(`${action} OK`);
      recordActivity(`collections.${action}`, "ok");
      return out;
    } catch (runError) {
      const message = captureFailure(runError);
      setError(message);
      setStatus("");
      recordActivity(`collections.${action}`, "error", message);
      throw runError;
    }
  }, [captureFailure, recordActivity]);

  const listCollections = React.useCallback(async () => {
    const [out, events] = await Promise.all([
      api.listCollections(draft.profile.trim() || "default"),
      api.getA2aEvents().catch(() => ({ events: [] })),
    ]);
    const collectionsPayload = asRecord(out).collections;
    const rows = Array.isArray(collectionsPayload) ? collectionsPayload.map(asCollectionRecord) : [];
    const withTimes = applyCollectionEventTimes(rows, asRecord(events).events).sort((left, right) => {
      const leftTime = Date.parse(left.updated_at ?? left.created_at ?? "");
      const rightTime = Date.parse(right.updated_at ?? right.created_at ?? "");
      return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
    });
    setCollections(withTimes);
    return withTimes;
  }, [api, draft.profile]);

  React.useEffect(() => {
    void listCollections();
  }, [listCollections]);

  React.useEffect(() => {
    if (!selected) {
      setRelatedItems([]);
      return;
    }

    let cancelled = false;
    const loadRelated = async () => {
      try {
        const out = asRecord(await api.listSourceConfigs());
        if (cancelled) return;
        const rows = Array.isArray(out.source_configs)
          ? (out.source_configs as unknown[])
              .map((item) => asRecord(item) as unknown as SourceConfigRecord)
              .filter((item) => item.profile === selected.profile && item.collection === selected.collection)
              .map((item) => ({ id: item.source_id, label: `Source config: ${item.source_id}` }))
          : [];
        rows.push({ id: `${selected.profile}:${selected.collection}:count`, label: `Document count: ${String(selected.metadata.doc_count ?? 0)}` });
        setRelatedItems(rows);
      } catch {
        if (!cancelled) setRelatedItems([]);
      }
    };

    void loadRelated();
    return () => {
      cancelled = true;
    };
  }, [api, selected]);

  const openAdd = () => {
    setSelected(null);
    setDialogMode("add");
    setDraft(
      toDraft({
        profile: draft.profile || app.sourceConfig.profile || "default",
        collection: "",
        description: "",
        dimensions: 1024,
        distance_metric: "cosine",
        metadata: {},
        allowed_roles: [],
      })
    );
    setDialogOpen(true);
  };

  const openDialog = (row: CollectionRecord, mode: EntityFormMode) => {
    setSelected(row);
    setDialogMode(mode);
    setDraft(toDraft(row));
    setDialogOpen(true);
  };

  const payload = (): JsonRecord => ({
    profile: draft.profile.trim() || "default",
    collection: draft.collection.trim(),
    description: draft.description.trim(),
    dimensions: Number(draft.dimensions),
    distance_metric: draft.distance_metric,
    allowed_roles: parseCsv(draft.allowed_roles),
    metadata: parseJsonObject(draft.metadata_json),
  });

  const submit = async () => {
    if (Object.keys(errors).length > 0 || dialogMode === "view") return;

    if (dialogMode === "add") {
      await run("create", async () => {
        const out = await api.createCollection(payload());
        await listCollections();
        return out;
      });
    } else {
      await run("update", async () => {
        const out = await api.updateCollection(draft.profile.trim() || "default", draft.collection.trim(), payload());
        await listCollections();
        return out;
      });
    }

    setDialogOpen(false);
  };

  const deleteCollection = async (row: CollectionRecord) => {
    await run("delete", async () => {
      const out = await api.deleteCollection(row.profile, row.collection);
      await listCollections();
      return out;
    });
  };

  const emptyCollection = async (row: CollectionRecord) => {
    await run("empty", async () => {
      const out = await api.callTool("delete_by_filter", {
        profile: row.profile,
        collection: row.collection,
        filters: {},
      });
      await listCollections();
      return out;
    });
  };

  const setActiveCollectionAndGo = (row: CollectionRecord, path: string) => {
    app.setSourceConfig((current) => ({
      ...current,
      profile: row.profile,
      collection: row.collection,
    }));
    navigate(path);
  };

  const columns: DataColumn<CollectionRecord>[] = [
    {
      id: "collection",
      header: "Name",
      cell: (row) => (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={() => openDialog(row, canManageCollections ? "edit" : "view")}
        >
          {row.collection}
        </Button>
      ),
      sortable: true,
      sortValue: (row) => row.collection,
    },
    { id: "dimensions", header: "Dimensions", cell: (row) => String(row.dimensions ?? "-") },
    { id: "metric", header: "Metric", cell: (row) => row.distance_metric },
    { id: "doc_count", header: "Doc Count", cell: (row) => String(row.metadata.doc_count ?? 0) },
    {
      id: "created",
      header: "Created",
      cell: (row) => (row.created_at ? <RelativeTime timestamp={row.created_at} /> : "N/A"),
      sortable: true,
      sortValue: (row) => row.created_at ?? "",
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => openDialog(row, "view")}>
            View
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setActiveCollectionAndGo(row, "/ingest-search")}>
            Search
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setActiveCollectionAndGo(row, "/retention-delete")}>
            Manage
          </Button>
          <Button
            size="sm"
            variant="secondary"
            disabled={!canManageCollections}
            onClick={() => void emptyCollection(row)}
          >
            Empty
          </Button>
          <Button size="sm" variant="secondary" onClick={() => setActiveCollectionAndGo(row, "/observability")}>
            Audit
          </Button>
          <Button size="sm" variant="secondary" onClick={() => openDialog(row, "edit")} disabled={!canManageCollections}>
            Edit
          </Button>
          <Button size="sm" variant="destructive" onClick={() => void deleteCollection(row)} disabled={!canManageCollections}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Collections</h1>
        <Button variant="secondary" size="sm" onClick={() => void listCollections()}>
          List Collections
        </Button>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" className="text-sm text-foreground/80">
          {status}
        </p>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Collection list</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={openAdd} disabled={!canManageCollections}>Add Collection</Button>
            <Button variant="secondary" size="sm" onClick={() => void listCollections()}>
              Refresh
            </Button>
          </div>
          <DataTable
            tableId="collection-list"
            ariaLabel="collection list"
            rows={collections}
            getRowId={(row) => `${row.profile}:${row.collection}`}
            columns={columns}
            emptyMessage="No collections listed for this profile."
            page={page}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            selectable={true}
            bulkActions={
              canManageCollections
                ? [
                    { label: "Delete Selected", action: "delete" },
                    { label: "Export", action: "export" },
                  ]
                : [{ label: "Export", action: "export" }]
            }
            onBulkAction={(action, ids) => {
              const rows = collections.filter((row) => ids.includes(`${row.profile}:${row.collection}`));
              if (action === "delete") {
                if (!canManageCollections) return;
                void (async () => {
                  for (const row of rows) await deleteCollection(row);
                })();
                return;
              }
              if (action === "export") {
                const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
                const url = URL.createObjectURL(blob);
                const link = document.createElement("a");
                link.href = url;
                link.download = "index-retriever-collections.json";
                link.click();
                URL.revokeObjectURL(url);
                setStatus(`Exported ${rows.length} collection(s)`);
              }
            }}
            columnPickerEnabled={true}
          />
        </CardContent>
      </Card>

      <RelatedItemsPanel
        title="Related items"
        items={relatedItems}
        emptyMessage="Select a collection to inspect source configs and document count."
      />

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Operation result</h2>
          <p className="text-sm text-muted-foreground">
            Shows the raw API response from the last collection create, update, delete, or empty operation.
          </p>
        </CardHeader>
        <CardContent>
          <JsonExplorer title="result" data={result ?? {}} defaultExpanded />
        </CardContent>
      </Card>

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={dialogMode === "add" ? "Add Collection" : dialogMode === "edit" ? "Edit Collection" : "View Collection"}
        body={(
          <div className="space-y-4">
            <EntityForm
              fields={fields}
              values={draft as unknown as Record<string, unknown>}
              errors={errors}
              mode={dialogMode}
              onChange={(name, value) => setDraft((current) => ({ ...current, [name]: value }) as CollectionDraft)}
              onSubmit={() => void submit()}
              onCancel={() => setDialogOpen(false)}
            />
            <Card>
              <CardHeader>
                <h3 className="text-base font-semibold">Indexing settings</h3>
              </CardHeader>
              <CardContent>
                <div className="rounded border p-3 text-sm text-muted-foreground space-y-1">
                  <p>Collections inherit indexing settings (chunking strategy, embedding model, LLM model, chunk size, max tokens, MinerU, Marker, OCR) from their parent profile.</p>
                  <p>To override indexing behaviour for this collection, set override keys in the metadata JSON below (e.g. <code>{`"chunk_size": 1024, "llm_model": "gpt-4o"`}</code>). Overrides take precedence over inherited profile settings at indexing time.</p>
                  <p><strong>Parent profile:</strong> {draft.profile || "default"} | <strong>Backend:</strong> {activeBackend}</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader>
                <h3 className="text-base font-semibold">Collection metadata JSON</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                {dialogMode === "view" ? (
                  <CodeEditor
                    value={draft.metadata_json}
                    language="json"
                    ariaLabel="Metadata JSON"
                    readOnly
                    height={220}
                  />
                ) : (
                  <Textarea
                    id="ef-metadata_json"
                    name="metadata_json"
                    aria-label="Metadata JSON"
                    rows={10}
                    value={draft.metadata_json}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, metadata_json: event.target.value }) as CollectionDraft)
                    }
                  />
                )}
                {errors.metadata_json ? <p className="text-sm text-destructive">{errors.metadata_json}</p> : null}
                <JsonExplorer
                  title="profile backend summary"
                  data={{
                    profile: draft.profile,
                    backend: activeBackend,
                    supported_distance_metrics: metricOptions,
                  }}
                  defaultExpanded
                />
              </CardContent>
            </Card>
          </div>
        )}
      />
    </div>
  );
}
