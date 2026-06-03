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

// @cloud-dog/app-chat-client — Session management page.

import * as React from "react";
import { Button, Card, CardContent, CardHeader, DataTable, EntityDialog, EntityForm, Input, RelatedItemsPanel, RelativeTime } from "@cloud-dog/ui";
import type { BulkAction, DataColumn, EntityFieldDef } from "@cloud-dog/ui";
import type { SessionSummary, TranscriptEvent } from "../lib/types";
import { useAppState } from "../state/AppState";

const createFields: EntityFieldDef[] = [
  { name: "title", label: "Session title", type: "text", required: false },
];

const detailFields: EntityFieldDef[] = [
  { name: "id", label: "Session ID", type: "text", readOnly: true },
  { name: "title", label: "Title", type: "text", readOnly: true },
  { name: "created_at", label: "Created", type: "text", readOnly: true },
  { name: "status", label: "Status", type: "text", readOnly: true },
];

function sessionTitle(session: SessionSummary): string {
  return String(session.metadata?.title ?? "Untitled session").trim() || "Untitled session";
}

function transcriptItems(events: TranscriptEvent[]): Array<{ id: string; label: string }> {
  return events.slice(-10).map((event, index) => ({
    id: `${event.timestamp}-${event.sequence ?? index}`,
    label: `${event.event_type}`,
  }));
}

