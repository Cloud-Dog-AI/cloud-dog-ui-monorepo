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

// @cloud-dog/app-imap-mcp — Split admin API keys page (PS-71 IW4 — DataTable + bulk revoke).

import * as React from "react";
import { Link, useSearchParams } from "react-router-dom";
import {
  Badge,
  Button,
  DataTable,
  EntityDialog,
  StructuredView,
  type BulkAction,
  type DataColumn,
  type EntityDialogRelatedPanel,
  type EntityFieldDef,
} from "@cloud-dog/ui";
import type { GroupRow, ManagedApiKeyRow, UserRow } from "../lib/types";
import { useImapMcpState } from "../state/AppState";

type ApiKeyDraft = Readonly<{
  ownerUserId: string;
  scopes: string[];
  ttlDays: number;
  description: string;
}>;

const defaultDraft: ApiKeyDraft = {
  ownerUserId: "",
  scopes: ["profiles:read"],
  ttlDays: 7,
  description: "",
};

// Canonical scope catalogue used by imap-mcp api-key creation. Mirrors
// tool_rbac.py permission strings + the role policy defaults.
const KNOWN_SCOPES = [
  "*",
  "profiles:read",
  "profiles:write",
  "imap:mail:read",
  "imap:mail:write",
  "imap:mail:delete",
  "imap:folder:read",
  "imap:folder:write",
  "imap:attachment:read",
  "imap:attachment:write",
  "imap:admin:*",
  "read_jobs",
  "write_jobs",
];

function isRevoked(row: ManagedApiKeyRow): boolean {
  return (row as ManagedApiKeyRow & { revoked?: boolean }).revoked === true || row.status?.toLowerCase() === "revoked";
}

