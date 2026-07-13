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
  ActionableError,
  Button,
  ConfirmDialog,
  DataTable,
  Dialog,
  Input,
  Label,
  Select,
  StatusBadge,
  Textarea,
  createDataTableActionColumn,
  type DataColumn,
} from "@cloud-dog/ui";
import { canManageSourceConnections } from "../lib/access";
import { useDbMcpState } from "../state/AppState";
import type { PrincipalSummary, SourceConnectionDraft, SourceConnectionSummary } from "../lib/types";

type DialogMode = "add" | "edit" | "view";

type SourceConnectionFormState = Readonly<{
  name: string;
  source_type: string;
  uri_template: string;
  credentials_ref: string;
  description: string;
}>;

type ActionableDeleteError = Readonly<{
  connectionName: string;
  message: string;
}>;

const SOURCE_TYPES = ["postgresql", "mysql", "mariadb", "sqlite", "mongodb", "elasticsearch", "opensearch", "couchdb", "cassandra"] as const;

const EMPTY_FORM: SourceConnectionFormState = {
  name: "",
  source_type: "postgresql",
  uri_template: "",
  credentials_ref: "",
  description: "",
};

function toFormState(connection: SourceConnectionSummary | null): SourceConnectionFormState {
  if (!connection) return EMPTY_FORM;
  return {
    name: connection.name,
    source_type: connection.source_type,
    uri_template: connection.uri_template,
    credentials_ref: connection.credentials_ref ?? "",
    description: connection.description ?? "",
  };
}

function toDraft(form: SourceConnectionFormState): SourceConnectionDraft {
  return {
    name: form.name.trim(),
    source_type: form.source_type,
    uri_template: form.uri_template.trim(),
    credentials_ref: form.credentials_ref.trim() || null,
    description: form.description.trim(),
  };
}

function errorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.message ? error.message : fallback;
}

function actionableDeleteLabel(message: string): string {
  const match = message.match(/unbind\s+\d+\s+profiles?\s+first/i)?.[0];
  if (!match) {
    return "Unbind profiles first";
  }
  return match.charAt(0).toUpperCase() + match.slice(1);
}

function serverPrincipalCanManage(principal: PrincipalSummary | null): boolean {
  const roles = principal?.roles ?? [];
  const permissions = principal?.permissions ?? [];
  return roles.includes("admin") || permissions.includes("*") || permissions.includes("admin.write");
}

