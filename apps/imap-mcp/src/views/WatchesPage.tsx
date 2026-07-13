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

// W28E-1870-D: mail-profile change-watch WebUI (PS-102 §10 / CSTREAM-011).
//
// Composes the shared @cloud-dog/ui change-watch component set
// (ChangeWatchPanel + CriteriaBuilder + WatchJournalTable + WatchStatusBadge)
// and drives the imap-mcp `imap_watch_*` tools through the common `api.callTool`
// transport — NO bespoke watch UI (RULES §1.4). The backend maps the common
// ChangeEvent envelope; this page maps those payloads onto the shared view
// models (WatchRow / WatchEventRow / WatchCriteria).

import * as React from "react";
import {
  ChangeWatchPanel,
  CriteriaBuilder,
  WatchJournalTable,
  type WatchCriteria,
  type WatchEventRow,
  type WatchRow,
  type WatchState,
} from "@cloud-dog/ui";
import { useImapMcpState } from "../state/AppState";
import type { JsonRecord } from "../lib/types";

const EMPTY_CRITERIA: WatchCriteria = { match: [], actions: [] };

// Mail-profile criteria/metadata keys the service understands (CSTREAM-IMAP-001).
// Offered in the CriteriaBuilder "field" picker so an operator builds valid mail
// criteria (folder, sender, recipient, subject, header, body, attachment, flags).
const MAIL_FIELDS = [
  "folder",
  "sender",
  "recipient",
  "subject",
  "body",
  "attachment",
  "flags",
] as const;

