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
  HelpTip,
  Button,
  Checkbox,
  ConfirmDialog,
  ConnectionPicker,
  DataTable,
  Dialog,
  DiscoveredMultiSelect,
  Input,
  Label,
  ScopeTestPanel,
  Textarea,
  createDataTableActionColumn,
  type BulkAction,
  type ConnectionPickerOption,
  type DataColumn,
  type DiscoveredOption,
  type ScopeTestResult,
} from "@cloud-dog/ui";
import { FieldMaskEditor } from "../components/FieldMaskEditor";
import { canManageProfiles } from "../lib/access";
import { exportRowsJson } from "../lib/exportRows";
import { useDbMcpState } from "../state/AppState";
import type { EntityItem, PrincipalSummary, ProfileDraft, ProfileScopeTestApiResult, ProfileSummary, SourceConnectionSummary } from "../lib/types";

type DialogMode = "add" | "edit" | "view";

type ProfileFormState = Readonly<{
  name: string;
  source_type: string;
  source_connection: string;
  description: string;
  namespaces: string[];
  entities: string[];
  field_masks: Record<string, string>;
  field_exclusions: string[];
  enabled_tools: string[];
  allowed_permissions: string[];
  index_enabled: boolean;
  index_include_content: boolean;
  index_content_fields: string[];
  index_max_documents: string;
}>;

const TOOL_OPTIONS = ["catalog", "schema", "content", "relationship", "data", "index", "audit"] as const;

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

const EMPTY_FORM: ProfileFormState = {
  name: "",
  source_type: "",
  source_connection: "",
  description: "",
  namespaces: [],
  entities: [],
  field_masks: {},
  field_exclusions: [],
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
  index_enabled: true,
  index_include_content: true,
  index_content_fields: [],
  index_max_documents: "10000",
};

function toFormState(profile: ProfileSummary | null): ProfileFormState {
  if (!profile) return EMPTY_FORM;
  const indexPolicy = profile.index_policy ?? {};
  const contentFields = Array.isArray(indexPolicy.content_fields)
    ? indexPolicy.content_fields.map((item) => String(item))
    : [];

  return {
    name: profile.name,
    source_type: profile.source_type,
    source_connection: profile.source_connection,
    description: profile.description,
    namespaces: [...profile.namespaces],
    entities: [...profile.entities],
    field_masks: { ...profile.field_masks },
    field_exclusions: [...profile.field_exclusions],
    enabled_tools: [...profile.enabled_tools],
    allowed_permissions: [...profile.allowed_permissions],
    index_enabled: Boolean(indexPolicy.enabled ?? true),
    index_include_content: Boolean(indexPolicy.include_content ?? true),
    index_content_fields: contentFields,
    index_max_documents: String(indexPolicy.max_documents ?? "10000"),
  };
}

function toDraft(form: ProfileFormState): ProfileDraft {
  return {
    name: form.name.trim(),
    source_type: form.source_type.trim(),
    source_connection: form.source_connection.trim(),
    description: form.description.trim(),
    namespaces: [...form.namespaces],
    entities: [...form.entities],
    enabled_tools: [...form.enabled_tools],
    allowed_permissions: [...form.allowed_permissions],
    field_masks: { ...form.field_masks },
    field_exclusions: [...form.field_exclusions],
    index_policy: {
      enabled: form.index_enabled,
      include_content: form.index_include_content,
      content_fields: [...form.index_content_fields],
      max_documents: form.index_max_documents.trim() ? Number(form.index_max_documents) : undefined,
    },
  };
}

function toggleListValue(values: string[], nextValue: string, checked: boolean): string[] {
  if (checked) return Array.from(new Set([...values, nextValue]));
  return values.filter((value) => value !== nextValue);
}

function serverPrincipalCanManageProfiles(principal: PrincipalSummary | null): boolean {
  const roles = principal?.roles ?? [];
  const permissions = principal?.permissions ?? [];
  return roles.includes("admin") || roles.includes("data_steward") || permissions.includes("*") || permissions.includes("profile.manage");
}

function connectionToOption(connection: SourceConnectionSummary): ConnectionPickerOption {
  return {
    name: connection.name,
    sourceType: connection.source_type,
    status: connection.status,
    description: connection.description,
  };
}

