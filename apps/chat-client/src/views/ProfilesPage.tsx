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

// @cloud-dog/app-chat-client — Profile CRUD page.

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { Badge, Button, Card, CardContent, CardHeader, DataTable, EntityDialog, Input, RelatedItemsPanel, RelativeTime } from "@cloud-dog/ui";
import type { BulkAction, DataColumn, EntityFieldDef } from "@cloud-dog/ui";
import { isAdminUser } from "../lib/rbac";
import type { AgentStrategyName, ChatProfileRecord, McpServer } from "../lib/types";
import { useAppState } from "../state/AppState";

const agentStrategyOptions: AgentStrategyName[] = [
  "simple",
  "react",
  "codeact",
  "subagent_router",
  "rlm",
  "reflexion",
  "longworkflow",
];

const profileFields: EntityFieldDef[] = [
  { name: "profile_id", label: "Profile ID", type: "text", required: true },
  { name: "name", label: "Name", type: "text", required: true },
  { name: "description", label: "Description", type: "text", required: false },
  { name: "agent_strategy", label: "Agent strategy", type: "select", required: false, options: agentStrategyOptions },
  { name: "mcp_server_indices", label: "External service indices (CSV)", type: "text", required: false },
  { name: "llm_model", label: "LLM model", type: "text", required: false },
  { name: "llm_system_prompt", label: "System prompt", type: "text", required: false },
  { name: "memory_enabled", label: "Memory enabled", type: "text", required: false },
  { name: "cache_enabled", label: "Cache enabled", type: "text", required: false },
  { name: "history_enabled", label: "History enabled", type: "text", required: false },
  { name: "file_uploads_enabled", label: "File uploads enabled", type: "text", required: false },
  { name: "file_allowed_modes", label: "Allowed file modes (CSV: by-value, by-reference)", type: "text", required: false },
  { name: "file_server_index", label: "File external service index", type: "text", required: false },
  { name: "file_max_size_bytes", label: "Max file size (bytes)", type: "text", required: false },
  { name: "file_allowed_source_schemes", label: "Allowed source schemes (CSV)", type: "text", required: false },
  { name: "file_artifact_rendering_enabled", label: "Artifact rendering enabled", type: "text", required: false },
];

const emptyForm = {
  profile_id: "",
  name: "",
  description: "",
  agent_strategy: "simple",
  mcp_server_indices: "",
  llm_model: "",
  llm_system_prompt: "",
  memory_enabled: "true",
  cache_enabled: "true",
  history_enabled: "true",
  file_uploads_enabled: "true",
  file_allowed_modes: "by-value, by-reference",
  file_server_index: "",
  file_max_size_bytes: "",
  file_allowed_source_schemes: "https, http",
  file_artifact_rendering_enabled: "true",
};

function parseIndexCsv(value: unknown): number[] {
  return String(value ?? "")
    .split(",")
    .map((item) => Number(item.trim()))
    .filter((item, index, all) => Number.isInteger(item) && item >= 0 && all.indexOf(item) === index);
}

function normalizeAgentStrategyName(value: unknown): AgentStrategyName {
  const candidate = String(value ?? "").trim().toLowerCase();
  return agentStrategyOptions.includes(candidate as AgentStrategyName)
    ? (candidate as AgentStrategyName)
    : "simple";
}

function toBindingIndices(profile: ChatProfileRecord, servers: McpServer[]): number[] {
  const bindings = Array.isArray(profile.mcp_bindings) ? profile.mcp_bindings : [];
  const out: number[] = [];
  for (const binding of bindings) {
    const directIndex = Number((binding as Record<string, unknown>).index ?? (binding as Record<string, unknown>).server_index ?? -1);
    if (Number.isInteger(directIndex) && directIndex >= 0) {
      out.push(directIndex);
      continue;
    }
    const name = String((binding as Record<string, unknown>).name ?? "").trim().toLowerCase();
    const baseUrl = String((binding as Record<string, unknown>).base_url ?? "").trim().toLowerCase();
    const matched = servers.find((server) =>
      (name && server.name.trim().toLowerCase() === name)
      || (baseUrl && server.base_url.trim().toLowerCase() === baseUrl)
    );
    if (matched) out.push(matched.index);
  }
  return Array.from(new Set(out)).sort((a, b) => a - b);
}

function buildBindings(indices: number[], servers: McpServer[]): Record<string, unknown>[] {
  return indices
    .map((index) => servers.find((server) => server.index === index))
    .filter((server): server is McpServer => server != null)
    .map((server) => ({
      index: server.index,
      name: server.name,
      transport: server.transport,
      base_url: server.base_url,
      mcp_path: server.mcp_path,
      messages_path: server.messages_path,
      sse_path: server.sse_path,
      health_path: server.health_path,
      version: server.version ?? "",
    }));
}