export function SourceConnectionsPage() {
  const auth = useAuth();
  const { api } = useDbMcpState();
  const [principal, setPrincipal] = React.useState<PrincipalSummary | null>(null);
  const mayManage = canManageSourceConnections(auth.user) || serverPrincipalCanManage(principal);
  const [connections, setConnections] = React.useState<SourceConnectionSummary[]>([]);
  const [page, setPage] = React.useState(1);
  const [loading, setLoading] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [actionableError, setActionableError] = React.useState<ActionableDeleteError | null>(null);
  const [dialogMode, setDialogMode] = React.useState<DialogMode>("add");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [selected, setSelected] = React.useState<SourceConnectionSummary | null>(null);
  const [form, setForm] = React.useState<SourceConnectionFormState>(EMPTY_FORM);
  const [confirmDelete, setConfirmDelete] = React.useState<SourceConnectionSummary | null>(null);

  const loadConnections = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setConnections(await api.listSourceConnections());
    } catch (loadError) {
      setError(errorMessage(loadError, "Failed to load source connections."));
    } finally {
      setLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    void loadConnections();
  }, [loadConnections]);

  React.useEffect(() => {
    let cancelled = false;
    api.currentPrincipal()
      .then((nextPrincipal) => {
        if (!cancelled) setPrincipal(nextPrincipal);
      })
      .catch(() => {
        if (!cancelled) setPrincipal(null);
      });
    return () => {
      cancelled = true;
    };
  }, [api]);

  function openDialog(mode: DialogMode, connection: SourceConnectionSummary | null = null) {
    setDialogMode(mode);
    setSelected(connection);
    setForm(toFormState(connection));
    setError(null);
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setSelected(null);
    setForm(EMPTY_FORM);
  }

  async function save() {
    setError(null);
    const payload = toDraft(form);
    if (!payload.name || !payload.uri_template) {
      setError("Name and URI template are required.");
      return;
    }
    try {
      if (dialogMode === "add") {
        await api.createSourceConnection(payload);
        setStatus(`Created source connection ${payload.name}.`);
      } else if (selected) {
        await api.updateSourceConnection(selected.name, {
          uri_template: payload.uri_template,
          credentials_ref: payload.credentials_ref,
          description: payload.description,
        });
        setStatus(`Updated source connection ${selected.name}.`);
      }
      closeDialog();
      await loadConnections();
    } catch (saveError) {
      setError(errorMessage(saveError, "Failed to save source connection."));
    }
  }

  async function testConnection(connection: SourceConnectionSummary) {
    setStatus("");
    setError(null);
    try {
      const updated = await api.testSourceConnection(connection.name);
      setStatus(`Tested ${connection.name}: ${updated.status}.`);
      await loadConnections();
    } catch (testError) {
      setError(errorMessage(testError, "Failed to test source connection."));
    }
  }

  async function deleteConnection(connection: SourceConnectionSummary) {
    setActionableError(null);
    setError(null);
    try {
      await api.deleteSourceConnection(connection.name);
      setStatus(`Deleted source connection ${connection.name}.`);
      await loadConnections();
    } catch (deleteError) {
      const message = errorMessage(deleteError, `Cannot delete source connection ${connection.name}.`);
      if (/unbind\s+\d+\s+profiles?/i.test(message)) {
        setActionableError({ connectionName: connection.name, message });
      } else {
        setError(message);
      }
    }
  }

  const columns: DataColumn<SourceConnectionSummary>[] = [
    {
      id: "name",
      header: "Name",
      cell: (item) => (
        <button
          className="text-primary underline underline-offset-2 hover:no-underline"
          onClick={() => openDialog("view", item)}
          role="link"
          type="button"
        >
          {item.name}
        </button>
      ),
      sortable: true,
      sortValue: (item) => item.name,
    },
    { id: "source_type", header: "Type", cell: (item) => item.source_type, sortable: true, sortValue: (item) => item.source_type },
    { id: "status", header: "Status", cell: (item) => <StatusBadge value={item.status} />, sortable: true, sortValue: (item) => item.status },
    { id: "description", header: "Description", cell: (item) => item.description || "-", sortable: true, sortValue: (item) => item.description || "" },
    {
      id: "last_tested_at",
      header: "Last tested",
      cell: (item) => item.last_tested_at ? new Date(item.last_tested_at).toLocaleString() : "-",
      sortable: true,
      sortValue: (item) => item.last_tested_at ?? "",
    },
    createDataTableActionColumn<SourceConnectionSummary>((item) => [
      { id: "inspect", label: "Inspect", onClick: () => openDialog("view", item) },
      ...(mayManage ? [{ id: "edit", label: "Edit", onClick: () => openDialog("edit", item) }] : []),
      { id: "test", label: "Test", onClick: () => void testConnection(item) },
      { id: "audit", label: "Audit & Log", href: () => `/audit-log?target_type=source_connection&target_id=${encodeURIComponent(item.name)}` },
      ...(mayManage ? [{ id: "delete", label: "Delete", destructive: true, onClick: () => setConfirmDelete(item) }] : []),
    ]),
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold">Source Connections</h1>
          {mayManage ? <Button onClick={() => openDialog("add")}>Add Source Connection</Button> : null}
          <Button disabled={loading} onClick={() => void loadConnections()} size="sm" variant="secondary">
            Refresh
          </Button>
        </div>
      </header>
      {actionableError ? (
        <ActionableError
          action={{
            href: `/admin/profiles?source_connection=${encodeURIComponent(actionableError.connectionName)}`,
            label: actionableDeleteLabel(actionableError.message),
          }}
          message={actionableError.message}
        />
      ) : null}
      {error ? <p className="text-sm text-destructive" role="alert">{error}</p> : null}
      {status ? <p className="text-sm text-foreground/80" role="status">{status}</p> : null}
      <DataTable
        ariaLabel="Source connections"
        columnPickerEnabled
        columns={columns}
        emptyMessage={loading ? "Loading source connections..." : "No source connections configured."}
        getRowId={(item) => item.name}
        page={page}
        pageSize={10}
        rows={connections}
        tableId="db-mcp-source-connections"
        onPageChange={setPage}
      />
      <SourceConnectionDialog
        form={form}
        mode={dialogMode}
        open={dialogOpen}
        readOnly={dialogMode === "view" || !mayManage}
        selected={selected}
        setForm={setForm}
        onCancel={closeDialog}
        onOpenChange={(open) => {
          if (open) {
            setDialogOpen(true);
            return;
          }
          closeDialog();
        }}
        onSubmit={() => void save()}
      />
      <ConfirmDialog
        confirmLabel="Delete"
        confirmVariant="destructive"
        description={`Delete source connection "${confirmDelete?.name ?? ""}"? Profiles that reference it must be unbound first.`}
        open={Boolean(confirmDelete)}
        targetName={confirmDelete?.name}
        title="Delete source connection"
        onConfirm={() => {
          if (confirmDelete) void deleteConnection(confirmDelete);
          setConfirmDelete(null);
        }}
        onOpenChange={(open) => { if (!open) setConfirmDelete(null); }}
      />
    </div>
  );
}

