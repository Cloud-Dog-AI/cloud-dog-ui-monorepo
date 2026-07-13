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

// @cloud-dog/app-file-mcp — Storage change-watch WebUI (W28E-1870-B, PS-102 §10).
//
// Reference adopter of the shared @cloud-dog/ui change-watch component set
// (ChangeWatchPanel + CriteriaBuilder + WatchJournalTable + WatchStatusBadge).
// This page composes ONLY those shared components + the file-mcp api-client
// mapping onto the common REST /v1/watches* surface (PS-102 §5.5); it adds no
// bespoke table, journal, or status widget.

import * as React from "react";
import {
  Button,
  ChangeWatchPanel,
  CriteriaBuilder,
  EntityDialog,
  Input,
  WatchJournalTable,
  type WatchCriteria,
  type WatchEventRow,
  type WatchRow,
  type WatchState,
} from "@cloud-dog/ui";
import { useFileMcpState } from "../state/AppState";

// Canonical action verbs the file-mcp change-stream can emit for storage
// objects (PS-102 §4 ACTIONS, file-mcp subset).
const FILE_ACTIONS: readonly string[] = [
  "created",
  "updated",
  "deleted",
  "renamed",
  "moved",
  "metadata_changed",
];

// Metadata/field keys the file-mcp watch criteria understand (CSTREAM-FILE-001).
const FILE_FIELDS: readonly string[] = ["backend", "is_dir", "etag", "mtime", "size"];

function toWatchState(raw: unknown): WatchState {
  const s = String(raw ?? "").toLowerCase();
  if (s === "paused") return "paused";
  if (s === "throttled") return "throttled";
  if (s === "cursor-expired" || s === "cursor_expired") return "cursor-expired";
  if (s === "error" || s === "stopped" || s === "degraded") return "error";
  return "live";
}

function toWatchRow(w: Record<string, unknown>): WatchRow {
  const status = (w.status as Record<string, unknown> | undefined) ?? {};
  return {
    watchId: String(w.watch_id ?? ""),
    serviceId: String(w.service_id ?? "file-mcp"),
    profileId: String(w.profile_id ?? ""),
    tenantId: String(w.tenant_id ?? ""),
    state: toWatchState(status.state),
    depth: Number(status.journal_depth ?? 0),
    latestSeq: Number(status.latest_seq ?? 0),
    ackSeq: Number(status.ack_seq ?? 0),
    inflight: Number(status.inflight ?? 0),
  };
}

function toEventRow(e: Record<string, unknown>): WatchEventRow {
  return {
    cursor: String(e.cursor ?? ""),
    seq: Number((e as { seq?: unknown }).seq ?? 0),
    action: String(e.action ?? ""),
    objectRef: String(e.object_ref ?? ""),
    eventTime: String(e.event_time ?? ""),
    summary: String(e.summary ?? ""),
  };
}

// Translate the shared CriteriaBuilder value into the file-mcp REST criteria
// payload (path glob/regex + metadata fields + action verbs).
function toRestCriteria(value: WatchCriteria): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const c of value.match) {
    if (!c.pattern) continue;
    if (c.kind === "regex") {
      out.regex = c.pattern;
    } else if (c.kind === "field" && c.field) {
      const meta = (out.metadata as Record<string, unknown>) ?? {};
      meta[c.field] = c.pattern;
      out.metadata = meta;
    } else {
      out.path = c.pattern;
    }
  }
  if (value.actions.length > 0) out.action = [...value.actions];
  return out;
}

const EMPTY_CRITERIA: WatchCriteria = { match: [], actions: [] };

