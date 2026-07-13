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

// W28E-1870-E: database change-watch WebUI (PS-102 §10 / CSTREAM-DB-001).
//
// Composes the shared @cloud-dog/ui change-watch component set (ChangeWatchPanel
// + CriteriaBuilder + WatchJournalTable + WatchStatusBadge) and drives the
// db-mcp `/v1/watches*` REST surface through the app api client — NO bespoke
// watch UI (RULES §1.4). Maps the common ChangeEvent envelope onto the shared
// WatchRow / WatchEventRow / WatchCriteria view models.

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
import { useDbMcpState } from "../state/AppState";

type JsonRecord = Record<string, unknown>;

const EMPTY_CRITERIA: WatchCriteria = { match: [], actions: [] };

/** Map a backend watch payload onto the shared WatchRow view model. */
function toWatchRow(raw: JsonRecord): WatchRow {
  const status = (raw.status as JsonRecord | undefined) ?? raw;
  const rawState = String((status.state as string | undefined) ?? "live");
  const state: WatchState = rawState === "paused" ? "paused" : status.throttled ? "throttled" : "live";
  return {
    watchId: String(raw.watch_id ?? status.watch_id ?? ""),
    serviceId: String(raw.service_id ?? "db-mcp"),
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

/** Translate the shared CriteriaBuilder value into the db-mcp criteria mapping. */
function toBackendCriteria(value: WatchCriteria): JsonRecord {
  const criteria: JsonRecord = {};
  if (value.actions.length > 0) {
    criteria.action = [...value.actions];
  }
  const values: JsonRecord = {};
  for (const c of value.match) {
    if (c.kind === "field" && c.field) {
      values[c.field] = c.pattern;
    } else if (c.field === "namespace" || c.field === "entity") {
      criteria[c.field] = c.pattern;
    } else if (c.field === "entity_pattern") {
      criteria.entity_pattern = c.kind === "regex" ? `re:${c.pattern}` : c.pattern;
    }
  }
  if (Object.keys(values).length > 0) {
    criteria.value = values;
  }
  return criteria;
}

export function WatchesPage(): JSX.Element {
  const { api, selectedProfileId } = useDbMcpState();
  const [profile, setProfile] = React.useState(selectedProfileId || "default");
  const [watches, setWatches] = React.useState<WatchRow[]>([]);
  const [criteria, setCriteria] = React.useState<WatchCriteria>(EMPTY_CRITERIA);
  const [journalOf, setJournalOf] = React.useState<string | null>(null);
  const [events, setEvents] = React.useState<WatchEventRow[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string>("");

  React.useEffect(() => {
    if (selectedProfileId) setProfile(selectedProfileId);
  }, [selectedProfileId]);

  const refresh = React.useCallback(async () => {
    setError(null);
    try {
      const rows = await api.listWatches(profile);
      setWatches(rows.map(toWatchRow));
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
      await api.createWatch(profile, toBackendCriteria(criteria));
      setStatus("watch created");
      setCriteria(EMPTY_CRITERIA);
      await refresh();
    } catch (err) {
      setError(String(err));
    }
  }, [api, profile, criteria, refresh]);

  const openJournal = React.useCallback(
    async (watchId: string) => {
      setJournalOf(watchId);
      setError(null);
      try {
        const out = await api.watchBatch(profile, watchId, 100);
        const evs = (out.events as JsonRecord[] | undefined) ?? [];
        setEvents(evs.map(toEventRow));
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
      try {
        await api.ackWatch(profile, journalOf, cursor || nextCursor);
        await openJournal(journalOf);
        await refresh();
      } catch (err) {
        setError(String(err));
      }
    },
    [api, profile, journalOf, nextCursor, openJournal, refresh],
  );

  const recoverJournal = React.useCallback(async () => {
    if (!journalOf) return;
    try {
      await api.recoverWatch(profile, journalOf);
      await openJournal(journalOf);
    } catch (err) {
      setError(String(err));
    }
  }, [api, profile, journalOf, openJournal]);

  const lifecycle = React.useCallback(
    async (fn: () => Promise<unknown>) => {
      setError(null);
      try {
        await fn();
        await refresh();
      } catch (err) {
        setError(String(err));
      }
    },
    [refresh],
  );

  return (
    <div aria-label="Change watches page">
      <Card>
        <CardHeader>
          <h1>Database Change Watches</h1>
          <p>
            Subscribe to insert/update/delete and schema changes db-mcp performs across a database
            profile with namespace/entity/action/value criteria, and consume bounded, resumable batches
            (server-mediated capture, PS-102 §6).
          </p>
        </CardHeader>
        <CardContent>
          <label htmlFor="watch-profile">Profile</label>
          <Input id="watch-profile" value={profile} onChange={(e) => setProfile((e.target as HTMLInputElement).value)} />
          <CriteriaBuilder value={criteria} onChange={setCriteria} />
          {status ? <p role="status">{status}</p> : null}
          {error ? <p role="alert">{error}</p> : null}
        </CardContent>
      </Card>

      <ChangeWatchPanel
        watches={watches}
        onCreate={onCreate}
        onPause={(id) => void lifecycle(() => api.pauseWatch(profile, id))}
        onResume={(id) => void lifecycle(() => api.resumeWatch(profile, id))}
        onDelete={(id) => void lifecycle(() => api.deleteWatch(profile, id))}
        onOpenJournal={(id) => void openJournal(id)}
        onTestEvent={(id) => void lifecycle(() => api.watchTestEvent(profile, id))}
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