export function SessionsPage() {
  const {
    api,
    sessions,
    activeSessionId,
    setActiveSessionId,
    createSession,
    deleteSession,
    refreshSessions,
  } = useAppState();

  const [createOpen, setCreateOpen] = React.useState(false);
  const [createForm, setCreateForm] = React.useState<Record<string, unknown>>({ title: "" });
  const [selectedSession, setSelectedSession] = React.useState<SessionSummary | null>(null);
  const [detailEvents, setDetailEvents] = React.useState<TranscriptEvent[]>([]);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);
  const [query, setQuery] = React.useState("");
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  React.useEffect(() => {
    void refreshSessions().catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to load sessions");
    });
  }, [refreshSessions]);

  React.useEffect(() => {
    setPage(1);
  }, [query]);

  const loadDetail = React.useCallback(async (session: SessionSummary) => {
    setSelectedSession(session);
    setError(null);
    try {
      const events = await api.getTranscript(session.id);
      setDetailEvents(events);
    } catch (err) {
      setDetailEvents([]);
      setError(err instanceof Error ? err.message : "Failed to load session history");
    }
  }, [api]);

  const onCreate = async () => {
    setError(null);
    setStatus(null);
    try {
      await createSession(String(createForm.title ?? "").trim() || undefined);
      setCreateForm({ title: "" });
      setCreateOpen(false);
      setStatus("Session created");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create session");
    }
  };

  const onDelete = async (sessionId: string) => {
    if (!window.confirm(`Delete session ${sessionId}?`)) return;
    setError(null);
    setStatus(null);
    try {
      await deleteSession(sessionId);
      await refreshSessions();
      if (selectedSession?.id === sessionId) {
        setSelectedSession(null);
        setDetailEvents([]);
      }
      setStatus(`Deleted session ${sessionId}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete session");
    }
  };

  const bulkDelete = async (rows: SessionSummary[]) => {
    if (!rows.length) return;
    if (!window.confirm(`Delete ${rows.length} selected sessions?`)) return;
    setError(null);
    setStatus(null);
    try {
      await Promise.all(rows.map((row) => deleteSession(row.id)));
      await refreshSessions();
      setStatus(`Deleted ${rows.length} sessions`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete selected sessions");
    }
  };

  const detailValues = selectedSession
    ? {
        id: selectedSession.id,
        title: sessionTitle(selectedSession),
        created_at: selectedSession.created_at,
        status: selectedSession.id === activeSessionId ? "Active" : "Idle",
      }
    : { id: "", title: "", created_at: "", status: "" };

  const filteredSessions = React.useMemo(() => {
    const trimmed = query.trim().toLowerCase();
    if (!trimmed) return sessions;
    return sessions.filter((row) => `${sessionTitle(row)} ${row.id} ${row.created_at}`.toLowerCase().includes(trimmed));
  }, [query, sessions]);

  const columns = React.useMemo<DataColumn<SessionSummary>[]>(() => [
    {
      id: "title",
      header: "Title",
      sortable: true,
      sortValue: (row) => sessionTitle(row).toLowerCase(),
      cell: (row) => (
        <Button
          type="button"
          className="text-left font-medium underline-offset-4 hover:underline"
          onClick={() => void loadDetail(row)}
        >
          {sessionTitle(row)}
        </Button>
      ),
    },
    {
      id: "created",
      header: "Created",
      sortable: true,
      sortValue: (row) => row.created_at,
      cell: (row) => <RelativeTime timestamp={row.created_at} />,
    },
    {
      id: "status",
      header: "Status",
      sortable: true,
      sortValue: (row) => (row.id === activeSessionId ? "active" : "idle"),
      cell: (row) => (row.id === activeSessionId ? "Active" : "Idle"),
    },
    {
      id: "session-id",
      header: "Session ID",
      cell: (row) => <span className="font-mono text-xs">{row.id}</span>,
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => setActiveSessionId(row.id)}>
            Open
          </Button>
          <Button variant="secondary" onClick={() => void loadDetail(row)}>
            View
          </Button>
          <Button variant="ghost" onClick={() => void onDelete(row.id)}>
            Delete
          </Button>
        </div>
      ),
    },
  ], [activeSessionId, loadDetail, onDelete, setActiveSessionId]);

  const bulkActions = React.useMemo<BulkAction[]>(() => [{ label: "Delete Selected", action: "delete" }], []);

  const onBulkAction = React.useCallback((action: string, selectedIds: string[]) => {
    if (action !== "delete") return;
    const selectedRows = filteredSessions.filter((row) => selectedIds.includes(row.id));
    void bulkDelete(selectedRows);
  }, [bulkDelete, filteredSessions]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <h1 className="text-xl font-semibold">Sessions</h1>
          <p className="text-sm text-muted-foreground">
            Create, inspect, switch, and delete persisted chat sessions using the shared table and form patterns.
          </p>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <Input
              aria-label="Search sessions"
              className="max-w-md"
              placeholder="Search sessions"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
            />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" onClick={() => void refreshSessions()}>
                Refresh
              </Button>
              <Button onClick={() => setCreateOpen(true)}>Create session</Button>
            </div>
          </div>
          <DataTable
            tableId="chat-sessions"
            columns={columns}
            rows={filteredSessions}
            totalRows={sessions.length}
            emptyMessage="No sessions yet. Create one to begin."
            getRowId={(row) => row.id}
            page={page}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            selectable={true}
            bulkActions={bulkActions}
            onBulkAction={onBulkAction}
            columnPickerEnabled={true}
          />

          {status ? <p className="text-sm text-emerald-700">{status}</p> : null}
          {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Session detail</h2>
          <p className="text-sm text-muted-foreground">
            Read-only session metadata and recent transcript activity.
          </p>
        </CardHeader>
        <CardContent className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          {selectedSession ? (
            <EntityForm
              fields={detailFields}
              values={detailValues}
              mode="view"
              onChange={() => {}}
              onSubmit={() => {}}
              onCancel={() => setSelectedSession(null)}
            />
          ) : (
            <p className="text-sm text-muted-foreground">Select a session to inspect it.</p>
          )}
          <RelatedItemsPanel
            title="Recent transcript events"
            items={selectedSession ? transcriptItems(detailEvents) : []}
            emptyMessage="No transcript events loaded."
          />
        </CardContent>
      </Card>

      <EntityDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create session"
        fields={createFields}
        values={createForm}
        mode="add"
        onChange={(name, value) => setCreateForm((current) => ({ ...current, [name]: value }))}
        onSubmit={() => void onCreate()}
        onCancel={() => setCreateOpen(false)}
      />
    </div>
  );
}