function toForm(profile: ChatProfileRecord | null, servers: McpServer[]): Record<string, unknown> {
  if (!profile) return emptyForm;
  const defaults = profile.session_defaults ?? {};
  const fileIntake = (defaults.file_intake ?? {}) as Record<string, unknown>;
  const allowedModes = Array.isArray(fileIntake.allowed_modes)
    ? (fileIntake.allowed_modes as string[]).join(", ")
    : "by-value, by-reference";
  const allowedSchemes = Array.isArray(fileIntake.allowed_source_schemes)
    ? (fileIntake.allowed_source_schemes as string[]).join(", ")
    : "https, http";
  return {
    profile_id: profile.profile_id,
    name: profile.name,
    description: profile.description,
    agent_strategy: normalizeAgentStrategyName(defaults.agent_strategy),
    mcp_server_indices: toBindingIndices(profile, servers).join(", "),
    llm_model: String(defaults.llm_model ?? defaults.model ?? ""),
    llm_system_prompt: String(defaults.llm_system_prompt ?? defaults.system_prompt ?? ""),
    memory_enabled: String(defaults.memory_enabled ?? true),
    cache_enabled: String(defaults.cache_enabled ?? true),
    history_enabled: String(defaults.history_enabled ?? true),
    file_uploads_enabled: String(fileIntake.uploads_enabled ?? true),
    file_allowed_modes: allowedModes,
    file_server_index: fileIntake.file_server_index != null ? String(fileIntake.file_server_index) : "",
    file_max_size_bytes: fileIntake.max_size_bytes != null ? String(fileIntake.max_size_bytes) : "",
    file_allowed_source_schemes: allowedSchemes,
    file_artifact_rendering_enabled: String(fileIntake.artifact_rendering_enabled ?? true),
  };
}

