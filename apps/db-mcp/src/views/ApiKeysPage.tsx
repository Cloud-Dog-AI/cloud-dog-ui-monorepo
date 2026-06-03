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
import { Button, DataTable, EntityDialog, RelativeTime, statusColumn, type BulkAction, type DataColumn, type EntityFieldDef } from "@cloud-dog/ui";
import { useDbMcpState } from "../state/AppState";
import type { ApiKeySummary, UserSummary } from "../lib/types";

type DialogMode = "add" | "view";

type ApiKeyFormState = Readonly<{
  owner_user_id: string;
  name: string;
  scopes: string[];
  profileIds: string[];
  ttl_days: string;
}>;

const PLATFORM_SCOPES = ["*", "read", "write", "admin", "profile:*"];

function buildApiKeyFields(users: UserSummary[], profileIds: string[]): EntityFieldDef[] {
  return [
    { name: "owner_user_id", label: "Owner", type: "select", required: true, options: users.map((u) => u.user_id) },
    { name: "name", label: "Name", type: "text", required: true },
    { name: "scopes", label: "Scopes", type: "multiselect", options: PLATFORM_SCOPES },
    { name: "profileIds", label: "Profile IDs", type: "multiselect", options: profileIds },
    { name: "ttl_days", label: "TTL days (blank = unlimited)", type: "select", options: ["", "7", "30", "90", "180", "365"] },
  ];
}

const EMPTY_FORM: ApiKeyFormState = {
  owner_user_id: "",
  name: "",
  scopes: ["*"],
  profileIds: [],
  ttl_days: "",
};

function toFormState(item: ApiKeySummary | null): ApiKeyFormState {
  if (!item) return EMPTY_FORM;
  return {
    owner_user_id: item.owner_user_id,
    name: item.name,
    scopes: item.scopes ?? ["*"],
    profileIds: item.profile_ids ?? [],
    ttl_days: "",
  };
}

export function ApiKeysPage() {
  const { api, profiles } = useDbMcpState();
  const [users, setUsers] = React.useState<UserSummary[]>([]);
  const [keys, setKeys] = React.useState<ApiKeySummary[]>([]);
  const [selectedKey, setSelectedKey] = React.useState<ApiKeySummary | null>(null);
  const [dialogMode, setDialogMode] = React.useState<DialogMode>("add");
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<ApiKeyFormState>(EMPTY_FORM);
  const [page, setPage] = React.useState(1);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setError(null);
    try {
      const [userItems, keyItems] = await Promise.all([api.listUsers(), api.listApiKeys()]);
      setUsers(userItems);
      setKeys(keyItems);
      setForm((current) => current.owner_user_id ? current : { ...current, owner_user_id: userItems[0]?.user_id ?? "" });
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load API keys.");
    }
  }, [api]);

  React.useEffect(() => {
    void load();
  }, [load]);

  const openDialog = (mode: DialogMode, item: ApiKeySummary | null = null) => {
    setSelectedKey(item);
    setDialogMode(mode);
    setForm(mode === "add" ? { ...EMPTY_FORM, owner_user_id: users[0]?.user_id ?? "" } : toFormState(item));
    setDialogOpen(true);
  };

  const closeDialog = () => {
    setDialogOpen(false);
    setSelectedKey(null);
    setForm(EMPTY_FORM);
  };

  const submit = async () => {
    try {
      const created = await api.createApiKey({
        owner_user_id: form.owner_user_id.trim(),
        name: form.name.trim(),
        scopes: form.scopes.length > 0 ? form.scopes : ["*"],
        profile_ids: form.profileIds,
        ttl_days: form.ttl_days.trim() ? Number(form.ttl_days) : null,
      });
      setStatus(`Created API key ${created.name}.`);
      closeDialog();
      await load();
    } catch (submitError) {
      setError(submitError instanceof Error ? submitError.message : "Failed to create API key.");
    }
  };

  const revoke = async (item: ApiKeySummary) => {
    try {
      await api.revokeApiKey(item.api_key_id);
      setStatus(`Revoked API key ${item.name}.`);
      await load();
    } catch (revokeError) {
      setError(revokeError instanceof Error ? revokeError.message : "Failed to revoke API key.");
    }
  };

  const bulkActions: BulkAction[] = [{ label: "Revoke Selected", action: "revoke" }];

  const ownerMap = new Map(users.map((item) => [item.user_id, item.username]));

  const columns: DataColumn<ApiKeySummary>[] = [
    { id: "name", header: "Name", cell: (item) => item.name, sortable: true, sortValue: (item) => item.name },
    { id: "owner", header: "Owner", cell: (item) => ownerMap.get(item.owner_user_id) ?? item.owner_user_id, sortable: true, sortValue: (item) => ownerMap.get(item.owner_user_id) ?? item.owner_user_id },
    { id: "prefix", header: "Prefix", cell: (item) => item.key_prefix, sortable: true, sortValue: (item) => item.key_prefix },
    statusColumn<ApiKeySummary>({ getValue: (item) => item.status }),
    { id: "scopes", header: "Scopes", cell: (item) => item.scopes.join(", ") || "-", sortable: true, sortValue: (item) => item.scopes.join(", ") },
    { id: "expires", header: "Expires", cell: (item) => item.expires_at ? <RelativeTime timestamp={item.expires_at} /> : "Never", sortable: true, sortValue: (item) => item.expires_at ?? "" },
    {
      id: "actions",
      header: "Actions",
      cell: (item) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => openDialog("view", item)}>View</Button>
          <Button size="sm" variant="destructive" onClick={() => void revoke(item)}>Revoke</Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">API Keys</h1>
        <Button onClick={() => openDialog("add")}>Add API Key</Button>
        <Button variant="secondary" size="sm" onClick={() => void load()}>Refresh</Button>
      </header>
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}
      <DataTable
        columns={columns}
        rows={keys}
        emptyMessage="No API keys configured."
        page={page}
        pageSize={10}
        onPageChange={setPage}
        selectable
        bulkActions={bulkActions}
        onBulkAction={(action, selectedIds) => {
          if (action !== "revoke") return;
          void Promise.all(keys.filter((item) => selectedIds.includes(item.api_key_id)).map((item) => api.revokeApiKey(item.api_key_id))).then(load);
        }}
        columnPickerEnabled
        tableId="db-mcp-api-keys"
        getRowId={(item) => item.api_key_id}
      />
      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={dialogMode === "add" ? "Add API key" : "View API key"}
        fields={buildApiKeyFields(users, profiles.map((p) => p.profile_id))}
        values={dialogMode === "add" ? (form as Record<string, unknown>) : ({
          ...form,
          owner_user_id: ownerMap.get(form.owner_user_id) ?? form.owner_user_id,
        } as Record<string, unknown>)}
        onChange={(name, value) => setForm((current) => ({ ...current, [name]: String(value ?? "") }))}
        onSubmit={() => {
          if (dialogMode === "add") {
            void submit();
            return;
          }
          closeDialog();
        }}
        onCancel={closeDialog}
        mode={dialogMode}
      />
    </div>
  );
}
