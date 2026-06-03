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

// @cloud-dog/app-chat-client — External service status and selection page.

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { Button, Card, CardContent, CardHeader, Checkbox, DataTable, EntityDialog, Input, StatusCard } from "@cloud-dog/ui";
import type { BulkAction, DataColumn, EntityFieldDef } from "@cloud-dog/ui";
import { isAdminUser } from "../lib/rbac";
import type { McpServer, McpServerHealth } from "../lib/types";
import { useAppState } from "../state/AppState";

const serverFields: EntityFieldDef[] = [
  { name: "name", label: "Name", type: "text", required: true },
  { name: "transport", label: "Transport", type: "text", required: true },
  { name: "base_url", label: "Base URL", type: "text", required: true },
  { name: "mcp_path", label: "MCP path", type: "text", required: true },
  { name: "messages_path", label: "Messages path", type: "text", required: true },
  { name: "health_path", label: "Health path", type: "text", required: true },
];

const emptyForm = {
  name: "",
  transport: "http_jsonrpc",
  base_url: "",
  mcp_path: "/mcp",
  messages_path: "/messages",
  health_path: "/health",
};

function tone(ok: boolean | undefined): "ok" | "warning" | "error" {
  if (ok === true) return "ok";
  if (ok === false) return "error";
  return "warning";
}

