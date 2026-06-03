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
import {
  Badge,
  Button,
  Checkbox,
  ConfirmDialog,
  DataTable,
  EntityDialog,
  Label,
  Textarea,
  type BulkAction,
  type DataColumn,
  type EntityFieldDef,
} from "@cloud-dog/ui";
import { canManageProfiles } from "../lib/access";
import { useDbMcpState } from "../state/AppState";
import type { ProfileDraft, ProfileSummary } from "../lib/types";

type DialogMode = "add" | "edit" | "view";

type ProfileFormState = Readonly<{
  name: string;
  source_type: string;
  source_connection: string;
  description: string;
  namespacesCsv: string;
  entitiesCsv: string;
  fieldMasksJson: string;
  fieldExclusionsCsv: string;
  enabled_tools: string[];
  allowed_permissions: string[];
  index_enabled: boolean;
  index_include_content: boolean;
  index_content_fields_csv: string;
  index_max_documents: string;
}>;

const TOOL_OPTIONS = [
  "catalog",
  "schema",
  "content",
  "relationship",
  "data",
  "index",
  "audit",
] as const;

const PERMISSION_OPTIONS = [
  "catalog.read",
  "schema.read",
  "schema.change",
  "relationship.read",
  "relationship.change",
  "content.search",
  "data.read",
  "data.create",
  "data.update",
  "data.delete",
  "index.manage",
  "profile.manage",
  "audit.read",
] as const;

const SOURCE_TYPES = ["mongodb", "mariadb", "postgresql", "elasticsearch", "opensearch", "couchdb", "cassandra"];
const SOURCE_CONNECTIONS = ["default", "primary", "secondary", "analytics", "archive"];

const PROFILE_FIELDS: EntityFieldDef[] = [
  { name: "name", label: "Name — unique display name for this profile", type: "text", required: true },
  { name: "source_type", label: "Source type — database engine (independent of connection slot)", type: "select", options: SOURCE_TYPES },
  { name: "source_connection", label: "Source connection — named endpoint slot", type: "select", options: SOURCE_CONNECTIONS },
  { name: "description", label: "Description", type: "text" },
  { name: "namespacesCsv", label: "Namespaces (comma-separated, e.g. sales_db, analytics_db)", type: "text" },
  { name: "entitiesCsv", label: "Entities (comma-separated, e.g. customers, orders)", type: "text" },
];

const EMPTY_PROFILE: ProfileDraft = {
  name: "",
  source_type: "mongodb",
  source_connection: "default",
  description: "",
  namespaces: [],
  entities: [],
  enabled_tools: ["catalog", "schema", "content", "relationship", "data", "index"],
  allowed_permissions: [
    "catalog.read",
    "schema.read",
    "schema.change",
    "relationship.read",
    "relationship.change",
    "content.search",
    "data.read",
    "data.create",
    "data.update",
    "data.delete",
    "index.manage",
    "profile.manage",
    "audit.read",
  ],
  field_masks: {},
  field_exclusions: [],
  index_policy: { enabled: true, include_content: true, content_fields: ["name", "email", "product"], max_documents: 10000 },
};

function parseCsv(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter(Boolean);
}

function parseJsonRecord(value: string): Record<string, string> {
  if (!value.trim()) return {};
  const parsed = JSON.parse(value) as Record<string, unknown>;
  return Object.fromEntries(Object.entries(parsed).map(([key, entry]) => [key, String(entry)]));
}

function toggleListValue(values: string[], nextValue: string, checked: boolean): string[] {
  if (checked) return Array.from(new Set([...values, nextValue]));
  return values.filter((value) => value !== nextValue);
}

function toFormState(profile: ProfileSummary | null): ProfileFormState {
  const source = profile ?? EMPTY_PROFILE;
  const indexPolicy = source.index_policy ?? {};
  const contentFields = Array.isArray(indexPolicy.content_fields)
    ? indexPolicy.content_fields.map((item) => String(item))
    : [];

  return {
    name: source.name,
    source_type: source.source_type,
    source_connection: source.source_connection,
    description: source.description,
    namespacesCsv: source.namespaces.join(", "),
    entitiesCsv: source.entities.join(", "),
    fieldMasksJson: JSON.stringify(source.field_masks, null, 2),
    fieldExclusionsCsv: source.field_exclusions.join(", "),
    enabled_tools: [...source.enabled_tools],
    allowed_permissions: [...source.allowed_permissions],
    index_enabled: Boolean(indexPolicy.enabled ?? true),
    index_include_content: Boolean(indexPolicy.include_content ?? true),
    index_content_fields_csv: contentFields.join(", "),
    index_max_documents: String(indexPolicy.max_documents ?? ""),
  };
}