export function AdminApiKeysPage() {
  const { api } = useImapMcpState();
  const [searchParams] = useSearchParams();
  const [apiKeys, setApiKeys] = React.useState<ManagedApiKeyRow[]>([]);
  const [users, setUsers] = React.useState<UserRow[]>([]);
  const [groups, setGroups] = React.useState<GroupRow[]>([]);
  const [draft, setDraft] = React.useState<ApiKeyDraft>(defaultDraft);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [latestKey, setLatestKey] = React.useState<ManagedApiKeyRow | null>(null);
  const [viewKey, setViewKey] = React.useState<ManagedApiKeyRow | null>(null);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState("");
  const [page, setPage] = React.useState(1);

  const loadApiKeys = React.useCallback(async () => {
    const [keysResult, usersResult, groupsResult] = await Promise.all([
      api.listApiKeys(),
      api.listUsers(),
      api.listGroups(),
    ]);
    if (!keysResult.ok || !keysResult.data) {
      setError(keysResult.errorMessage || "Failed to load API keys.");
      return;
    }
    setApiKeys(keysResult.data);
    setUsers(usersResult.ok && usersResult.data ? usersResult.data : []);
    setGroups(groupsResult.ok && groupsResult.data ? groupsResult.data : []);
    setError("");
  }, [api]);

  React.useEffect(() => {
    void loadApiKeys();
  }, [loadApiKeys]);

  const profileIdFilter = searchParams.get("profileId")?.trim() ?? "";
  const normalisedFilter = profileIdFilter.toLowerCase();
  const filteredApiKeys = normalisedFilter
    ? apiKeys.filter((row) => {
        const haystack = [
          row.apiKeyId,
          row.ownerUserId,
          row.description,
          row.status,
          row.rawKey,
          ...row.scopes,
        ]
          .join(" ")
          .toLowerCase();
        return haystack.includes(normalisedFilter);
      })
    : apiKeys;

  const bulkActions = React.useMemo<BulkAction[]>(() => [{ label: "Revoke Selected", action: "revoke" }], []);

  const columns: DataColumn<ManagedApiKeyRow>[] = React.useMemo(
    () => [
      { id: "apiKeyId", header: "API Key ID", cell: (row) => row.apiKeyId, sortable: true, sortValue: (row) => row.apiKeyId },
      {
        id: "owner",
        header: "Owner",
        cell: (row) => {
          const owner = users.find((u) => u.userId === row.ownerUserId);
          if (!owner) return row.ownerUserId || "N/A";
          return (
            <Link
              to={`/admin/users?userId=${encodeURIComponent(row.ownerUserId)}`}
              className="text-primary underline-offset-4 hover:underline"
              title={owner.email || row.ownerUserId}
            >
              {owner.displayName || owner.username || row.ownerUserId}
            </Link>
          );
        },
        sortable: true,
        sortValue: (row) => row.ownerUserId,
      },
      {
        id: "ownerGroups",
        header: "Owner groups",
        cell: (row) => {
          const ownerGroups = groups.filter((g) => g.members.includes(row.ownerUserId));
          if (ownerGroups.length === 0) return <span className="text-xs text-muted-foreground">none</span>;
          return (
            <div className="flex flex-wrap gap-1">
              {ownerGroups.map((g) => (
                <Link
                  key={g.groupId}
                  to={`/admin/groups?groupId=${encodeURIComponent(g.groupId)}`}
                  className="text-xs text-primary underline-offset-4 hover:underline"
                >
                  {g.name}
                </Link>
              ))}
            </div>
          );
        },
      },
      { id: "scopes", header: "Scopes", cell: (row) => row.scopes.join(", ") || "N/A" },
      {
        id: "status",
        header: "Status",
        cell: (row) => (
          <Badge variant={isRevoked(row) ? "destructive" : "default"}>{isRevoked(row) ? "Revoked" : "Active"}</Badge>
        ),
        sortable: true,
        sortValue: (row) => (isRevoked(row) ? "z" : "a"),
      },
      {
        id: "__actions",
        header: "Actions",
        cell: (row) => (
          <div className="flex flex-wrap gap-1">
            <Button variant="ghost" size="sm" onClick={() => setViewKey(row)}>
              View
            </Button>
            <Button
              variant="ghost"
              size="sm"
              disabled={isRevoked(row)}
              onClick={() => {
                if (!window.confirm(`Revoke API key ${row.apiKeyId}?`)) return;
                void api.revokeApiKey(row.apiKeyId).then(async (result) => {
                  if (!result.ok) {
                    setError(result.errorMessage || `Failed to revoke ${row.apiKeyId}.`);
                    return;
                  }
                  setStatus(`Revoked API key ${row.apiKeyId}.`);
                  await loadApiKeys();
                });
              }}
            >
              Revoke
            </Button>
            <Link
              to={`/diagnostics-audit?api_key_id=${encodeURIComponent(row.apiKeyId)}`}
              className="inline-flex h-8 items-center justify-center rounded-md px-3 text-sm font-medium hover:bg-accent"
              title={`View audit for API key ${row.apiKeyId}`}
            >
              Audit
            </Link>
          </div>
        ),
      },
    ],
    [api, groups, loadApiKeys, users],
  );

  const onBulkAction = React.useCallback(
    (action: string, selectedIds: string[]) => {
      if (action !== "revoke") return;
      const selected = filteredApiKeys.filter((k) => selectedIds.includes(k.apiKeyId) && !isRevoked(k));
      if (!selected.length) return;
      if (!window.confirm(`Revoke ${selected.length} selected API key(s)?`)) return;
      void Promise.all(selected.map((k) => api.revokeApiKey(k.apiKeyId))).then(async (results) => {
        const failed = results.find((r) => !r.ok);
        if (failed) {
          setError(failed.errorMessage || "Bulk revoke failed.");
          return;
        }
        setStatus(`Revoked ${selected.length} API key(s).`);
        await loadApiKeys();
      });
    },
    [api, filteredApiKeys, loadApiKeys],
  );

  const createKey = async () => {
    const result = await api.createApiKey({
      owner_user_id: draft.ownerUserId.trim(),
      scopes: draft.scopes,
      description: draft.description.trim(),
      ttl_days: Number(draft.ttlDays) || null,
    });
    if (!result.ok || !result.data) {
      setError(result.errorMessage || "Failed to create API key.");
      return;
    }
    setLatestKey(result.data);
    setStatus(`Created API key ${result.data.apiKeyId}.`);
    setDialogOpen(false);
    await loadApiKeys();
  };

  return (
    <div className="space-y-4">
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}
      {profileIdFilter ? (
        <p className="text-sm text-muted-foreground">
          Showing API keys related to channel <span className="font-mono">{profileIdFilter}</span> by owner,
          scope, or description text.{" "}
          <Link to="/admin/api-keys" className="font-medium text-primary underline-offset-4 hover:underline">
            View all API keys
          </Link>
        </p>
      ) : null}

      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-xl font-semibold">API Keys</h1>
        <Button
          size="sm"
          onClick={() => {
            setDraft(
              profileIdFilter
                ? { ...defaultDraft, description: `Access for channel ${profileIdFilter}` }
                : defaultDraft
            );
            setDialogOpen(true);
          }}
        >
          Create Key
        </Button>
      </header>

      <div className="rounded-md border bg-background">
        <DataTable
          tableId="imap-mcp-admin-api-keys"
          columns={columns}
          rows={filteredApiKeys}
          emptyMessage="No API keys found."
          getRowId={(row) => row.apiKeyId}
          page={page}
          onPageChange={setPage}
          pageSize={25}
          selectable
          bulkActions={bulkActions}
          onBulkAction={onBulkAction}
          columnPickerEnabled
        />
      </div>

      {latestKey ? (
        <StructuredView title="Latest Created Key" value={latestKey} />
      ) : null}

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="Create API Key"
        fields={[
          { name: "ownerUserId", label: "Owner user", type: "select", required: true, options: users.map((u) => u.userId) },
          { name: "scopes", label: "Scopes", type: "multiselect", required: true, options: KNOWN_SCOPES },
          { name: "ttlDays", label: "TTL (days)", type: "number" },
          { name: "description", label: "Description", type: "text" },
        ] satisfies EntityFieldDef[]}
        values={draft as Record<string, unknown>}
        onChange={(name, value) => setDraft((current) => ({ ...current, [name]: value } as ApiKeyDraft))}
        onSubmit={() => void createKey()}
        onCancel={() => setDialogOpen(false)}
        mode="add"
      />

      <EntityDialog
        open={viewKey !== null}
        onOpenChange={(open) => { if (!open) setViewKey(null); }}
        title={viewKey ? `API Key: ${viewKey.apiKeyId}` : "API Key"}
        body={
          viewKey ? (
            <StructuredView
              title="Key details"
              value={{
                apiKeyId: viewKey.apiKeyId,
                ownerUserId: viewKey.ownerUserId,
                status: viewKey.status,
                scopes: viewKey.scopes,
                description: viewKey.description,
              }}
            />
          ) : null
        }
        relatedPanels={
          viewKey
            ? ((): EntityDialogRelatedPanel[] => {
                const owner = users.find((u) => u.userId === viewKey.ownerUserId);
                const ownerGroups = groups.filter((g) => g.members.includes(viewKey.ownerUserId));
                return [
                  {
                    title: "Owner user",
                    emptyMessage: "Owner user not found (orphan key).",
                    items: owner
                      ? [
                          {
                            id: owner.userId,
                            label: `${owner.displayName || owner.username} <${owner.email || "no email"}> — ${owner.roles.join(",") || "no roles"}`,
                            href: `/admin/users?userId=${encodeURIComponent(owner.userId)}`,
                          },
                        ]
                      : [],
                  },
                  {
                    title: "Groups for this owner",
                    emptyMessage: "Owner is not a member of any groups.",
                    items: ownerGroups.map((g) => ({
                      id: g.groupId,
                      label: `${g.name} [${g.roles.join(",") || "no roles"}]`,
                      href: `/admin/groups?groupId=${encodeURIComponent(g.groupId)}`,
                    })),
                  },
                ];
              })()
            : undefined
        }
      />
    </div>
  );
}
