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

// @cloud-dog/app-index-retriever — Profile CRUD workflow.

import * as React from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  EntityDialog,
  EntityForm,
  JsonExplorer,
  RelativeTime,
  RelatedItemsPanel,
  type DataColumn,
  type EntityFieldDef,
  type EntityFormMode,
} from "@cloud-dog/ui";
import { useIndexRetrieverState } from "../state/AppState";
import type { JsonRecord, ProfileRecord } from "../lib/types";

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parseCsv(value: string): string[] {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

function asProfileRecord(profile: string, value: unknown): ProfileRecord {
  const record = asRecord(value);
  return {
    profile,
    description: typeof record.description === "string" ? record.description : undefined,
    enabled: typeof record.enabled === "boolean" ? record.enabled : undefined,
    backend: typeof record.backend === "string" ? record.backend : undefined,
    embedding_model: typeof record.embedding_model === "string" ? record.embedding_model : undefined,
    embedding_dimension: typeof record.embedding_dimension === "number" ? record.embedding_dimension : null,
    chunking_strategy: typeof record.chunking_strategy === "string" ? record.chunking_strategy : undefined,
    llm_model: typeof record.llm_model === "string" ? record.llm_model : undefined,
    chunk_size: typeof record.chunk_size === "number" ? record.chunk_size : null,
    max_tokens: typeof record.max_tokens === "number" ? record.max_tokens : null,
    mineru_enabled: typeof record.mineru_enabled === "boolean" ? record.mineru_enabled : undefined,
    marker_enabled: typeof record.marker_enabled === "boolean" ? record.marker_enabled : undefined,
    parser_options: asRecord(record.parser_options),
    ocr_enabled: typeof record.ocr_enabled === "boolean" ? record.ocr_enabled : undefined,
    owner_user_id: typeof record.owner_user_id === "string" ? record.owner_user_id : undefined,
    owner_groups: asStringArray(record.owner_groups),
    roles: asStringArray(record.roles),
  };
}

function applyProfileEventTimes(records: ProfileRecord[], events: unknown): ProfileRecord[] {
  const rows = Array.isArray(events) ? events.map(asRecord) : [];
  const byId = new Map<string, { created_at?: string; updated_at?: string }>();
  for (const row of rows) {
    if (String(row.entity_type ?? "") !== "profile") continue;
    const entityId = String(row.entity_id ?? "").trim();
    if (!entityId) continue;
    const timestamp = String(row.created_at ?? row.timestamp ?? "").trim();
    if (!timestamp) continue;
    const current = byId.get(entityId) ?? {};
    if (String(row.action ?? "").includes("created") && !current.created_at) current.created_at = timestamp;
    current.updated_at = timestamp;
    byId.set(entityId, current);
  }
  return records.map((record) => ({ ...record, ...byId.get(record.profile) }));
}

function recentFirst(records: ProfileRecord[]): ProfileRecord[] {
  return [...records].sort((left, right) => {
    const leftTime = Date.parse(left.updated_at ?? left.created_at ?? "");
    const rightTime = Date.parse(right.updated_at ?? right.created_at ?? "");
    return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
  });
}

function pinProfileFirst(records: ProfileRecord[], profile: string): ProfileRecord[] {
  const target = profile.trim();
  if (!target) return records;
  const first = records.find((record) => record.profile === target);
  if (!first) return records;
  return [first, ...records.filter((record) => record.profile !== target)];
}

type ProfileDraft = Readonly<{
  profile: string;
  description: string;
  backend: string;
  embedding_model: string;
  embedding_dimension: string;
  chunking_strategy: string;
  llm_model: string;
  chunk_size: string;
  max_tokens: string;
  mineru_enabled: boolean;
  marker_enabled: boolean;
  ocr_enabled: boolean;
  owner_user_id: string;
  owner_groups: string;
  roles: string;
  enabled: boolean;
}>;

const EMPTY_DRAFT: ProfileDraft = {
  profile: "",
  description: "",
  backend: "chroma",
  embedding_model: "nomic-embed-text",
  embedding_dimension: "768",
  chunking_strategy: "recursive",
  llm_model: "",
  chunk_size: "512",
  max_tokens: "8192",
  mineru_enabled: false,
  marker_enabled: false,
  ocr_enabled: false,
  owner_user_id: "",
  owner_groups: "",
  roles: "reader,writer,maintainer",
  enabled: true,
};

const BACKEND_DETAILS: Record<string, JsonRecord> = {
  chroma: {
    backend: "chroma",
    mode: "vector store",
    strengths: ["simple local and remote deployment", "fast iterative indexing"],
    expected_use: "default lightweight retrieval profile",
  },
  qdrant: {
    backend: "qdrant",
    mode: "vector store",
    strengths: ["high-scale vector search", "payload filtering"],
    expected_use: "preprod and production semantic retrieval",
  },
  opensearch: {
    backend: "opensearch",
    mode: "search and vector hybrid",
    strengths: ["hybrid retrieval", "operational search tooling"],
    expected_use: "hybrid keyword plus semantic search",
  },
  pgvector: {
    backend: "pgvector",
    mode: "postgres extension",
    strengths: ["sql adjacency", "single-system deployment"],
    expected_use: "smaller relational deployments",
  },
  weaviate: {
    backend: "weaviate",
    mode: "vector store",
    strengths: ["schema-driven vector collections", "retrieval APIs"],
    expected_use: "managed vector deployments",
  },
  infinity: {
    backend: "infinity",
    mode: "vector store",
    strengths: ["experimental profile support"],
    expected_use: "specialist deployments only",
  },
};

export function ProfileCrudPage() {
  const app = useIndexRetrieverState();
  const { api } = app;

  const [profiles, setProfiles] = React.useState<ProfileRecord[]>([]);
  const [selected, setSelected] = React.useState<ProfileRecord | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<EntityFormMode>("add");
  const [draft, setDraft] = React.useState<ProfileDraft>({ ...EMPTY_DRAFT, profile: app.sourceConfig.profile });
  const [relatedItems, setRelatedItems] = React.useState<{ id: string; label: string }[]>([]);
  const [result, setResult] = React.useState<unknown>(null);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);
  const backendDetails = React.useMemo(
    () => BACKEND_DETAILS[draft.backend.trim().toLowerCase()] ?? { backend: draft.backend || "unknown", note: "No backend notes available." },
    [draft.backend]
  );

  const fields = React.useMemo<EntityFieldDef[]>(
    () => [
      { name: "profile", label: "Profile name", type: "text", required: true, readOnly: dialogMode !== "add" },
      { name: "description", label: "Description", type: "text" },
      {
        name: "backend",
        label: "Backend",
        type: "select",
        required: true,
        options: ["chroma", "qdrant", "opensearch", "pgvector", "weaviate", "infinity"],
      },
      { name: "embedding_model", label: "Embedding model", type: "text", required: true },
      { name: "embedding_dimension", label: "Embedding dimension", type: "text", required: true },
      {
        name: "chunking_strategy",
        label: "Chunking strategy",
        type: "select",
        required: true,
        options: ["recursive", "fixed", "semantic", "token_overlap", "paragraph"],
      },
      { name: "llm_model", label: "LLM model", type: "text" },
      { name: "chunk_size", label: "Chunk size", type: "text" },
      { name: "max_tokens", label: "Max tokens", type: "text" },
      { name: "mineru_enabled", label: "MinerU enabled", type: "boolean" },
      { name: "marker_enabled", label: "Marker enabled", type: "boolean" },
      { name: "ocr_enabled", label: "OCR enabled", type: "boolean" },
      { name: "owner_user_id", label: "Owner user", type: "text" },
      { name: "owner_groups", label: "Owner groups", type: "text" },
      { name: "roles", label: "Roles", type: "text", required: true },
      { name: "enabled", label: "Enabled", type: "boolean" },
    ],
    [dialogMode]
  );

  const errors = React.useMemo(() => {
    const next: Record<string, string> = {};
    if (!draft.profile.trim()) next.profile = "Profile name is required.";
    if (!draft.backend.trim()) next.backend = "Backend is required.";
    if (!draft.embedding_model.trim()) next.embedding_model = "Embedding model is required.";
    const dimension = Number(draft.embedding_dimension);
    if (!Number.isInteger(dimension) || dimension <= 0) next.embedding_dimension = "Embedding dimension must be a positive integer.";
    if (!draft.chunking_strategy.trim()) next.chunking_strategy = "Chunking strategy is required.";
    if (draft.chunk_size.trim()) {
      const cs = Number(draft.chunk_size);
      if (!Number.isInteger(cs) || cs <= 0) next.chunk_size = "Chunk size must be a positive integer.";
    }
    if (draft.max_tokens.trim()) {
      const mt = Number(draft.max_tokens);
      if (!Number.isInteger(mt) || mt <= 0) next.max_tokens = "Max tokens must be a positive integer.";
    }
    if (parseCsv(draft.roles).length === 0) next.roles = "At least one role is required.";
    return next;
  }, [draft]);

  const run = React.useCallback(
    async (action: string, fn: () => Promise<unknown>) => {
      setError(null);
      try {
        const out = await fn();
        setResult(out);
        setStatus(`${action} OK`);
        app.recordActivity(`profiles.${action}`, "ok");
        return out;
      } catch (runError) {
        const message = app.captureFailure(runError);
        setError(message);
        setStatus("");
        app.recordActivity(`profiles.${action}`, "error", message);
        throw runError;
      }
    },
    [app]
  );

  const listProfiles = React.useCallback(async () => {
    setLoading(true);
    try {
      const out = (await api.callTool<JsonRecord>("profiles_list", {})) as JsonRecord;
      const rows = Array.isArray(out.profiles)
        ? out.profiles.filter((item): item is string => typeof item === "string")
        : [];
      const [hydrated, events] = await Promise.all([
        Promise.all(
        rows.map(async (name) => {
          const detail = (await api.callTool<JsonRecord>("profile_get", { profile: name })) as JsonRecord;
          return asProfileRecord(name, detail.profile);
        })
        ),
        api.getA2aEvents().catch(() => ({ events: [] })),
      ]);
      const withTimes = recentFirst(applyProfileEventTimes(hydrated, asRecord(events).events));
      setProfiles(withTimes);
      return withTimes;
    } finally {
      setLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    void listProfiles();
  }, [listProfiles]);

  React.useEffect(() => {
    if (!selected) {
      setRelatedItems([]);
      return;
    }

    let cancelled = false;
    const loadRelated = async () => {
      try {
        const [collectionsOut, usersOut] = await Promise.all([
          api.listCollections(selected.profile),
          api.callTool<JsonRecord>("users_list", {}),
        ]);
        if (cancelled) return;
        const collections = Array.isArray(asRecord(collectionsOut).collections)
          ? (asRecord(collectionsOut).collections as unknown[]).map((item) => asRecord(item)).map((item) => ({
              id: String(item.collection ?? ""),
              label: `Collection: ${String(item.collection ?? "")}`,
            }))
          : [];
        const users = Array.isArray(asRecord(usersOut).users)
          ? (asRecord(usersOut).users as unknown[])
              .map((item) => asRecord(item))
              .filter((item) => asStringArray(item.roles).some((role) => (selected.roles ?? []).includes(role)))
              .map((item) => ({ id: String(item.user_id ?? ""), label: `User: ${String(item.user_id ?? "")}` }))
          : [];
        setRelatedItems([...collections, ...users]);
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
    setDialogMode("add");
    setDraft({ ...EMPTY_DRAFT, profile: "", backend: "chroma" });
    setDialogOpen(true);
  };

  const toDraft = (row: ProfileRecord): ProfileDraft => ({
    profile: row.profile,
    description: row.description ?? "",
    backend: row.backend ?? "chroma",
    embedding_model: row.embedding_model ?? "nomic-embed-text",
    embedding_dimension: String(row.embedding_dimension ?? 768),
    chunking_strategy: row.chunking_strategy ?? "recursive",
    llm_model: row.llm_model ?? "",
    chunk_size: String(row.chunk_size ?? 512),
    max_tokens: String(row.max_tokens ?? 8192),
    mineru_enabled: row.mineru_enabled ?? false,
    marker_enabled: row.marker_enabled ?? false,
    ocr_enabled: row.ocr_enabled ?? false,
    owner_user_id: row.owner_user_id ?? "",
    owner_groups: (row.owner_groups ?? []).join(","),
    roles: (row.roles ?? []).join(","),
    enabled: row.enabled !== false,
  });

  const openEdit = (row: ProfileRecord) => {
    setSelected(row);
    setDialogMode("edit");
    setDraft(toDraft(row));
    setDialogOpen(true);
  };

  const openView = (row: ProfileRecord) => {
    setSelected(row);
    setDialogMode("view");
    setDraft(toDraft(row));
    setDialogOpen(true);
  };

  const submit = async () => {
    if (Object.keys(errors).length > 0 || dialogMode === "view") return;

    const payload = {
      profile: draft.profile.trim(),
      config: {
        description: draft.description.trim(),
        backend: draft.backend.trim(),
        embedding_model: draft.embedding_model.trim(),
        embedding_dimension: Number(draft.embedding_dimension),
        chunking_strategy: draft.chunking_strategy.trim(),
        llm_model: draft.llm_model.trim() || undefined,
        chunk_size: draft.chunk_size.trim() ? Number(draft.chunk_size) : undefined,
        max_tokens: draft.max_tokens.trim() ? Number(draft.max_tokens) : undefined,
        mineru_enabled: draft.mineru_enabled,
        marker_enabled: draft.marker_enabled,
        parser_options: {
          ocr_enabled: draft.ocr_enabled,
        },
        ocr_enabled: draft.ocr_enabled,
        owner_user_id: draft.owner_user_id.trim(),
        owner_groups: parseCsv(draft.owner_groups),
        roles: parseCsv(draft.roles),
        enabled: draft.enabled,
      },
    };

    if (dialogMode === "add") {
      await run("create", async () => {
        const out = await api.callTool("admin_profile_create", payload);
        const refreshed = await listProfiles();
        setProfiles(pinProfileFirst(refreshed, payload.profile));
        setPage(1);
        return out;
      });
    } else {
      await run("update", async () => {
        const out = await api.callTool("admin_profile_update", payload);
        await listProfiles();
        return out;
      });
    }

    setDialogOpen(false);
  };

  const deleteProfile = async (profile: string) => {
    await run("delete", async () => {
      const out = await api.callTool("admin_profile_delete", { profile });
      await listProfiles();
      return out;
    });
  };

  const columns: DataColumn<ProfileRecord>[] = [
    {
      id: "profile",
      header: "Name",
      cell: (row) => (
        <span className="cursor-pointer text-primary underline-offset-4 hover:underline" onClick={() => openEdit(row)}>
          {row.profile}
        </span>
      ),
      sortable: true,
      sortValue: (row) => row.profile,
    },
    {
      id: "description",
      header: "Description",
      cell: (row) => row.description || `${row.backend ?? "unknown"} / ${row.embedding_model ?? "embedding not set"}`,
    },
    {
      id: "indexing",
      header: "Indexing",
      cell: (row) => `${row.chunking_strategy ?? "recursive"} / ${row.embedding_dimension ?? "?"} dim`,
      sortable: true,
      sortValue: (row) => `${row.chunking_strategy ?? ""}:${row.embedding_dimension ?? ""}`,
    },
    {
      id: "owner",
      header: "Owner",
      cell: (row) => row.owner_user_id || row.owner_groups?.join(", ") || "-",
      sortable: true,
      sortValue: (row) => row.owner_user_id || row.owner_groups?.join(", ") || "",
    },
    {
      id: "created",
      header: "Created",
      cell: (row) => (row.created_at ? <RelativeTime timestamp={row.created_at} /> : "N/A"),
      sortable: true,
      sortValue: (row) => row.created_at ?? "",
    },
    {
      id: "updated",
      header: "Updated",
      cell: (row) => (row.updated_at ? <RelativeTime timestamp={row.updated_at} /> : "N/A"),
      sortable: true,
      sortValue: (row) => row.updated_at ?? "",
    },
    {
      id: "roles",
      header: "Roles",
      cell: (row) => row.roles?.join(", ") || "-",
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => openView(row)}>
            View
          </Button>
          <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>
            Edit
          </Button>
          <Button size="sm" variant="destructive" onClick={() => void deleteProfile(row.profile)}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Profiles</h1>
        <Button variant="secondary" size="sm" onClick={() => void listProfiles()}>
          List Profiles
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
          <h2 className="text-lg font-semibold">Profile list</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={openAdd}>Add Profile</Button>
            <Button variant="secondary" size="sm" onClick={() => void listProfiles()}>
              Refresh
            </Button>
          </div>
          {loading ? (
            <div role="status" className="text-sm text-muted-foreground">
              Loading profiles...
            </div>
          ) : (
            <DataTable
              tableId="profile-list"
              ariaLabel="profile list"
              rows={profiles}
              getRowId={(row) => row.profile}
              columns={columns}
              emptyMessage="No profiles currently listed."
              page={page}
              onPageChange={setPage}
              pageSize={pageSize}
              onPageSizeChange={setPageSize}
              selectable={true}
              bulkActions={[
                { label: "Delete Selected", action: "delete" },
                { label: "Export", action: "export" },
              ]}
              onBulkAction={(action, ids) => {
                const rows = profiles.filter((row) => ids.includes(row.profile));
                if (action === "delete") {
                  void (async () => {
                    for (const row of rows) {
                      await deleteProfile(row.profile);
                    }
                  })();
                  return;
                }
                if (action === "export") {
                  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
                  const url = URL.createObjectURL(blob);
                  const link = document.createElement("a");
                  link.href = url;
                  link.download = "index-retriever-profiles.json";
                  link.click();
                  URL.revokeObjectURL(url);
                  setStatus(`Exported ${rows.length} profile(s)`);
                }
              }}
              columnPickerEnabled={true}
            />
          )}
        </CardContent>
      </Card>

      <RelatedItemsPanel
        title="Related items"
        items={relatedItems}
        emptyMessage="Select a profile to inspect related collections and users."
      />

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Operation result</h2>
          <p className="text-sm text-muted-foreground">
            Shows the raw API response from the last profile create, update, or delete operation.
          </p>
        </CardHeader>
        <CardContent>
          <JsonExplorer title="result" data={result ?? {}} defaultExpanded />
        </CardContent>
      </Card>

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={dialogMode === "add" ? "Add Profile" : dialogMode === "edit" ? "Edit Profile" : "View Profile"}
        body={(
          <div className="space-y-4">
            <EntityForm
              fields={fields}
              values={draft as unknown as Record<string, unknown>}
              errors={errors}
              mode={dialogMode}
              onChange={(name, value) => setDraft((current) => ({ ...current, [name]: value }) as ProfileDraft)}
              onSubmit={() => void submit()}
              onCancel={() => setDialogOpen(false)}
            />
            <Card>
              <CardHeader>
                <h3 className="text-base font-semibold">Backend profile notes</h3>
              </CardHeader>
              <CardContent>
                <JsonExplorer data={backendDetails} defaultExpanded />
              </CardContent>
            </Card>
          </div>
        )}
      />
    </div>
  );
}