export function ProfilesPage() {
  const auth = useAuth();
  const { api, profiles, refreshProfiles, selectedProfileId, setSelectedProfileId } = useDbMcpState();
  const [selectedProfile, setSelectedProfile] = React.useState<ProfileSummary | null>(null);
  const [dialogMode, setDialogMode] = React.useState<DialogMode>("add");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<ProfileFormState>(toFormState(null));
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<ProfileSummary | null>(null);

  const mayEditProfiles = canManageProfiles(auth.user);
  const dialogReadOnly = dialogMode === "view" || !mayEditProfiles;

  React.useEffect(() => {
    void refreshProfiles();
  }, [refreshProfiles]);

  const openDialog = (mode: DialogMode, profile: ProfileSummary | null = null) => {
    setSelectedProfile(profile);
    setDialogMode(mode);
    setForm(toFormState(profile));
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSelectedProfile(null);
    setForm(toFormState(null));
  };

  const submit = async () => {
    setError(null);
    try {
      const payload: ProfileDraft = {
        ...EMPTY_PROFILE,
        name: form.name.trim(),
        source_type: form.source_type.trim() || "mongodb",
        source_connection: form.source_connection.trim() || "default",
        description: form.description.trim(),
        namespaces: parseCsv(form.namespacesCsv),
        entities: parseCsv(form.entitiesCsv),
        enabled_tools: [...form.enabled_tools],
        allowed_permissions: [...form.allowed_permissions],
        field_masks: parseJsonRecord(form.fieldMasksJson),
        field_exclusions: parseCsv(form.fieldExclusionsCsv),
        index_policy: {
          enabled: form.index_enabled,
          include_content: form.index_include_content,
          content_fields: parseCsv(form.index_content_fields_csv),
          max_documents: form.index_max_documents.trim() ? Number(form.index_max_documents) : undefined,
        },
      };
      if (dialogMode === "edit" && selectedProfile) {
        await api.updateProfile(selectedProfile.profile_id, payload);
        setStatus(`Updated profile ${payload.name}.`);
      } else if (dialogMode === "add") {
        const created = await api.createProfile(payload);
        setSelectedProfileId(created.profile_id);
        setStatus(`Created profile ${payload.name}.`);
      }
      closeDialog();
      await refreshProfiles();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to save profile.");
    }
  };

  const remove = async (profile: ProfileSummary) => {
    setError(null);
    try {
      await api.deleteProfile(profile.profile_id);
      setStatus(`Deleted profile ${profile.name}.`);
      await refreshProfiles();
      if (selectedProfileId === profile.profile_id) setSelectedProfileId("");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete profile.");
    }
  };

  const bulkActions: BulkAction[] = mayEditProfiles ? [{ label: "Delete Selected", action: "delete" }] : [];

  const columns: DataColumn<ProfileSummary>[] = [
    {
      id: "name",
      header: "Name",
      cell: (item) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span>{item.name}</span>
            {item.profile_id === selectedProfileId ? <Badge>Active</Badge> : null}
          </div>
          {item.description ? <p className="text-xs text-muted-foreground">{item.description}</p> : null}
        </div>
      ),
      sortable: true,
      sortValue: (item) => item.name,
    },
    { id: "source", header: "Source", cell: (item) => item.source_type, sortable: true, sortValue: (item) => item.source_type },
    { id: "connection", header: "Connection", cell: (item) => item.source_connection, sortable: true, sortValue: (item) => item.source_connection },
    { id: "scope", header: "Scope", cell: (item) => `${item.namespaces.length || 0} namespaces / ${item.entities.length || 0} entities`, sortable: true, sortValue: (item) => item.namespaces.length + item.entities.length },
    { id: "tools", header: "Tools", cell: (item) => item.enabled_tools.join(", ") || "-", sortable: true, sortValue: (item) => item.enabled_tools.join(", ") },
    { id: "permissions", header: "Permissions", cell: (item) => item.allowed_permissions.slice(0, 4).join(", ") || "-", sortable: true, sortValue: (item) => item.allowed_permissions.join(", ") },
    {
      id: "actions",
      header: "Actions",
      cell: (item) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => openDialog("view", item)}>View</Button>
          {mayEditProfiles ? <Button size="sm" variant="secondary" onClick={() => openDialog("edit", item)}>Edit</Button> : null}
          <Button size="sm" variant={selectedProfileId === item.profile_id ? "default" : "secondary"} onClick={() => setSelectedProfileId(selectedProfileId === item.profile_id ? "" : item.profile_id)}>{selectedProfileId === item.profile_id ? "Active" : "Activate"}</Button>
          {mayEditProfiles ? <Button size="sm" variant="destructive" onClick={() => setConfirmDelete(item)}>Delete</Button> : null}
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">Profiles</h1>
        {mayEditProfiles ? <Button onClick={() => openDialog("add")}>Add Connection</Button> : null}
        <Button variant="secondary" size="sm" onClick={() => void refreshProfiles()}>Refresh</Button>
      </header>
      {!mayEditProfiles ? (
        <p className="text-sm text-muted-foreground">
          Profile editing is restricted to users with the <span className="font-medium">admin</span> or <span className="font-medium">data_steward</span> role.
        </p>
      ) : null}
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}
      <DataTable
        columns={columns}
        rows={profiles}
        emptyMessage="No profiles configured."
        page={page}
        pageSize={10}
        onPageChange={setPage}
        selectable={mayEditProfiles}
        bulkActions={bulkActions}
        onBulkAction={(action, selectedIds) => {
          if (!mayEditProfiles || action !== "delete") return;
          void Promise.all(
            profiles
              .filter((item) => selectedIds.includes(item.profile_id))
              .map((item) => api.deleteProfile(item.profile_id))
          ).then(async () => {
            await refreshProfiles();
            setStatus(`Deleted ${selectedIds.length} profiles.`);
          });
        }}
        columnPickerEnabled
        tableId="db-mcp-profiles"
        getRowId={(item) => item.profile_id}
      />
      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={dialogMode === "add" ? "Add connection" : dialogMode === "edit" ? "Edit connection" : "View connection"}
        fields={PROFILE_FIELDS}
        values={form as unknown as Record<string, unknown>}
        onChange={(name, value) => setForm((current) => ({ ...current, [name]: String(value ?? "") }))}
        onSubmit={() => {
          if (!dialogReadOnly) {
            void submit();
            return;
          }
          closeDialog();
        }}
        onCancel={closeDialog}
        mode={dialogReadOnly ? "view" : dialogMode}
        extra={(
          <div className="space-y-4 border-t pt-4">
            <div className="space-y-2">
              <Label>Enabled tool families <span className="text-xs font-normal text-muted-foreground">(select which MCP tool families this profile exposes)</span></Label>
              <div className="grid gap-2 md:grid-cols-2">
                {TOOL_OPTIONS.map((tool) => (
                  <label key={tool} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.enabled_tools.includes(tool)}
                      disabled={dialogReadOnly}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          enabled_tools: toggleListValue(current.enabled_tools, tool, event.currentTarget.checked),
                        }))
                      }
                    />
                    <span>{tool}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="space-y-2">
              <Label>Allowed permissions <span className="text-xs font-normal text-muted-foreground">(fine-grained access this profile grants)</span></Label>
              <div className="grid gap-2 md:grid-cols-2">
                {PERMISSION_OPTIONS.map((permission) => (
                  <label key={permission} className="flex items-center gap-2 text-sm">
                    <Checkbox
                      checked={form.allowed_permissions.includes(permission)}
                      disabled={dialogReadOnly}
                      onChange={(event) =>
                        setForm((current) => ({
                          ...current,
                          allowed_permissions: toggleListValue(current.allowed_permissions, permission, event.currentTarget.checked),
                        }))
                      }
                    />
                    <span>{permission}</span>
                  </label>
                ))}
              </div>
            </div>
            <div className="grid gap-4 md:grid-cols-2">
              <div className="space-y-2">
                <Label htmlFor="profile-field-masks">Field masks (JSON) <span className="text-xs font-normal text-muted-foreground">e.g. {`{"ssn": "****"}`}</span></Label>
                <Textarea
                  id="profile-field-masks"
                  rows={6}
                  value={form.fieldMasksJson}
                  disabled={dialogReadOnly}
                  onChange={(event) => setForm((current) => ({ ...current, fieldMasksJson: event.target.value }))}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="profile-field-exclusions">Field exclusions (comma-separated) <span className="text-xs font-normal text-muted-foreground">e.g. ssn, credit_card</span></Label>
                <Textarea
                  id="profile-field-exclusions"
                  rows={6}
                  value={form.fieldExclusionsCsv}
                  disabled={dialogReadOnly}
                  onChange={(event) => setForm((current) => ({ ...current, fieldExclusionsCsv: event.target.value }))}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Index policy <span className="text-xs font-normal text-muted-foreground">(controls discovery search indexing)</span></Label>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.index_enabled}
                    disabled={dialogReadOnly}
                    onChange={(event) => setForm((current) => ({ ...current, index_enabled: event.currentTarget.checked }))}
                  />
                  <span>Indexing enabled</span>
                </label>
                <label className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={form.index_include_content}
                    disabled={dialogReadOnly}
                    onChange={(event) => setForm((current) => ({ ...current, index_include_content: event.currentTarget.checked }))}
                  />
                  <span>Include content in discovery index</span>
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <Label htmlFor="profile-content-fields">Indexed content fields (comma-separated, e.g. name, email, description)</Label>
                  <Textarea
                    id="profile-content-fields"
                    rows={4}
                    value={form.index_content_fields_csv}
                    disabled={dialogReadOnly}
                    onChange={(event) => setForm((current) => ({ ...current, index_content_fields_csv: event.target.value }))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="profile-max-documents">Index max documents (number, e.g. 10000)</Label>
                  <Textarea
                    id="profile-max-documents"
                    rows={2}
                    value={form.index_max_documents}
                    disabled={dialogReadOnly}
                    onChange={(event) => setForm((current) => ({ ...current, index_max_documents: event.target.value }))}
                  />
                </div>
              </div>
            </div>
          </div>
        )}
      />
      <ConfirmDialog
        open={!!confirmDelete}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
        title="Delete profile"
        description={`Are you sure you want to delete profile "${confirmDelete?.name ?? ""}"? This action cannot be undone.`}
        confirmLabel="Delete"
        confirmVariant="destructive"
        onConfirm={() => {
          if (confirmDelete) void remove(confirmDelete);
          setConfirmDelete(null);
        }}
      />
    </div>
  );
}