function SourceConnectionDialog({
  form,
  mode,
  open,
  readOnly,
  selected,
  setForm,
  onCancel,
  onOpenChange,
  onSubmit,
}: {
  form: SourceConnectionFormState;
  mode: DialogMode;
  open: boolean;
  readOnly: boolean;
  selected: SourceConnectionSummary | null;
  setForm: React.Dispatch<React.SetStateAction<SourceConnectionFormState>>;
  onCancel: () => void;
  onOpenChange: (open: boolean) => void;
  onSubmit: () => void;
}) {
  const title = mode === "add" ? "Add Source Connection" : mode === "edit" ? "Edit Source Connection" : "View Source Connection";
  return (
    <Dialog label={title} open={open} onOpenChange={onOpenChange}>
      <form
        className="space-y-4"
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
          <div className="space-y-1 text-sm">
            <Label htmlFor="source-connection-name">Name</Label>
            <Input
              aria-label="Name"
              disabled={readOnly || mode !== "add"}
              id="source-connection-name"
              value={form.name}
              onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))}
            />
          </div>
          <div className="space-y-1 text-sm">
            <Label htmlFor="source-connection-type">Source type</Label>
            <Select
              aria-label="Source type"
              disabled={readOnly || mode !== "add"}
              id="source-connection-type"
              value={form.source_type}
              onChange={(event) => setForm((current) => ({ ...current, source_type: event.target.value }))}
            >
              {SOURCE_TYPES.map((sourceType) => <option key={sourceType} value={sourceType}>{sourceType}</option>)}
            </Select>
          </div>
        </div>
        <div className="space-y-1 text-sm">
          <Label htmlFor="source-connection-uri">URI template</Label>
          <Textarea
            aria-label="URI template"
            disabled={readOnly}
            id="source-connection-uri"
            rows={3}
            value={form.uri_template}
            onChange={(event) => setForm((current) => ({ ...current, uri_template: event.target.value }))}
          />
        </div>
        <div className="space-y-1 text-sm">
          <Label htmlFor="source-connection-credentials">Credentials ref</Label>
          <Input
            aria-label="Credentials ref"
            disabled={readOnly}
            id="source-connection-credentials"
            value={form.credentials_ref}
            onChange={(event) => setForm((current) => ({ ...current, credentials_ref: event.target.value }))}
          />
        </div>
        <div className="space-y-1 text-sm">
          <Label htmlFor="source-connection-description">Description</Label>
          <Textarea
            aria-label="Description"
            disabled={readOnly}
            id="source-connection-description"
            rows={3}
            value={form.description}
            onChange={(event) => setForm((current) => ({ ...current, description: event.target.value }))}
          />
        </div>
        {selected?.last_test_result ? (
          <pre className="max-h-40 overflow-auto rounded-md bg-muted p-3 text-xs">{JSON.stringify(selected.last_test_result, null, 2)}</pre>
        ) : null}
        <div className="flex justify-end gap-2 pt-2">
          <Button type="button" variant="secondary" onClick={onCancel}>
            {readOnly ? "Close" : "Cancel"}
          </Button>
          {!readOnly ? <Button type="submit">{mode === "add" ? "Create" : "Save"}</Button> : null}
        </div>
      </form>
    </Dialog>
  );
}
