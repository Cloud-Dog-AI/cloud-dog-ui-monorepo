import * as React from "react";
import { Badge, Button, Card, CardContent, CardHeader, DataTable, EntityDialog, Input, JsonBlock, RelativeTime, type BulkAction, type DataColumn, type EntityFieldDef } from "@cloud-dog/ui";
import { useGitMcpState } from "../state/AppState";
import type { ManagedApiKeyRecord } from "../lib/types";

type ApiKeyFormState = Readonly<{
  name: string;
  ownerUserId: string;
  capabilities: string[];
  ttlDays: number;
}>;

const CAPABILITY_OPTIONS = [
  "read",
  "write",
  "admin",
  "tools:read",
  "tools:write",
  "admin.profile",
  "repo_open",
  "file_read",
  "file_write",
  "*",
];

function makeApiKeyFields(users: Array<{ userId: string }>): EntityFieldDef[] {
  const userOptions = users.map((u) => u.userId);
  return [
    { name: "name", label: "Name", type: "text", required: true },
    { name: "ownerUserId", label: "Owner", type: "select", required: true, options: userOptions },
    { name: "capabilities", label: "Capabilities", type: "multiselect", options: CAPABILITY_OPTIONS },
    { name: "ttlDays", label: "TTL days", type: "number" },
  ];
}

