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

// W28E-1870-C: git change-watch WebUI (PS-102 §10 / CSTREAM-GIT-001/002).
//
// Composes the shared @cloud-dog/ui change-watch component set
// (ChangeWatchPanel + CriteriaBuilder + WatchJournalTable + WatchStatusBadge)
// and drives the git-mcp `git_watch_*` tools through the common `callApiTool`
// transport — NO bespoke watch UI (RULES §1.4). The backend maps the common
// ChangeEvent envelope; this page maps those payloads onto the shared view models.

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
import { useGitMcpState } from "../state/AppState";

type JsonRecord = Record<string, unknown>;

const EMPTY_CRITERIA: WatchCriteria = { match: [], actions: [] };

/** Map a backend watch view payload onto the shared WatchRow view model. */
function toWatchRow(raw: JsonRecord): WatchRow {
  const status = (raw.status as JsonRecord | undefined) ?? raw;
  const rawState = String((status.state as string | undefined) ?? "live");
  const state: WatchState =
    rawState === "paused" ? "paused" : status.throttled ? "throttled" : "live";
  return {
    watchId: String(raw.watch_id ?? status.watch_id ?? ""),
    serviceId: String(raw.service_id ?? "git-mcp"),
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

/** Translate the shared CriteriaBuilder value into the git-mcp criteria mapping.
 *
 * Git criteria fields (CSTREAM-GIT-001): branch / tag (exact via kind "field"),
 * ref / path / author (glob or ``re:`` regex), and action verbs.
 */
function toBackendCriteria(value: WatchCriteria): JsonRecord {
  const criteria: JsonRecord = {};
  if (value.actions.length > 0) {
    criteria.action = [...value.actions];
  }
  for (const c of value.match) {
    const field = c.field ?? "ref";
    if (field === "branch" || field === "tag") {
      // exact short-name matches; a builder regex is ignored for these
      criteria[field] = c.pattern;
    } else if (field === "ref" || field === "path" || field === "author") {
      criteria[field] = c.kind === "regex" ? `re:${c.pattern}` : c.pattern;
    }
  }
  return criteria;
}

export function WatchesPage(): JSX.Element {
  const app = useGitMcpState();
  const [profile, setProfile] = React.useState("");
  const [watches, setWatches] = React.useState<WatchRow[]>([]);
  const [criteria, setCriteria] = React.useState<WatchCriteria>(EMPTY_CRITERIA);
  const [journalOf, setJournalOf] = React.useState<string | null>(null);
  const [events, setEvents] = React.useState<WatchEventRow[]>([]);
  const [nextCursor, setNextCursor] = React.useState<string>("");
  const [error, setError] = React.useState<string | null>(null);
  const [status, setStatus] = React.useState<string>("");

  const tenant = profile || "default";

  const call = React.useCallback(
    async (tool: string, args: JsonRecord): Promise<JsonRecord | null> => {
      const outcome = await app.api.callApiTool(app.apiKey, tool, args);
      if (!outcome.ok) {
        setError(outcome.errorMessage || `Failed: ${tool}`);
        return null;
      }
      return (outcome.data as JsonRecord) ?? {};
    },
    [app.api, app.apiKey],
  );

  const refresh = React.useCallback(async () => {
    setError(null);
    const data = await call("git_watch_list", { profile, tenant_id: tenant });
    if (data) {
      const rows = Array.isArray(data.watches) ? (data.watches as JsonRecord[]) : [];
      setWatches(rows.map(toWatchRow));
    }
  }, [call, profile, tenant]);

  React.useEffect(() => {
    void refresh();
  }, [refresh]);

  const onCreate = React.useCallback(async () => {
    setError(null);
    const data = await call("git_watch_create", {
      profile,
      tenant_id: tenant,
      criteria: toBackendCriteria(criteria),
    });
    if (data) {
      setStatus(`watch ${String(data.watch_id ?? "")} created`);
      setCriteria(EMPTY_CRITERIA);
      await refresh();
    }
  }, [call, profile, tenant, criteria, refresh]);

  const lifecycle = React.useCallback(
    async (tool: string, watchId: string, extra: JsonRecord = {}) => {
      setError(null);
      const ok = await call(tool, { profile, tenant_id: tenant, watch_id: watchId, ...extra });
      if (ok) await refresh();
    },
    [call, profile, tenant, refresh],
  );

  const openJournal = React.useCallback(
    async (watchId: string) => {
      setJournalOf(watchId);
      setError(null);
      const data = await call("git_watch_get_batch", {
        profile,
        tenant_id: tenant,
        watch_id: watchId,
        max_batch: 100,
      });
      if (data) {
        const evs = Array.isArray(data.events) ? (data.events as JsonRecord[]) : [];
        setEvents(evs.map(toEventRow));
        setNextCursor(String(data.next_cursor ?? ""));
      }
    },
    [call, profile, tenant],
  );

  const ackJournal = React.useCallback(
    async (cursor: string) => {
      if (!journalOf) return;
      await lifecycle("git_watch_ack", journalOf, { ack_cursor: cursor || nextCursor });
      await openJournal(journalOf);
    },
    [journalOf, nextCursor, lifecycle, openJournal],
  );

  const recoverJournal = React.useCallback(async () => {
    if (!journalOf) return;
    await call("git_watch_recover", { profile, tenant_id: tenant, watch_id: journalOf });
    await openJournal(journalOf);
  }, [call, profile, tenant, journalOf, openJournal]);

  const observeNow = React.useCallback(
    async (watchId: string) => {
      setError(null);
      const data = await call("git_watch_observe", {
        profile,
        tenant_id: tenant,
        watch_id: watchId,
      });
      if (data) {
        setStatus(`observed ${String(data.observed_refs ?? 0)} refs, emitted ${String(data.emitted ?? 0)} events`);
        await refresh();
      }
    },
    [call, profile, tenant, refresh],
  );

  return (
    <div aria-label="Change watches page">
      <Card>
        <CardHeader>
          <h1>Git Change Watches</h1>
          <p>
            Subscribe to commits, branch/tag movement, file add/modify/delete, merges, and force-push
            on a repository profile with criteria (branch, tag, ref/path glob or regex, author, action).
            Consume bounded, resumable batches.
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
        onPause={(id) => void lifecycle("git_watch_pause", id)}
        onResume={(id) => void lifecycle("git_watch_resume", id)}
        onDelete={(id) => void lifecycle("git_watch_delete", id)}
        onOpenJournal={(id) => void openJournal(id)}
        onTestEvent={(id) => void observeNow(id)}
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