export function WatchesPage() {
  const { api } = useFileMcpState();
  const [watches, setWatches] = React.useState<WatchRow[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string | null>(null);

  const [createOpen, setCreateOpen] = React.useState(false);
  const [profile, setProfile] = React.useState("default");
  const [criteria, setCriteria] = React.useState<WatchCriteria>(EMPTY_CRITERIA);

  const [journalWatch, setJournalWatch] = React.useState<string | null>(null);
  const [events, setEvents] = React.useState<WatchEventRow[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string>("");

  const refresh = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const rows = await api.listWatches();
      setWatches(rows.map(toWatchRow));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const onCreate = React.useCallback(async () => {
    try {
      await api.createWatch({ profile, criteria: toRestCriteria(criteria) });
      setCreateOpen(false);
      setCriteria(EMPTY_CRITERIA);
      setStatus("Watch created");
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    }
  }, [api, profile, criteria, refresh]);

  const loadJournal = React.useCallback(
    async (watchId: string, sinceCursor?: string) => {
      const batch = await api.getWatchEvents(watchId, sinceCursor);
      const rows = Array.isArray(batch.events) ? (batch.events as Record<string, unknown>[]) : [];
      setEvents(rows.map(toEventRow));
      setNextCursor(String(batch.next_cursor ?? ""));
      setJournalWatch(watchId);
    },
    [api],
  );

  const act = React.useCallback(
    async (fn: () => Promise<unknown>, msg: string) => {
      try {
        await fn();
        setStatus(msg);
        await refresh();
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      }
    },
    [refresh],
  );

  return (
    <div className="space-y-4" aria-label="Storage change-watches">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Change Watches</h1>
          <p className="text-sm text-muted-foreground">
            Subscribe to storage-profile changes (create / update / delete / rename) and
            consume bounded, resumable event batches (PS-102).
          </p>
        </div>
        <Button type="button" variant="outline" onClick={() => void refresh()} disabled={loading}>
          Refresh
        </Button>
      </div>

      {error ? (
        <div role="alert" className="rounded border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm">
          {error}
        </div>
      ) : null}
      {status ? (
        <div role="status" className="rounded border border-emerald-300 bg-emerald-50 px-3 py-2 text-sm text-emerald-900">
          {status}
        </div>
      ) : null}

      <ChangeWatchPanel
        watches={watches}
        emptyMessage={loading ? "Loading watches…" : "No change-watches yet. Create one to begin."}
        onCreate={() => setCreateOpen(true)}
        onPause={(id) => void act(() => api.pauseWatch(id), "Watch paused")}
        onResume={(id) => void act(() => api.resumeWatch(id), "Watch resumed")}
        onDelete={(id) => void act(() => api.deleteWatch(id), "Watch deleted")}
        onOpenJournal={(id) => void loadJournal(id)}
        onTestEvent={(id) => void act(() => api.testEventWatch(id), "Test event injected")}
      />

      {journalWatch ? (
        <section aria-label={`Journal for ${journalWatch}`} className="space-y-2">
          <h2 className="text-lg font-medium">Journal — {journalWatch}</h2>
          <WatchJournalTable
            events={events}
            emptyMessage="No events in this batch."
            onAck={(cursor) =>
              void act(() => api.ackWatch(journalWatch, cursor || nextCursor), "Acknowledged")
            }
            onRecover={() => void act(() => api.recoverWatch(journalWatch), "Recovered")}
            onReenquire={() => void loadJournal(journalWatch, nextCursor)}
          />
        </section>
      ) : null}

      <EntityDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Create change-watch"
        body={
          <div className="space-y-3">
            <p className="text-sm text-muted-foreground">
              Watch a storage profile with glob / regex path criteria and action filters.
            </p>
            <label className="block text-sm font-medium" htmlFor="watch-profile">
              Storage profile
            </label>
            <Input
              id="watch-profile"
              value={profile}
              onChange={(e) => setProfile(e.target.value)}
              placeholder="default"
            />
            <CriteriaBuilder
              value={criteria}
              onChange={setCriteria}
              fields={FILE_FIELDS}
              actionOptions={FILE_ACTIONS}
            />
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="secondary" onClick={() => setCreateOpen(false)}>
                Cancel
              </Button>
              <Button type="button" onClick={() => void onCreate()}>
                Create
              </Button>
            </div>
          </div>
        }
      />
    </div>
  );
}
