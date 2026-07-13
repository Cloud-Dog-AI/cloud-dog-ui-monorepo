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
import {
  JsonExplorer,
  SessionsHistoryPanel,
  type SessionsHistoryAction,
  type SessionsHistoryRow,
} from "@cloud-dog/ui";
import { useChartState } from "../state/AppState";
import { errMessage, useEntityList } from "../lib/ui";
import type { Session } from "../lib/types";

export function SessionsPage() {
  const { api, appVersion } = useChartState();
  const { rows, loading, error, reload } = useEntityList<Session>(() => api.listSessions(), [api]);
  const [status, setStatus] = React.useState<string | null>(null);

  const sessionById = React.useMemo(() => new Map(rows.map((row) => [row.session_id, row])), [rows]);

  const close = React.useCallback(async (session: Session) => {
    await api.closeSession(session.session_id);
    setStatus(`Closed session ${session.session_id}.`);
    await reload();
  }, [api, reload]);

  const panelRows = React.useMemo<SessionsHistoryRow[]>(() => rows.map((row) => ({
    id: row.session_id,
    label: row.session_id,
    title: <span className="font-mono">{row.session_id}</span>,
    status: row.status ?? "unknown",
    actor: row.owner_user_id ?? row.tenant_id ?? undefined,
    target: row.profile_id ?? undefined,
    createdAt: row.created_at,
    lastActivityAt: row.last_accessed_at,
    expiresAt: row.expires_at,
    retention: row.expires_at ? "Expires by policy" : undefined,
    summary: row.profile_id ? `Profile ${row.profile_id}` : "Rendering session",
    details: [
      ...(row.tenant_id ? [{ label: "Tenant", value: row.tenant_id }] : []),
      ...(row.owner_user_id ? [{ label: "Owner User", value: row.owner_user_id }] : []),
      ...(row.profile_id ? [{ label: "Profile", value: row.profile_id }] : []),
    ],
    relatedItems: [
      {
        id: `audit-${row.session_id}`,
        label: "Audit Log",
        href: `/audit-log?query=session:${encodeURIComponent(row.session_id)}`,
      },
    ],
  })), [rows]);

  const actions = React.useMemo<SessionsHistoryAction[]>(() => [
      {
        id: "close",
        label: "Close",
        destructive: true,
        disabled: (row) => String(row.status ?? "active").toLowerCase() !== "active",
        onClick: (row) => {
          const target = sessionById.get(row.id);
          if (target) void close(target).catch((e) => setStatus(errMessage(e, "Failed to close session.")));
        },
        confirm: {
          title: "Close Session",
          description: "Close this session. Active renders complete but no new work can be queued against it.",
          confirmLabel: "Close Session",
          irreversible: false,
        },
      },
      {
        id: "audit",
        label: "Audit Log",
        href: (row) => `/audit-log?query=session:${encodeURIComponent(row.id)}`,
        title: (row) => `View Audit Log for session ${row.id}`,
      },
    ], [close, sessionById]);

  return (
    <div className="space-y-6">
      <SessionsHistoryPanel
        title="Sessions"
        description={`Rendering sessions group inputs, specs, renders and assets under a profile.${appVersion ? ` Version ${appVersion}.` : ""}`}
        rows={panelRows}
        loading={loading}
        error={error}
        emptyMessage="No sessions."
        canonicalRoute="/sessions"
        onRefresh={() => void reload()}
        actions={actions}
        pageSize={10}
        tableId="chart-mcp-sessions"
        renderDetail={(row) => <JsonExplorer data={sessionById.get(row.id) ?? row} defaultExpanded />}
      />

      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}
    </div>
  );
}
