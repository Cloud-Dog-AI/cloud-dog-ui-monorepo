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

// W28E-1870-A: VDB change-watch WebUI (PS-102 §10 / CSTREAM-011).
//
// Composes the shared @cloud-dog/ui change-watch component set
// (ChangeWatchPanel + CriteriaBuilder + WatchJournalTable + WatchStatusBadge)
// and drives the index-retriever `index_watch_*` MCP tools through the common
// `api.callTool` transport — NO bespoke watch UI (RULES §1.4). The backend maps
// the common ChangeEvent envelope; this page maps those payloads onto the shared
// view models.

import * as React from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  ChangeWatchPanel,
  CriteriaBuilder,
  Input,
  WatchJournalTable,
  type WatchCriteria,
  type WatchEventRow,
  type WatchRow,
  type WatchState,
} from "@cloud-dog/ui";
import { useIndexRetrieverState } from "../state/AppState";
import type { JsonRecord } from "../lib/types";

const EMPTY_CRITERIA: WatchCriteria = { match: [], actions: [] };

/** Map a backend watch status payload onto the shared WatchRow view model. */
function toWatchRow(raw: JsonRecord): WatchRow {
  const status = (raw.status as JsonRecord | undefined) ?? raw;
  const rawState = String((status.state as string | undefined) ?? "live");
  const state: WatchState =
    rawState === "paused"
      ? "paused"
      : status.throttled
        ? "throttled"
        : "live";
  return {
    watchId: String(raw.watch_id ?? status.watch_id ?? ""),
    serviceId: String(raw.service_id ?? "index-retriever"),
    profileId: String(raw.profile_id ?? ""),
    tenantId: String(raw.tenant_id ?? status.tenant_id ?? ""),
    state,
    depth: Number(status.journal_depth ?? 0),
    latestSeq: Number(status.latest_seq ?? 0),
    ackSeq: Number(status.ack_seq ?? 0),
    inflight: Number(status.inflight ?? 0),
  };
}

/** Map a backend ChangeEvent envelope onto the shared WatchEventRow view model. */
function toEventRow(ev: JsonRecord, index: number): WatchEventRow {
  return {
    cursor: String(ev.cursor ?? ""),
    seq: index,
    action: String(ev.action ?? ""),
    objectRef: String(ev.object_ref ?? ""),
    eventTime: String(ev.event_time ?? ev.observed_time ?? ""),
    summary: String(ev.summary ?? ""),
  };
}

/** Translate the shared CriteriaBuilder value into the backend criteria mapping. */
function toBackendCriteria(value: WatchCriteria): JsonRecord {
  const criteria: JsonRecord = {};
  if (value.actions.length > 0) {
    criteria.action = [...value.actions];
  }
  const metadata: JsonRecord = {};
  for (const c of value.match) {
    if (c.kind === "field" && c.field) {
      metadata[c.field] = c.pattern;
    } else if (c.field === "collection") {
      criteria.collection = c.pattern;
    } else if (c.field === "source_uri" || c.field === "title" || c.field === "text") {
      criteria[c.field] = c.kind === "regex" ? `re:${c.pattern}` : c.pattern;
    } else if (c.field === "source_domain" || c.field === "language") {
      criteria[c.field] = c.pattern;
    }
  }
  if (Object.keys(metadata).length > 0) {
    criteria.metadata = metadata;
  }
  return criteria;
}

export function WatchesPage(): JSX.Element {
  const { api, sourceConfig } = useIndexRetrieverState();
  const [profile, setProfile] = React.useState(sourceConfig.profile);
  const [watches, setWatches] = React.useState<WatchRow[]>([]);
  const [criteria, setCriteria] = React.useState<WatchCriteria>(EMPTY_CRITERIA);
  const [journalOf, setJournalOf] = React.useState<string | null>(null);
  const [events, setEvents] = React.useState<WatchEventRow[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string>("");

  const refresh = React.useCallback(async () => {
    setError(null);
    try {
      const out = await api.callTool<{ watches?: JsonRecord[] }>("index_watch_list", { profile });
      setWatches((out.watches ?? []).map(toWatchRow));
    } catch (err) {
      setError(String(err));
    }
  }, [api, profile]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const onCreate = React.useCallback(async () => {
    setError(null);
    try {
      await api.callTool("index_watch_create", { profile, criteria: toBackendCriteria(criteria) });
      setStatus("watch created");
      setCriteria(EMPTY_CRITERIA);
      await refresh();
    } catch (err) {
      setError(String(err));
    }
  }, [api, profile, criteria, refresh]);

  const lifecycle = React.useCallback(
    async (tool: string, watchId: string, extra: JsonRecord = {}) => {
      setError(null);
      try {
        await api.callTool(tool, { profile, watch_id: watchId, ...extra });
        await refresh();
      } catch (err) {
        setError(String(err));
      }
    },
    [api, profile, refresh],
  );

  const openJournal = React.useCallback(
    async (watchId: string) => {
      setJournalOf(watchId);
      setError(null);
      try {
        const out = await api.callTool<{ events?: JsonRecord[]; next_cursor?: string }>(
          "index_watch_get_batch",
          { profile, watch_id: watchId, max_batch: 100 },
        );
        setEvents((out.events ?? []).map(toEventRow));
        setNextCursor(String(out.next_cursor ?? ""));
      } catch (err) {
        setError(String(err));
      }
    },
    [api, profile],
  );

  const ackJournal = React.useCallback(
    async (cursor: string) => {
      if (!journalOf) return;
      await lifecycle("index_watch_ack", journalOf, { ack_cursor: cursor });
      await openJournal(journalOf);
    },
    [journalOf, lifecycle, openJournal],
  );

  const recoverJournal = React.useCallback(async () => {
    if (!journalOf) return;
    await api.callTool("index_watch_recover", { profile, watch_id: journalOf });
    await openJournal(journalOf);
  }, [api, profile, journalOf, openJournal]);

  return (
    <div aria-label="Change watches page">
      <Card>
        <CardHeader>
          <h1>VDB Change Watches</h1>
          <p>
            Subscribe to document ingest, chunk/metadata change, delete, and collection changes across a
            VDB profile/collection with criteria. Consume bounded, resumable batches.
          </p>
        </CardHeader>
        <CardContent>
          <label htmlFor="watch-profile">Profile</label>
          <Input
            id="watch-profile"
            value={profile}
            onChange={(e) => setProfile((e.target as HTMLInputElement).value)}
          />
          <CriteriaBuilder value={criteria} onChange={setCriteria} />
          {status ? <p role="status">{status}</p> : null}
          {error ? <p role="alert">{error}</p> : null}
        </CardContent>
      </Card>

      <ChangeWatchPanel
        watches={watches}
        onCreate={onCreate}
        onPause={(id) => void lifecycle("index_watch_pause", id)}
        onResume={(id) => void lifecycle("index_watch_resume", id)}
        onDelete={(id) => void lifecycle("index_watch_delete", id)}
        onOpenJournal={(id) => void openJournal(id)}
        onTestEvent={(id) => void lifecycle("index_watch_test_event", id, { action: "created", object_ref: "webui-test" })}
      />

      {journalOf ? (
        <Card>
          <CardHeader>
            <h2>Journal — {journalOf}</h2>
            <Button onClick={() => setJournalOf(null)}>Close</Button>
          </CardHeader>
          <CardContent>
            <WatchJournalTable
              events={events}
              onAck={(cursor) => void ackJournal(cursor || nextCursor)}
              onRecover={() => void recoverJournal()}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