export function McpHealthPage() {
  const auth = useAuth();
  const {
    api,
    activeSessionId,
    mcpServers,
    mcpHealth,
    refreshMcpServers,
    selectedServerIndices,
    setSelectedServerIndices,
  } = useAppState();
  const mayEdit = isAdminUser(auth.user);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<Record<string, unknown>>(emptyForm);
  const [editingIndex, setEditingIndex] = React.useState<number | null>(null);
  const [selectedServer, setSelectedServer] = React.useState<McpServer | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  React.useEffect(() => {
    void refreshMcpServers().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to load external service status");
    });
  }, [refreshMcpServers]);

  React.useEffect(() => {
    setPage(1);
  }, [query]);

  const healthMap = React.useMemo(() => new Map(mcpHealth.map((item) => [item.index, item])), [mcpHealth]);

  const toggleServer = async (index: number, checked: boolean) => {
    const next = checked
      ? Array.from(new Set([...selectedServerIndices, index])).sort((a, b) => a - b)
      : selectedServerIndices.filter((item) => item !== index);
    try {
      await setSelectedServerIndices(next);
      setStatus(`Updated active external services for session ${activeSessionId ?? ""}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update server selection");
    }
  };

  const openCreate = () => {
    setEditingIndex(null);
    setForm(emptyForm);
    setDialogOpen(true);
  };

  const refreshHealth = async () => {
    setError(null);
    setStatus(null);
    try {
      await refreshMcpServers();
      setStatus("External service reachability and latency refreshed.");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to refresh external service health");
    }
  };

  const openEdit = (server: McpServer) => {
    setEditingIndex(server.index);
    setForm({
      name: server.name,
      transport: server.transport,
      base_url: server.base_url,
      mcp_path: server.mcp_path,
      messages_path: server.messages_path,
      health_path: server.health_path,
    });
    setDialogOpen(true);
  };

  const saveServer = async () => {
    setError(null);
    setStatus(null);
    try {
      if (editingIndex == null) {
        await api.createMcpServer(form);
        setStatus("Added external service");
      } else {
        await api.updateMcpServer(editingIndex, form);
        setStatus(`Updated external service ${editingIndex}`);
      }
      setDialogOpen(false);
      setForm(emptyForm);
      await refreshMcpServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save external service");
    }
  };

  const removeServer = async (index: number) => {
    if (!window.confirm(`Delete external service ${index}?`)) return;
    setError(null);
    setStatus(null);
    try {
      await api.deleteMcpServer(index);
      setStatus(`Deleted external service ${index}`);
      await refreshMcpServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete external service");
    }
  };

  const bulkDelete = async (rows: McpServer[]) => {
    if (!rows.length) return;
    if (!window.confirm(`Delete ${rows.length} selected external services?`)) return;
    setError(null);
    setStatus(null);
    try {
      await Promise.all(rows.map((row) => api.deleteMcpServer(row.index)));
      setStatus(`Deleted ${rows.length} external services`);
      await refreshMcpServers();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete selected external services");
    }
  };

  const selectedHealth: McpServerHealth | undefined = selectedServer ? healthMap.get(selectedServer.index) : undefined;
  const filteredServers = React.useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return mcpServers;
    return mcpServers.filter((row) =>
      `${row.name} ${row.transport} ${row.base_url} ${row.version ?? ""}`.toLowerCase().includes(trimmed),
    );
  }, [mcpServers, query]);
  const columns = React.useMemo<DataColumn<McpServer>[]>(() => [
    {
      id: "active",
      header: "Active",
      cell: (row) => (
        <Checkbox
          aria-label={`Activate ${row.name}`}
          checked={selectedServerIndices.includes(row.index)}
          disabled={!activeSessionId || !mayEdit}
          onChange={(event) => void toggleServer(row.index, event.target.checked)}
        />
      ),
    },
    {
      id: "name",
      header: "Name",
      sortable: true,
      sortValue: (row) => row.name.toLowerCase(),
      cell: (row) => <span className="font-medium">{row.name}</span>,
    },
    {
      id: "transport",
      header: "Transport",
      sortable: true,
      sortValue: (row) => row.transport,
      cell: (row) => row.transport,
    },
    {
      id: "base_url",
      header: "Base URL",
      cell: (row) => <span className="font-mono text-xs">{row.base_url}</span>,
    },
    {
      id: "health",
      header: "Health",
      sortable: true,
      sortValue: (row) => (healthMap.get(row.index)?.ok ? "ok" : "error"),
      cell: (row) => {
        const health = healthMap.get(row.index);
        return health?.ok ? "GREEN" : health?.ok === false ? "RED" : "UNKNOWN";
      },
    },
    {
      id: "latency",
      header: "Latency",
      sortable: true,
      sortValue: (row) => Number(healthMap.get(row.index)?.latency_ms ?? 0),
      cell: (row) => `${Math.round(Number(healthMap.get(row.index)?.latency_ms ?? 0))}ms`,
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex gap-2">
          <Button variant="ghost" onClick={() => setSelectedServer(row)}>Details</Button>
          <Button variant="secondary" disabled={!mayEdit} onClick={() => openEdit(row)}>Edit</Button>
          <Button variant="ghost" disabled={!mayEdit} onClick={() => void removeServer(row.index)}>Delete</Button>
        </div>
      ),
    },
  ], [activeSessionId, healthMap, mayEdit, openEdit, removeServer, selectedServerIndices, toggleServer]);
  const bulkActions = React.useMemo<BulkAction[]>(() => (mayEdit ? [{ label: "Delete Selected", action: "delete" }] : []), [mayEdit]);
  const onBulkAction = React.useCallback((action: string, selectedIds: string[]) => {
    if (action !== "delete") return;
    const selectedRows = filteredServers.filter((row) => selectedIds.includes(String(row.index)));
    void bulkDelete(selectedRows);
  }, [bulkDelete, filteredServers]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h1 className="text-xl font-semibold">External Services</h1>
          <p className="text-sm text-muted-foreground">Manage external service configuration, health, and active-session selection.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <Input
              aria-label="Search external services"
              className="max-w-md"
              placeholder="Search external services"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void refreshHealth()}>Refresh health</Button>
              <Button disabled={!mayEdit} onClick={openCreate}>Add service</Button>
            </div>
          </div>
          <DataTable
            tableId="chat-mcp-servers"
            columns={columns}
            rows={filteredServers}
            totalRows={mcpServers.length}
            emptyMessage="No external services configured in backend runtime config."
            getRowId={(row) => String(row.index)}
            page={page}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            selectable={mayEdit}
            bulkActions={bulkActions}
            onBulkAction={onBulkAction}
            columnPickerEnabled={true}
          />
          {!activeSessionId ? <p className="text-sm text-muted-foreground">No active session. Create or open a session first.</p> : null}
          {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Selected service health</h2>
          <p className="text-sm text-muted-foreground">Detailed health for the currently selected external service.</p>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[0.8fr_1.2fr]">
          {selectedServer ? (
            <StatusCard
              title={selectedServer.name}
              value={selectedHealth?.ok ? "GREEN" : selectedHealth?.ok === false ? "RED" : "UNKNOWN"}
              tone={tone(selectedHealth?.ok)}
              trend={typeof selectedHealth?.latency_ms === "number" ? `${selectedHealth.latency_ms}ms` : "No latency"}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Select an external service to inspect its health payload.</p>
          )}
          <div className="space-y-2 text-sm text-muted-foreground">
            {selectedServer ? (
              <>
                <p>Version: {selectedServer.version || "unknown"}</p>
                <p>MCP path: {selectedServer.mcp_path}</p>
                <p>Messages path: {selectedServer.messages_path}</p>
                <p>Health path: {selectedServer.health_path}</p>
                {selectedHealth?.warning ? <p className="text-amber-700">Warning: {selectedHealth.warning}</p> : null}
                {selectedHealth?.error ? <p className="text-destructive">Error: {selectedHealth.error}</p> : null}
              </>
            ) : null}
          </div>
        </CardContent>
      </Card>

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={editingIndex == null ? "Add external service" : `Edit external service ${editingIndex}`}
        fields={serverFields}
        values={form}
        mode={mayEdit ? (editingIndex == null ? "add" : "edit") : "view"}
        onChange={(name, value) => setForm((current) => ({ ...current, [name]: value }))}
        onSubmit={() => void saveServer()}
        onCancel={() => setDialogOpen(false)}
      />
    </div>
  );
}