function itemsToOptions(items: Array<{ name: string; type?: string; types?: string[] }>): DiscoveredOption[] {
  return items.map((item) => ({
    value: item.name,
    label: item.type ? `${item.name} (${item.type})` : item.types?.length ? `${item.name} (${item.types.join("|")})` : item.name,
  }));
}

function scopeTestToPanelResult(result: ProfileScopeTestApiResult): ScopeTestResult {
  const accessible = [
    ...(result.namespaces ?? []).map((namespace) => ({ namespace: namespace.name })),
    ...Object.entries(result.entities_by_namespace ?? {}).flatMap(([namespace, entities]) =>
      entities.map((entity: EntityItem) => ({ namespace, entity: entity.name }))
    ),
  ];
  return {
    status: result.ok ? "OK" : "FAIL",
    latencyMs: result.latency_ms,
    accessible,
    errors: result.ok || !result.error ? [] : [result.error],
  };
}

export function ProfilesPage() {
  const auth = useAuth();
  const { api, profiles, refreshProfiles, selectedProfileId, setSelectedProfileId } = useDbMcpState();
  const [principal, setPrincipal] = React.useState<PrincipalSummary | null>(null);
  const [sourceConnections, setSourceConnections] = React.useState<SourceConnectionSummary[]>([]);
  const [selectedProfile, setSelectedProfile] = React.useState<ProfileSummary | null>(null);
  const [dialogMode, setDialogMode] = React.useState<DialogMode>("add");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<ProfileFormState>(EMPTY_FORM);
  const [namespaceOptions, setNamespaceOptions] = React.useState<DiscoveredOption[]>([]);
  const [entityOptions, setEntityOptions] = React.useState<DiscoveredOption[]>([]);
  const [fieldOptions, setFieldOptions] = React.useState<DiscoveredOption[]>([]);
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [discoveryError, setDiscoveryError] = React.useState<string | null>(null);
  const [discoveryLoading, setDiscoveryLoading] = React.useState(false);
  const [scopeRunning, setScopeRunning] = React.useState(false);
  const [scopeResult, setScopeResult] = React.useState<ScopeTestResult | null>(null);
  const [confirmDelete, setConfirmDelete] = React.useState<ProfileSummary | null>(null);

  const mayEditProfiles = canManageProfiles(auth.user) || serverPrincipalCanManageProfiles(principal);
  const dialogReadOnly = dialogMode === "view" || !mayEditProfiles;

  const connectionOptions = React.useMemo(() => sourceConnections.map(connectionToOption), [sourceConnections]);
  const effectiveConnectionOptions = React.useMemo(() => {
    if (!form.source_connection || connectionOptions.some((option) => option.name === form.source_connection)) {
      return connectionOptions;
    }
    return [
      ...connectionOptions,
      {
        name: form.source_connection,
        label: `${form.source_connection} (stale)`,
        sourceType: form.source_type || "unknown",
        status: "stale",
        disabled: true,
      },
    ];
  }, [connectionOptions, form.source_connection, form.source_type]);

  const loadSourceConnections = React.useCallback(async () => {
    setSourceConnections(await api.listSourceConnections());
  }, [api]);

  React.useEffect(() => {
    void refreshProfiles();
    void loadSourceConnections().catch((loadError) => {
      setError(loadError instanceof Error ? loadError.message : "Failed to load source connections.");
    });
    api.currentPrincipal()
      .then(setPrincipal)
      .catch(() => setPrincipal(null));
  }, [api, loadSourceConnections, refreshProfiles]);

  async function loadNamespaces(connectionName: string, refresh = false) {
    if (!connectionName) {
      setNamespaceOptions([]);
      return;
    }
    setDiscoveryLoading(true);
    setDiscoveryError(null);
    try {
      const discovered = await api.discoverNamespaces({ connection_name: connectionName, refresh });
      setNamespaceOptions(itemsToOptions(discovered.items));
    } catch (loadError) {
      setDiscoveryError(loadError instanceof Error ? loadError.message : "Failed to discover namespaces.");
    } finally {
      setDiscoveryLoading(false);
    }
  }

  async function loadEntities(profileId: string | undefined, namespace: string, refresh = false) {
    if (!profileId || !namespace || namespace === "*") {
      setEntityOptions([]);
      return;
    }
    setDiscoveryLoading(true);
    setDiscoveryError(null);
    try {
      const discovered = await api.discoverEntities({ profile_id: profileId, namespace, refresh });
      setEntityOptions(itemsToOptions(discovered.items));
    } catch (loadError) {
      setDiscoveryError(loadError instanceof Error ? loadError.message : "Failed to discover entities.");
    } finally {
      setDiscoveryLoading(false);
    }
  }

  async function loadFields(profileId: string | undefined, namespace: string, entity: string, refresh = false) {
    if (!profileId || !namespace || !entity || namespace === "*" || entity === "*") {
      setFieldOptions([]);
      return;
    }
    setDiscoveryLoading(true);
    setDiscoveryError(null);
    try {
      const discovered = await api.discoverFields({ profile_id: profileId, namespace, entity, refresh });
      setFieldOptions(itemsToOptions(discovered.items));
    } catch (loadError) {
      setDiscoveryError(loadError instanceof Error ? loadError.message : "Failed to discover fields.");
    } finally {
      setDiscoveryLoading(false);
    }
  }

  function openDialog(mode: DialogMode, profile: ProfileSummary | null = null) {
    const nextForm = toFormState(profile);
    setSelectedProfile(profile);
    setDialogMode(mode);
    setForm(nextForm);
    setError(null);
    setDiscoveryError(null);
    setScopeResult(null);
    setNamespaceOptions([]);
    setEntityOptions([]);
    setFieldOptions([]);
    setDialogOpen(true);
    if (nextForm.source_connection) void loadNamespaces(nextForm.source_connection);
    if (profile && nextForm.namespaces[0]) void loadEntities(profile.profile_id, nextForm.namespaces[0]);
    if (profile && nextForm.namespaces[0] && nextForm.entities[0]) void loadFields(profile.profile_id, nextForm.namespaces[0], nextForm.entities[0]);
  }

  function closeDialog() {
    setDialogOpen(false);
    setSelectedProfile(null);
    setForm(EMPTY_FORM);
    setScopeResult(null);
    setDiscoveryError(null);
  }

  async function submit() {
    setError(null);
    const payload = toDraft(form);
    if (!payload.name || !payload.source_connection || !payload.source_type) {
      setError("Name and source connection are required.");
      return;
    }
    try {
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
  }

  async function runScopeTest() {
    if (!selectedProfile) {
      setScopeResult({ status: "WARN", warnings: ["Save the profile before running a scope test."] });
      return;
    }
    setScopeRunning(true);
    setError(null);
    try {
      setScopeResult(scopeTestToPanelResult(await api.testProfileScope(selectedProfile.profile_id, toDraft(form))));
    } catch (testError) {
      setScopeResult({
        status: "FAIL",
        errors: [testError instanceof Error ? testError.message : "Scope test failed."],
      });
    } finally {
      setScopeRunning(false);
    }
  }

  async function remove(profile: ProfileSummary) {
    setError(null);
    try {
      await api.deleteProfile(profile.profile_id);
      setStatus(`Deleted profile ${profile.name}.`);
      await refreshProfiles();
      if (selectedProfileId === profile.profile_id) setSelectedProfileId("");
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete profile.");
    }
  }

  const bulkActions: BulkAction[] = [
    ...(mayEditProfiles ? [{ label: "Delete Selected", action: "delete" }] : []),
    { label: "Export", action: "export" },
  ];

  const columns: DataColumn<ProfileSummary>[] = [
    {
      id: "name",
      header: "Name",
      cell: (item) => (
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <button
              className="text-primary underline underline-offset-2 hover:no-underline"
              onClick={() => openDialog("view", item)}
              role="link"
              title={`View profile ${item.name}`}
              type="button"
            >
              {item.name}
            </button>
            {item.profile_id === selectedProfileId ? (
              <span className="inline-flex items-center gap-1">
                <Badge>Active</Badge>
                <HelpTip
                  label="Active profile"
                  help="Active marks the profile currently selected across DB-MCP — catalogue, data browser, search, and schema use its connection and scope. Open another profile and choose View/Use to switch."
                  data-testid="profile-active-help"
                />
              </span>
            ) : null}
          </div>
          {item.description ? <p className="text-xs text-muted-foreground">{item.description}</p> : null}
        </div>
      ),
      sortable: true,
      sortValue: (item) => item.name,
    },
    { id: "source_connection", header: "Source connection", cell: (item) => item.source_connection, sortable: true, sortValue: (item) => item.source_connection },
    { id: "source_type", header: "Source type", cell: (item) => item.source_type, sortable: true, sortValue: (item) => item.source_type },
    { id: "namespaces", header: "Namespaces", cell: (item) => item.namespaces.join(", ") || "*", sortable: true, sortValue: (item) => item.namespaces.join(", ") },
    { id: "entities", header: "Entities", cell: (item) => item.entities.join(", ") || "*", sortable: true, sortValue: (item) => item.entities.join(", ") },
    {
      id: "tools",
      header: "Tools enabled",
      cell: (item) => (
        <Badge title={item.enabled_tools.join(", ") || "No tools enabled"}>
          {item.enabled_tools.length} / {TOOL_OPTIONS.length}
        </Badge>
      ),
      sortable: true,
      sortValue: (item) => item.enabled_tools.length,
    },
    createDataTableActionColumn<ProfileSummary>((item) => [
      { id: "view", label: "View", onClick: () => openDialog("view", item) },
      ...(mayEditProfiles ? [{ id: "edit", label: "Edit", onClick: () => openDialog("edit", item) }] : []),
      { id: "catalogue", label: "Catalogue", href: () => `/catalogue/${encodeURIComponent(item.profile_id)}` },
      { id: "schema", label: "Schema", href: () => `/schema?profile=${encodeURIComponent(item.profile_id)}` },
      { id: "audit", label: "Audit & Log", href: () => `/audit-log?profile_id=${encodeURIComponent(item.profile_id)}` },
      ...(mayEditProfiles ? [{ id: "delete", label: "Delete", destructive: true, onClick: () => setConfirmDelete(item) }] : []),
    ]),
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <h1 className="text-2xl font-semibold">Profiles</h1>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            onClick={() => {
              void refreshProfiles();
              void loadSourceConnections();
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            Refresh
          </Button>
          {mayEditProfiles ? <Button onClick={() => openDialog("add")} type="button">Add Profile</Button> : null}
        </div>
      </header>
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      {status ? <p className="text-sm text-foreground/80" role="status">{status}</p> : null}
      <DataTable
        ariaLabel="Profiles"
        bulkActions={bulkActions}
        columnPickerEnabled
        columns={columns}
        emptyMessage="No profiles configured."
        getRowId={(item) => item.profile_id}
        onBulkAction={(action, selectedIds) => {
          const selectedRows = profiles.filter((item) => selectedIds.includes(item.profile_id));
          if (action === "export") {
            exportRowsJson(selectedRows, "db-mcp-profiles.json");
            return;
          }
          if (!mayEditProfiles || action !== "delete") return;
          void Promise.all(selectedRows.map((item) => api.deleteProfile(item.profile_id))).then(async () => {
            await refreshProfiles();
            setStatus(`Deleted ${selectedIds.length} profiles.`);
          });
        }}
        onPageChange={setPage}
        page={page}
        pageSize={10}
        rows={profiles}
        selectable
        tableId="db-mcp-profiles"
      />
      <ProfileDialog
        connectionOptions={effectiveConnectionOptions}
        discoveryError={discoveryError}
        discoveryLoading={discoveryLoading}
        entityOptions={entityOptions}
        fieldOptions={fieldOptions}
        form={form}
        mode={dialogMode}
        namespaceOptions={namespaceOptions}
        open={dialogOpen}
        readOnly={dialogReadOnly}
        scopeResult={scopeResult}
        scopeRunning={scopeRunning}
        selectedProfile={selectedProfile}
        setForm={setForm}
        onCancel={closeDialog}
        onConnectionChange={(connection) => {
          setForm((current) => ({
            ...current,
            source_connection: connection?.name ?? "",
            source_type: connection?.sourceType ?? "",
            namespaces: [],
            entities: [],
            field_exclusions: [],
            field_masks: {},
            index_content_fields: [],
          }));
          setEntityOptions([]);
          setFieldOptions([]);
          if (connection) void loadNamespaces(connection.name, true);
        }}
        onEntitiesChange={(values) => {
          setForm((current) => ({ ...current, entities: values }));
          if (selectedProfile && form.namespaces[0] && values[0]) void loadFields(selectedProfile.profile_id, form.namespaces[0], values[0]);
        }}
        onNamespaceRefresh={() => void loadNamespaces(form.source_connection, true)}
        onNamespacesChange={(values) => {
          setForm((current) => ({ ...current, namespaces: values, entities: [] }));
          setFieldOptions([]);
          if (selectedProfile && values[0]) void loadEntities(selectedProfile.profile_id, values[0], true);
        }}
        onOpenChange={(open) => { if (!open) closeDialog(); }}
        onRefreshEntities={() => void loadEntities(selectedProfile?.profile_id, form.namespaces[0], true)}
        onRefreshFields={() => void loadFields(selectedProfile?.profile_id, form.namespaces[0], form.entities[0], true)}
        onRunScopeTest={() => void runScopeTest()}
        onSubmit={() => void submit()}
      />
      <ConfirmDialog
        confirmLabel="Delete"
        confirmVariant="destructive"
        description={`Delete profile "${confirmDelete?.name ?? ""}"?`}
        open={Boolean(confirmDelete)}
        targetName={confirmDelete?.name}
        title="Delete Profile"
        onConfirm={() => {
          if (confirmDelete) void remove(confirmDelete);
          setConfirmDelete(null);
        }}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
      />
    </div>
  );
}

function ProfileDialog({
  connectionOptions,
  discoveryError,
  discoveryLoading,
  entityOptions,
  fieldOptions,
  form,
  mode,
  namespaceOptions,
  open,
  readOnly,
  scopeResult,
  scopeRunning,
  selectedProfile,
  setForm,
  onCancel,
  onConnectionChange,
  onEntitiesChange,
  onNamespaceRefresh,
  onNamespacesChange,
  onOpenChange,
  onRefreshEntities,
  onRefreshFields,
  onRunScopeTest,
  onSubmit,
}: {
  connectionOptions: readonly ConnectionPickerOption[];
  discoveryError: string | null;
  discoveryLoading: boolean;
  entityOptions: readonly DiscoveredOption[];
  fieldOptions: readonly DiscoveredOption[];
  form: ProfileFormState;
  mode: DialogMode;
  namespaceOptions: readonly DiscoveredOption[];
  open: boolean;
  readOnly: boolean;
  scopeResult: ScopeTestResult | null;
  scopeRunning: boolean;
  selectedProfile: ProfileSummary | null;
  setForm: React.Dispatch<React.SetStateAction<ProfileFormState>>;
  onCancel: () => void;
  onConnectionChange: (connection: ConnectionPickerOption | null) => void;
  onEntitiesChange: (values: string[]) => void;
  onNamespaceRefresh: () => void;
  onNamespacesChange: (values: string[]) => void;
  onOpenChange: (open: boolean) => void;
  onRefreshEntities: () => void;
  onRefreshFields: () => void;
  onRunScopeTest: () => void;
  onSubmit: () => void;
}) {
  const title = mode === "add" ? "Add Profile" : mode === "edit" ? "Edit Profile" : "View Profile";
  return (
    <Dialog label={title} open={open} onOpenChange={onOpenChange}>
      <form
        className="space-y-5"
        onSubmit={(event) => {
          event.preventDefault();
          if (readOnly) {
            onCancel();
            return;
          }
          onSubmit();
        }}
      >
        <h2 className="text-lg font-semibold">{title}</h2>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="profile-name">Name</Label>
            <Input
              disabled={readOnly}
              id="profile-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </div>
          <ConnectionPicker
            disabled={readOnly}
            id="profile-source-connection"
            label="Source connection"
            loading={discoveryLoading && connectionOptions.length === 0}
            options={connectionOptions}
            value={form.source_connection}
            onChange={onConnectionChange}
          />
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="space-y-1">
            <Label htmlFor="profile-source-type">Source type</Label>
            <Input disabled id="profile-source-type" value={form.source_type} />
          </div>
          <div className="space-y-1">
            <Label htmlFor="profile-description">Description</Label>
            <Textarea
              disabled={readOnly}
              id="profile-description"
              rows={2}
              value={form.description}
              onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
            />
          </div>
        </div>
        {discoveryError ? <p className="text-sm text-destructive" role="alert">{discoveryError}</p> : null}
        <DiscoveredMultiSelect
          allowWildcard
          disabled={readOnly || !form.source_connection}
          label="Namespaces"
          loading={discoveryLoading}
          options={namespaceOptions}
          values={form.namespaces}
          onChange={onNamespacesChange}
          onRefresh={onNamespaceRefresh}
        />
        <DiscoveredMultiSelect
          allowWildcard
          disabled={readOnly || form.namespaces.length === 0}
          label="Entities"
          loading={discoveryLoading}
          options={entityOptions}
          values={form.entities}
          onChange={onEntitiesChange}
          onRefresh={onRefreshEntities}
        />
        <div className="space-y-4 border-t pt-4">
          <FieldMaskEditor disabled={readOnly} options={fieldOptions} value={form.field_masks} onChange={(field_masks) => setForm((current) => ({ ...current, field_masks }))} />
          <DiscoveredMultiSelect
            disabled={readOnly}
            label="Field exclusions"
            loading={discoveryLoading}
            options={fieldOptions}
            values={form.field_exclusions}
            onChange={(field_exclusions) => setForm((current) => ({ ...current, field_exclusions }))}
            onRefresh={onRefreshFields}
          />
        </div>
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center gap-1">
            <Label>Enabled tools</Label>
            <HelpTip label="Enabled tools" help="MCP tools this profile may invoke. Unchecked tools are blocked for principals scoped to this profile, regardless of their global role." />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {TOOL_OPTIONS.map((tool) => (
              <label className="flex items-center gap-2 text-sm" key={tool}>
                <Checkbox
                  checked={form.enabled_tools.includes(tool)}
                  disabled={readOnly}
                  onChange={(event) => setForm((current) => ({ ...current, enabled_tools: toggleListValue(current.enabled_tools, tool, event.currentTarget.checked) }))}
                />
                <span>{tool}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center gap-1">
            <Label>Allowed permissions</Label>
            <HelpTip label="Allowed permissions" help="Read/write/admin actions permitted through this profile. Destructive verbs (drop, truncate, delete-without-filter) always require execute mode plus an approval token in addition to the permission." />
          </div>
          <div className="grid gap-2 md:grid-cols-2">
            {PERMISSION_OPTIONS.map((permission) => (
              <label className="flex items-center gap-2 text-sm" key={permission}>
                <Checkbox
                  checked={form.allowed_permissions.includes(permission)}
                  disabled={readOnly}
                  onChange={(event) => setForm((current) => ({ ...current, allowed_permissions: toggleListValue(current.allowed_permissions, permission, event.currentTarget.checked) }))}
                />
                <span>{permission}</span>
              </label>
            ))}
          </div>
        </div>
        <div className="space-y-3 border-t pt-4">
          <div className="flex items-center gap-1">
            <Label>Index policy</Label>
            <HelpTip label="Index policy" help="Controls the discovery index for this profile: whether entities/fields are indexed, whether document content is included, which content fields are indexed, and the maximum documents scanned per rebuild." />
          </div>
          <div className="grid gap-3 md:grid-cols-2">
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.index_enabled}
                disabled={readOnly}
                onChange={(event) => setForm((current) => ({ ...current, index_enabled: event.currentTarget.checked }))}
              />
              <span>Indexing enabled</span>
            </label>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={form.index_include_content}
                disabled={readOnly}
                onChange={(event) => setForm((current) => ({ ...current, index_include_content: event.currentTarget.checked }))}
              />
              <span>Include content</span>
            </label>
          </div>
          <DiscoveredMultiSelect
            disabled={readOnly}
            label="Content fields"
            loading={discoveryLoading}
            options={fieldOptions}
            values={form.index_content_fields}
            onChange={(index_content_fields) => setForm((current) => ({ ...current, index_content_fields }))}
            onRefresh={onRefreshFields}
          />
          <div className="space-y-1">
            <Label htmlFor="profile-max-documents">Max documents</Label>
            <Input
              disabled={readOnly}
              id="profile-max-documents"
              inputMode="numeric"
              value={form.index_max_documents}
              onChange={(event) => setForm((current) => ({ ...current, index_max_documents: event.target.value }))}
            />
          </div>
        </div>
        <ScopeTestPanel result={scopeResult} running={scopeRunning} onRun={onRunScopeTest} />
        <div className="flex flex-wrap justify-end gap-2 pt-2">
          {selectedProfile ? (
            <Button asChild type="button" variant="secondary">
              <a href={`/catalogue/${encodeURIComponent(selectedProfile.profile_id)}`}>View in Catalogue</a>
            </Button>
          ) : null}
          <Button type="button" variant="secondary" onClick={onCancel}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly ? <Button type="submit">{mode === "add" ? "Create" : "Save"}</Button> : null}
        </div>
      </form>
    </Dialog>
  );
}