/** Map a backend watch status payload onto the shared WatchRow view model. */
function toWatchRow(raw: JsonRecord): WatchRow {
  const status = (raw.status as JsonRecord | undefined) ?? raw;
  const rawState = String((status.state as string | undefined) ?? "live");
  const state: WatchState =
    rawState === "paused" ? "paused" : status.throttled ? "throttled" : "live";
  return {
    watchId: String(raw.watch_id ?? status.watch_id ?? ""),
    serviceId: String(raw.service_id ?? "imap-mcp"),
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

/** Translate the shared CriteriaBuilder value into the mail-profile criteria mapping. */
function toBackendCriteria(value: WatchCriteria): JsonRecord {
  const criteria: JsonRecord = {};
  if (value.actions.length > 0) {
    criteria.action = [...value.actions];
  }
  for (const c of value.match) {
    const field = c.field ?? "";
    const pattern = c.kind === "regex" ? `re:${c.pattern}` : c.pattern;
    if (!field) {
      // an unfielded glob/regex defaults to a subject match (most common alert)
      criteria.subject = pattern;
      continue;
    }
    if (field === "flags") {
      criteria.flags = c.pattern
        .split(",")
        .map((f) => f.trim())
        .filter(Boolean);
    } else if (field === "attachment") {
      criteria.attachment = c.pattern === "" ? true : pattern;
    } else if (field === "folder") {
      criteria.folder = c.pattern;
    } else {
      // sender / recipient / subject / body -> glob or regex pattern
      criteria[field] = pattern;
    }
  }
  return criteria;
}

export function WatchesPage(): JSX.Element {
  const { api } = useImapMcpState();
  const [profile, setProfile] = React.useState("default");
  const [watches, setWatches] = React.useState<WatchRow[]>([]);
  const [criteria, setCriteria] = React.useState<WatchCriteria>(EMPTY_CRITERIA);
  const [journalOf, setJournalOf] = React.useState<string | null>(null);
  const [events, setEvents] = React.useState<WatchEventRow[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string>("");

  const refresh = React.useCallback(async () => {
    setError(null);
    const out = await api.callTool<{ watches?: JsonRecord[] }>("imap_watch_list", { profile_id: profile });
    if (!out.ok) {
      setError(out.errorMessage || "failed to list watches");
      return;
    }
    setWatches((out.data?.watches ?? []).map(toWatchRow));
  }, [api, profile]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const onCreate = React.useCallback(async () => {
    setError(null);
    setStatus("");
    const out = await api.callTool("imap_watch_create", {
      profile_id: profile,
      criteria: toBackendCriteria(criteria),
    });
    if (!out.ok) {
      setError(out.errorMessage || "failed to create watch");
      return;
    }
    setStatus("watch created");
    setCriteria(EMPTY_CRITERIA);
    await refresh();
  }, [api, profile, criteria, refresh]);

  const lifecycle = React.useCallback(
    async (tool: string, watchId: string, extra: JsonRecord = {}) => {
      setError(null);
      const out = await api.callTool(tool, { profile_id: profile, watch_id: watchId, ...extra });
      if (!out.ok) {
        setError(out.errorMessage || `failed: ${tool}`);
      }
      await refresh();
    },
    [api, profile, refresh],
  );

  const openJournal = React.useCallback(
    async (watchId: string) => {
      setJournalOf(watchId);
      setError(null);
      const out = await api.callTool<{ events?: JsonRecord[]; next_cursor?: string }>(
        "imap_watch_get_batch",
        { profile_id: profile, watch_id: watchId, max_batch: 100 },
      );
      if (!out.ok) {
        setError(out.errorMessage || "failed to load journal");
        return;
      }
      setEvents((out.data?.events ?? []).map(toEventRow));
      setNextCursor(String(out.data?.next_cursor ?? ""));
    },
    [api, profile],
  );

  const ackJournal = React.useCallback(
    async (cursor: string) => {
      if (!journalOf) return;
      await lifecycle("imap_watch_ack", journalOf, { ack_cursor: cursor });
      await openJournal(journalOf);
    },
    [journalOf, lifecycle, openJournal],
  );

  const recoverJournal = React.useCallback(async () => {
    if (!journalOf) return;
    await api.callTool("imap_watch_recover", { profile_id: profile, watch_id: journalOf });
    await openJournal(journalOf);
  }, [api, profile, journalOf, openJournal]);

  return (
    <div aria-label="Mail change watches page">
      <section className="rounded-lg border bg-card p-4">
        <h1 className="text-lg font-semibold">Mail Change Watches</h1>
        <p className="text-sm text-muted-foreground">
          Subscribe to mail arrival, flag change, move/expunge across a mail profile with criteria
          (folder, sender, recipient, subject, header/body, attachment, flags — glob or regex).
          Consume bounded, resumable batches.
        </p>
        <div className="mt-3 flex items-center gap-2">
          <label htmlFor="watch-profile" className="text-sm font-medium">
            Profile
          </label>
          <input
            id="watch-profile"
            className="rounded-md border px-2 py-1 text-sm"
            value={profile}
            onChange={(e) => setProfile(e.currentTarget.value)}
          />
        </div>
        <div className="mt-3">
          <CriteriaBuilder value={criteria} onChange={setCriteria} fields={MAIL_FIELDS} />
        </div>
        {status ? (
          <p role="status" className="mt-2 text-sm text-green-600">
            {status}
          </p>
        ) : null}
        {error ? (
          <p role="alert" className="mt-2 text-sm text-red-600">
            {error}
          </p>
        ) : null}
      </section>

      <div className="mt-4">
        <ChangeWatchPanel
          watches={watches}
          onCreate={onCreate}
          onPause={(id) => void lifecycle("imap_watch_pause", id)}
          onResume={(id) => void lifecycle("imap_watch_resume", id)}
          onDelete={(id) => void lifecycle("imap_watch_delete", id)}
          onOpenJournal={(id) => void openJournal(id)}
          onTestEvent={(id) =>
            void lifecycle("imap_watch_test_event", id, { action: "created", object_ref: "webui-test" })
          }
        />
      </div>

      {journalOf ? (
        <section className="mt-4 rounded-lg border bg-card p-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">Journal — {journalOf}</h2>
            <button
              type="button"
              className="rounded-md border px-3 py-1 text-sm hover:bg-muted"
              onClick={() => setJournalOf(null)}
            >
              Close
            </button>
          </div>
          <div className="mt-3">
            <WatchJournalTable
              events={events}
              onAck={(cursor) => void ackJournal(cursor || nextCursor)}
              onRecover={() => void recoverJournal()}
            />
          </div>
        </section>
      ) : null}
    </div>
  );
}
