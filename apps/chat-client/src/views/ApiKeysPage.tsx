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

// @cloud-dog/app-chat-client — API key CRUD page.

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { Badge, Button, Card, CardContent, CardHeader, DataTable, EntityDialog, Input, RelatedItemsPanel, RelativeTime } from "@cloud-dog/ui";
import type { BulkAction, DataColumn, EntityFieldDef } from "@cloud-dog/ui";
import { isAdminUser } from "../lib/rbac";
import type { ChatApiKeyRecord, ChatUserRecord } from "../lib/types";
import { useAppState } from "../state/AppState";

const apiKeyFields: EntityFieldDef[] = [
  { name: "name", label: "Name", type: "text", required: true },
  { name: "user_id", label: "User ID", type: "text", required: false },
  { name: "scopes", label: "Scopes (comma-separated)", type: "text", required: false },
];

const emptyForm = {
  name: "",
  user_id: "",
  scopes: "read",
};

export function ApiKeysPage() {
  const auth = useAuth();
  const { api } = useAppState();
  const mayEdit = isAdminUser(auth.user);
  const [keys, setKeys] = React.useState<ChatApiKeyRecord[]>([]);
  const [users, setUsers] = React.useState<ChatUserRecord[]>([]);
  const [selectedKey, setSelectedKey] = React.useState<ChatApiKeyRecord | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<Record<string, unknown>>(emptyForm);
  const [revealedKey, setRevealedKey] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const refresh = React.useCallback(async () => {
    setError(null);
    const [listedKeys, listedUsers] = await Promise.all([api.listApiKeys(), api.listUsers()]);
    setKeys(listedKeys);
    setUsers(listedUsers);
  }, [api]);

  React.useEffect(() => {
    void refresh().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to load API keys");
    });
  }, [refresh]);

  React.useEffect(() => {
    setPage(1);
  }, [query]);

  const openCreate = () => {
    setForm(emptyForm);
    setRevealedKey("");
    setDialogOpen(true);
  };

  const createKey = async () => {
    setError(null);
    setStatus(null);
    setRevealedKey("");
    try {
      const created = await api.createApiKey({
        name: String(form.name ?? "").trim(),
        user_id: String(form.user_id ?? "").trim() || null,
        scopes: String(form.scopes ?? "")
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
      });
      setRevealedKey(created.api_key ?? "");
      setStatus(`Created API key ${created.key_id}`);
      setDialogOpen(false);
      setForm(emptyForm);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create API key");
    }
  };

  const revoke = async (keyId: string) => {
    if (!window.confirm(`Revoke API key ${keyId}?`)) return;
    setError(null);
    setStatus(null);
    try {
      await api.revokeApiKey(keyId);
      setStatus(`Revoked API key ${keyId}`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke API key");
    }
  };

  const bulkRevoke = async (rows: ChatApiKeyRecord[]) => {
    if (!rows.length) return;
    if (!window.confirm(`Revoke ${rows.length} selected API keys?`)) return;
    setError(null);
    setStatus(null);
    try {
      await Promise.all(rows.map((row) => api.revokeApiKey(row.key_id)));
      setStatus(`Revoked ${rows.length} API keys`);
      await refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to revoke selected API keys");
    }
  };

  const relatedUser = selectedKey
    ? users
        .filter((user) => user.user_id === selectedKey.user_id)
        .map((user) => ({ id: user.user_id, label: `${user.display_name || user.user_id} (${user.role})` }))
    : [];

  const filteredKeys = React.useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return keys;
    return keys.filter((row) =>
      `${row.key_id} ${row.name} ${row.user_id ?? ""} ${row.key_prefix} ${row.scopes.join(" ")}`
        .toLowerCase()
        .includes(trimmed),
    );
  }, [keys, query]);

  const columns = React.useMemo<DataColumn<ChatApiKeyRecord>[]>(() => [
    {
      id: "name",
      header: "Name",
      sortable: true,
      sortValue: (row) => row.name.toLowerCase(),
      cell: (row) => (
        <Button
          type="button"
          className="text-left font-medium underline-offset-4 hover:underline"
          onClick={() => setSelectedKey(row)}
        >
          {row.name}
        </Button>
      ),
    },
    {
      id: "prefix",
      header: "Prefix",
      sortable: true,
      sortValue: (row) => row.key_prefix,
      cell: (row) => <span className="font-mono text-xs">{row.key_prefix}</span>,
    },
    {
      id: "user",
      header: "User",
      sortable: true,
      sortValue: (row) => row.user_id ?? "",
      cell: (row) => row.user_id || "unbound",
    },
    {
      id: "scopes",
      header: "Scopes",
      sortable: true,
      sortValue: (row) => row.scopes.join(","),
      cell: (row) => row.scopes.join(", ") || "none",
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      sortValue: (row) => (row.is_revoked ? "revoked" : "active"),
      cell: (row) => <Badge variant={row.is_revoked ? "destructive" : "default"}>{row.is_revoked ? "Revoked" : "Active"}</Badge>,
    },
    {
      id: "created_at",
      header: "Created",
      sortable: true,
      sortValue: (row) => row.created_at,
      cell: (row) => <RelativeTime timestamp={row.created_at} />,
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <Button variant="ghost" disabled={!mayEdit || row.is_revoked} onClick={() => void revoke(row.key_id)}>
          Revoke
        </Button>
      ),
    },
  ], [mayEdit, revoke]);

  const bulkActions = React.useMemo<BulkAction[]>(() => (mayEdit ? [{ label: "Revoke Selected", action: "revoke" }] : []), [mayEdit]);

  const onBulkAction = React.useCallback((action: string, selectedIds: string[]) => {
    if (action !== "revoke") return;
    const selectedRows = filteredKeys.filter((row) => selectedIds.includes(row.key_id));
    void bulkRevoke(selectedRows);
  }, [bulkRevoke, filteredKeys]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h1 className="text-xl font-semibold">API Keys</h1>
          <p className="text-sm text-muted-foreground">Issue and revoke API keys with shared table and dialog patterns.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <Input
              aria-label="Search API keys"
              className="max-w-md"
              placeholder="Search API keys"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void refresh()}>Refresh</Button>
              <Button disabled={!mayEdit} onClick={openCreate}>Create API key</Button>
            </div>
          </div>
          <DataTable
            tableId="chat-api-keys"
            columns={columns}
            rows={filteredKeys}
            totalRows={keys.length}
            emptyMessage="No API keys issued."
            getRowId={(row) => row.key_id}
            page={page}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            selectable={mayEdit}
            bulkActions={bulkActions}
            onBulkAction={onBulkAction}
            columnPickerEnabled={true}
          />
          {revealedKey ? (
            <div className="rounded-md border bg-muted/40 p-3">
              <p className="text-xs text-muted-foreground">New API key</p>
              <p className="font-mono text-sm break-all">{revealedKey}</p>
            </div>
          ) : null}
          {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Key ownership</h2>
          <p className="text-sm text-muted-foreground">Selected key's bound user account.</p>
        </CardHeader>
        <CardContent>
          <RelatedItemsPanel
            title="Bound user"
            items={relatedUser}
            emptyMessage="Select an API key to inspect ownership."
          />
        </CardContent>
      </Card>

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Create API key"
        fields={apiKeyFields}
        values={form}
        mode={mayEdit ? "add" : "view"}
        onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))}
        onSubmit={() => void createKey()}
        onCancel={() => setDialogOpen(false)}
      />
    </div>
  );
}