export function ApiKeysPage() {
  const app = useGitMcpState();
  const [keys, setKeys] = React.useState<ManagedApiKeyRecord[]>([]);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [editingKeyId, setEditingKeyId] = React.useState("");
  const [form, setForm] = React.useState<ApiKeyFormState>({ name: "", ownerUserId: "", capabilities: [], ttlDays: 7 });
  const [allUsers, setAllUsers] = React.useState<Array<{ userId: string }>>([]);

  React.useEffect(() => {
    app.loadUsers().then((items) => setAllUsers(items)).catch(() => {});
  }, [app]);
  const [errors, setErrors] = React.useState<Record<string, string>>({});
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [lastRawKey, setLastRawKey] = React.useState("");
  const [inspectedKeyId, setInspectedKeyId] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const refresh = React.useCallback(async () => {
    setError(null);
    try {
      const items = await app.loadApiKeys();
      setKeys(items);
      setStatus(`Loaded ${items.length} API keys.`);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Failed to load API keys.");
    }
  }, [app]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  React.useEffect(() => {
    setPage(1);
  }, [query]);

  React.useEffect(() => {
    if (!keys.length) {
      setInspectedKeyId("");
      return;
    }
    setInspectedKeyId((current) => (keys.some((row) => row.keyId === current) ? current : keys[0].keyId));
  }, [keys]);

  const resetFormFields = React.useCallback(() => {
    setEditingKeyId("");
    setForm({ name: "", ownerUserId: "", capabilities: [], ttlDays: 7 });
    setErrors({});
  }, []);

  const openAdd = () => {
    resetFormFields();
    setLastRawKey("");
    setDialogOpen(true);
  };

  const openEdit = (key: ManagedApiKeyRecord) => {
    setEditingKeyId(key.keyId);
    setForm({
      name: key.name || key.keyId,
      ownerUserId: key.ownerUserId,
      capabilities: [...key.capabilities],
      ttlDays: 7,
    });
    setErrors({});
    setLastRawKey("");
    setDialogOpen(true);
  };

  const saveKey = async () => {
    const nextErrors: Record<string, string> = {};
    if (!form.name.trim()) nextErrors.name = "Name is required.";
    if (!form.ownerUserId.trim()) nextErrors.ownerUserId = "Owner user ID is required.";
    if (Object.keys(nextErrors).length) {
      setErrors(nextErrors);
      return;
    }

    setErrors({});
    setError(null);
    const payload: Record<string, unknown> = {
      name: form.name.trim(),
      capabilities: form.capabilities,
    };
    if (!editingKeyId) {
      payload.owner_user_id = form.ownerUserId.trim();
      payload.ttl_days = form.ttlDays;
    }
    const outcome = editingKeyId ? await app.updateApiKey(editingKeyId, payload) : await app.createApiKey(payload);
    if (!outcome.ok) {
      setError(outcome.errorMessage || "API key save failed.");
      return;
    }
    if (editingKeyId) {
      setStatus(`Updated API key ${editingKeyId}.`);
      setLastRawKey("");
    } else {
      const data = (outcome.data ?? {}) as { raw_key?: string; result?: { raw_key?: string } };
      setLastRawKey(String(data.raw_key ?? data.result?.raw_key ?? ""));
      setStatus(`Created API key for ${form.ownerUserId.trim()}.`);
    }
    setDialogOpen(false);
    resetFormFields();
    await refresh();
  };

  const revokeKey = async (keyId: string) => {
    const outcome = await app.revokeApiKey(keyId);
    if (!outcome.ok) {
      setError(outcome.errorMessage || `Failed to revoke ${keyId}.`);
      return;
    }
    setStatus(`Revoked API key ${keyId}.`);
    await refresh();
  };

  const columns: DataColumn<ManagedApiKeyRecord>[] = [
    { id: "name", header: "Name", cell: (row) => row.name || row.keyId, sortable: true, sortValue: (row) => row.name || row.keyId },
    { id: "owner", header: "Owner", cell: (row) => row.ownerUserId || "-", sortable: true, sortValue: (row) => row.ownerUserId || "" },
    { id: "prefix", header: "Key prefix", cell: (row) => row.keyPrefix || "-", sortable: true, sortValue: (row) => row.keyPrefix || "" },
    {
      id: "createdAt",
      header: "Created",
      cell: (row) => row.createdAt ? <RelativeTime timestamp={row.createdAt} /> : <span className="text-sm text-muted-foreground">N/A</span>,
      sortable: true,
      sortValue: (row) => row.createdAt || "",
    },
    {
      id: "scopes",
      header: "Scopes",
      cell: (row) => row.capabilities.length ? <div className="flex flex-wrap gap-1">{row.capabilities.map((item) => <Badge key={`${row.keyId}-${item}`}>{item}</Badge>)}</div> : <span className="text-sm text-muted-foreground">all</span>,
    },
    { id: "status", header: "Status", cell: (row) => <Badge variant={row.status === "revoked" ? "destructive" : "default"} className={row.status === "revoked" ? "" : "bg-emerald-600 text-white border-emerald-700"}>{row.status || "active"}</Badge>, sortable: true, sortValue: (row) => row.status || "" },
    {
      id: "expires",
      header: "Expires",
      cell: (row) => (row as Record<string, unknown>).expiresAt ? <RelativeTime timestamp={String((row as Record<string, unknown>).expiresAt)} /> : <span className="text-sm text-muted-foreground">never</span>,
      sortable: true,
      sortValue: (row) => String((row as Record<string, unknown>).expiresAt ?? ""),
    },
    {
      id: "lastUsed",
      header: "Last Used",
      cell: (row) => (row as Record<string, unknown>).lastUsedAt ? <RelativeTime timestamp={String((row as Record<string, unknown>).lastUsedAt)} /> : <span className="text-sm text-muted-foreground">never</span>,
      sortable: true,
      sortValue: (row) => String((row as Record<string, unknown>).lastUsedAt ?? ""),
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          <Button size="sm" variant="secondary" onClick={() => openEdit(row)}>Edit</Button>
          <Button size="sm" variant="secondary" onClick={() => setInspectedKeyId(row.keyId)}>Inspect</Button>
          <Button size="sm" variant="destructive" onClick={() => void revokeKey(row.keyId)} disabled={row.status === "revoked"}>
            Revoke
          </Button>
        </div>
      ),
    },
  ];

  const filteredKeys = React.useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return keys;
    return keys.filter((row) =>
      `${row.name || row.keyId} ${row.ownerUserId} ${row.keyPrefix || ""} ${row.capabilities.join(" ")} ${row.status || ""}`
        .toLowerCase()
        .includes(trimmed),
    );
  }, [keys, query]);

  const bulkActions = React.useMemo<BulkAction[]>(() => [{ label: "Revoke selected", action: "revoke" }], []);

  const onBulkAction = React.useCallback((_action: string, selectedIds: string[]) => {
    const rows = filteredKeys.filter((row) => selectedIds.includes(row.keyId));
    void (async () => {
      for (const row of rows) {
        await revokeKey(row.keyId);
      }
    })();
  }, [filteredKeys]);

  const inspectedKey = React.useMemo(
    () => keys.find((row) => row.keyId === inspectedKeyId) ?? null,
    [inspectedKeyId, keys],
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-semibold">API Keys</h1>
        <Button onClick={openAdd}>Add API Key</Button>
      </header>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Managed API keys</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <Input className="max-w-md" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search API keys..." aria-label="Search API keys" />
            <Button variant="secondary" onClick={() => void refresh()}>Refresh</Button>
          </div>
          <DataTable
            tableId="git-mcp.api-keys.columns"
            columns={columns}
            rows={filteredKeys}
            totalRows={keys.length}
            getRowId={(row) => row.keyId}
            emptyMessage="No API keys available."
            page={page}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            selectable={true}
            bulkActions={bulkActions}
            onBulkAction={onBulkAction}
            columnPickerEnabled={true}
          />
        </CardContent>
      </Card>

      {inspectedKey ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Raw key inspection</h2>
          </CardHeader>
          <CardContent>
            <JsonBlock title={`API Key ${inspectedKey.keyId}`} value={inspectedKey} defaultCollapsed={false} />
          </CardContent>
        </Card>
      ) : null}

      {lastRawKey ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Generated raw key</h2>
          </CardHeader>
          <CardContent>
            <Input id="generated-api-key" value={lastRawKey} readOnly />
          </CardContent>
        </Card>
      ) : null}

      <EntityDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) resetFormFields();
        }}
        title={editingKeyId ? `Edit API Key ${editingKeyId}` : "Add API Key"}
        fields={makeApiKeyFields(allUsers).map((field) => ({ ...field, readOnly: field.name === "ownerUserId" && Boolean(editingKeyId) }))}
        values={form}
        errors={errors}
        mode={editingKeyId ? "edit" : "add"}
        onChange={(name, value) => setForm((current) => ({ ...current, [name]: name === "ttlDays" ? Number(value) : name === "capabilities" ? (Array.isArray(value) ? value : String(value).split(",").map((s: string) => s.trim()).filter(Boolean)) : String(value) }))}
        onSubmit={() => void saveKey()}
        onCancel={() => {
          setDialogOpen(false);
          resetFormFields();
        }}
      />
    </div>
  );
}