export function ProfilesPage() {
  const auth = useAuth();
  const { api, mcpServers } = useAppState();
  const mayEdit = isAdminUser(auth.user);
  const [profiles, setProfiles] = React.useState<ChatProfileRecord[]>([]);
  const [selectedProfile, setSelectedProfile] = React.useState<ChatProfileRecord | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<Record<string, unknown>>(emptyForm);
  const [editingProfileId, setEditingProfileId] = React.useState<string | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const refresh = React.useCallback(async () => {
    setError(null);
    const listedProfiles = await api.listProfiles();
    setProfiles(listedProfiles);
  }, [api]);

  React.useEffect(() => {
    void refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to load profiles");
    });
  }, [refresh]);

  React.useEffect(() => {
    setPage(1);
  }, [query]);

  const resetDialog = React.useCallback(() => {
    setEditingProfileId(null);
    setForm(emptyForm);
    setDialogOpen(false);
  }, []);

  const openCreate = React.useCallback(() => {
    setEditingProfileId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }, []);

  const openEdit = React.useCallback((profile: ChatProfileRecord) => {
    setEditingProfileId(profile.profile_id);
    setForm(toForm(profile, mcpServers));
    setDialogOpen(true);
  }, [mcpServers]);

  const save = React.useCallback(async () => {
    setError(null);
    setStatus(null);
    try {
      const indices = parseIndexCsv(form.mcp_server_indices);
      const bindings = buildBindings(indices, mcpServers);
      const existing = editingProfileId ? profiles.find((profile) => profile.profile_id === editingProfileId) : null;
      const fileServerIdx = String(form.file_server_index ?? "").trim();
      const maxSizeStr = String(form.file_max_size_bytes ?? "").trim();
      const fileIntake: Record<string, unknown> = {
        uploads_enabled: String(form.file_uploads_enabled ?? "true").trim().toLowerCase() !== "false",
        allowed_modes: String(form.file_allowed_modes ?? "by-value, by-reference")
          .split(",")
          .map((m) => m.trim())
          .filter(Boolean),
        file_server_index: fileServerIdx && Number.isInteger(Number(fileServerIdx)) ? Number(fileServerIdx) : null,
        max_size_bytes: maxSizeStr && Number.isFinite(Number(maxSizeStr)) ? Number(maxSizeStr) : null,
        allowed_source_schemes: String(form.file_allowed_source_schemes ?? "https, http")
          .split(",")
          .map((s) => s.trim().toLowerCase())
          .filter(Boolean),
        artifact_rendering_enabled: String(form.file_artifact_rendering_enabled ?? "true").trim().toLowerCase() !== "false",
      };
      const payload = {
        profile_id: String(form.profile_id ?? "").trim() || undefined,
        name: String(form.name ?? "").trim(),
        description: String(form.description ?? "").trim(),
        mcp_bindings: bindings,
        session_defaults: {
          ...(existing?.session_defaults ?? {}),
          llm_model: String(form.llm_model ?? "").trim(),
          llm_system_prompt: String(form.llm_system_prompt ?? "").trim(),
          agent_strategy: normalizeAgentStrategyName(form.agent_strategy),
          memory_enabled: String(form.memory_enabled ?? "true").trim().toLowerCase() !== "false",
          cache_enabled: String(form.cache_enabled ?? "true").trim().toLowerCase() !== "false",
          history_enabled: String(form.history_enabled ?? "true").trim().toLowerCase() !== "false",
          selected_mcp_server_indices: indices,
          file_intake: fileIntake,
        },
        access_control: existing?.access_control ?? {},
      };
      if (editingProfileId) {
        await api.updateProfile(editingProfileId, payload);
        setStatus(`Updated profile ${editingProfileId}`);
      } else {
        await api.createProfile(payload);
        setStatus(`Created profile ${String(form.profile_id ?? "").trim() || String(form.name ?? "").trim()}`);
      }
      resetDialog();
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save profile");
    }
  }, [api, editingProfileId, form, mcpServers, profiles, refresh, resetDialog]);

  const removeProfile = React.useCallback(async (profileId: string) => {
    if (!window.confirm(`Delete profile ${profileId}?`)) return;
    setError(null);
    setStatus(null);
    try {
      await api.deleteProfile(profileId);
      if (editingProfileId === profileId) resetDialog();
      setStatus(`Deleted profile ${profileId}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete profile");
    }
  }, [api, editingProfileId, refresh, resetDialog]);

  const bulkDelete = React.useCallback(async (rows: ChatProfileRecord[]) => {
    if (!rows.length) return;
    if (!window.confirm(`Delete ${rows.length} selected profiles?`)) return;
    setError(null);
    setStatus(null);
    try {
      await Promise.all(rows.map((row) => api.deleteProfile(row.profile_id)));
      setStatus(`Deleted ${rows.length} profiles`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete selected profiles");
    }
  }, [api, refresh]);

  const relatedServers = React.useMemo(() => {
    if (!selectedProfile) return [];
    return toBindingIndices(selectedProfile, mcpServers).map((index) => {
      const server = mcpServers.find((candidate) => candidate.index === index);
      return {
        id: String(index),
        label: server ? `${server.name} (#${server.index})` : `Service #${index}`,
      };
    });
  }, [mcpServers, selectedProfile]);

  const filteredProfiles = React.useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return profiles;
    return profiles.filter((row) => {
      const defaults = row.session_defaults ?? {};
      return `${row.profile_id} ${row.name} ${row.description} ${String(defaults.llm_model ?? defaults.model ?? "")} ${normalizeAgentStrategyName(defaults.agent_strategy)}`
        .toLowerCase()
        .includes(trimmed);
    });
  }, [profiles, query]);

  const columns = React.useMemo<DataColumn<ChatProfileRecord>[]>(() => [
    {
      id: "name",
      header: "Name",
      sortable: true,
      sortValue: (row) => row.name.toLowerCase(),
      cell: (row) => <span className="font-medium">{row.name || row.profile_id}</span>,
    },
    {
      id: "profile_id",
      header: "Profile ID",
      sortable: true,
      sortValue: (row) => row.profile_id,
      cell: (row) => <span className="font-mono text-xs">{row.profile_id}</span>,
    },
    {
      id: "mcp",
      header: "External services",
      sortable: true,
      sortValue: (row) => toBindingIndices(row, mcpServers).length,
      cell: (row) => {
        const indices = toBindingIndices(row, mcpServers);
        return indices.length ? indices.join(", ") : "none";
      },
    },
    {
      id: "agent_strategy",
      header: "Strategy",
      sortable: true,
      sortValue: (row) => normalizeAgentStrategyName(row.session_defaults.agent_strategy),
      cell: (row) => <Badge variant="secondary">{normalizeAgentStrategyName(row.session_defaults.agent_strategy)}</Badge>,
    },
    {
      id: "llm_model",
      header: "LLM model",
      sortable: true,
      sortValue: (row) => String(row.session_defaults.llm_model ?? row.session_defaults.model ?? ""),
      cell: (row) => String(row.session_defaults.llm_model ?? row.session_defaults.model ?? "") || "-",
    },
    {
      id: "description",
      header: "Description",
      sortable: true,
      sortValue: (row) => row.description,
      cell: (row) => row.description || "-",
    },
    {
      id: "updated_at",
      header: "Updated",
      sortable: true,
      sortValue: (row) => row.updated_at || row.created_at || "",
      cell: (row) => row.updated_at || row.created_at ? <RelativeTime timestamp={row.updated_at || row.created_at} /> : "-",
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setSelectedProfile(row)}>Details</Button>
          <Button variant="secondary" disabled={!mayEdit} onClick={() => openEdit(row)}>Edit</Button>
          <Button variant="ghost" disabled={!mayEdit} onClick={() => void removeProfile(row.profile_id)}>Delete</Button>
        </div>
      ),
    },
  ], [mayEdit, mcpServers, openEdit, removeProfile]);

  const bulkActions = React.useMemo<BulkAction[]>(() => (mayEdit ? [{ label: "Delete Selected", action: "delete" }] : []), [mayEdit]);

  const onBulkAction = React.useCallback((action: string, selectedIds: string[]) => {
    if (action !== "delete") return;
    const selectedRows = filteredProfiles.filter((row) => selectedIds.includes(row.profile_id));
    void bulkDelete(selectedRows);
  }, [bulkDelete, filteredProfiles]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h1 className="text-xl font-semibold">Profiles</h1>
          <p className="text-sm text-muted-foreground">Manage chat profile descriptions, prompts, LLM defaults, memory/cache/history, and external service bindings.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <Input
              aria-label="Search profiles"
              className="max-w-md"
              placeholder="Search profiles"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void refresh()}>Refresh</Button>
              <Button disabled={!mayEdit} onClick={openCreate}>Add Profile</Button>
            </div>
          </div>
          <DataTable
            tableId="chat-profiles"
            columns={columns}
            rows={filteredProfiles}
            totalRows={profiles.length}
            emptyMessage="No profiles configured."
            getRowId={(row) => row.profile_id}
            page={page}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            selectable={mayEdit}
            bulkActions={bulkActions}
            onBulkAction={onBulkAction}
            columnPickerEnabled={true}
          />
          {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Bound external services</h2>
          <p className="text-sm text-muted-foreground">Selected profile service bindings resolved against the current runtime registry.</p>
        </CardHeader>
        <CardContent>
          <RelatedItemsPanel
            title="Service bindings"
            items={relatedServers}
            emptyMessage="Select a profile to inspect bound external services."
          />
          {selectedProfile ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Badge variant="secondary">
                Model: {String(selectedProfile.session_defaults.llm_model ?? selectedProfile.session_defaults.model ?? "unset")}
              </Badge>
              <Badge variant="secondary">
                Prompt: {String(selectedProfile.session_defaults.llm_system_prompt ?? selectedProfile.session_defaults.system_prompt ?? "").trim() ? "configured" : "none"}
              </Badge>
              <Badge variant="secondary">
                Memory: {selectedProfile.session_defaults.memory_enabled === false ? "disabled" : "enabled"}
              </Badge>
              <Badge variant="secondary">
                Cache: {selectedProfile.session_defaults.cache_enabled === false ? "disabled" : "enabled"}
              </Badge>
              <Badge variant="secondary">
                History: {selectedProfile.session_defaults.history_enabled === false ? "disabled" : "enabled"}
              </Badge>
              <Badge variant="secondary">
                Uploads: {(() => {
                  const fi = (selectedProfile.session_defaults.file_intake ?? {}) as Record<string, unknown>;
                  return fi.uploads_enabled === false ? "disabled" : "enabled";
                })()}
              </Badge>
              <Badge variant="secondary">
                File modes: {(() => {
                  const fi = (selectedProfile.session_defaults.file_intake ?? {}) as Record<string, unknown>;
                  return Array.isArray(fi.allowed_modes) ? (fi.allowed_modes as string[]).join(", ") : "by-value, by-reference";
                })()}
              </Badge>
            </div>
          ) : null}
        </CardContent>
      </Card>

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingProfileId ? `Edit profile ${editingProfileId}` : "Add Profile"}
        fields={profileFields.map((field) => (
          field.name === "profile_id" && editingProfileId ? { ...field, readOnly: true } : field
        ))}
        values={form}
        mode={mayEdit ? (editingProfileId ? "edit" : "add") : "view"}
        onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))}
        onSubmit={() => void save()}
        onCancel={resetDialog}
      />
    </div>
  );
}
