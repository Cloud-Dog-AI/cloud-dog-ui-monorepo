// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0.

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import {
  EntityDialog,
  JsonExplorer,
  SessionsHistoryPanel,
  type EntityFieldDef,
  type SessionsHistoryAction,
  type SessionsHistoryRow,
} from "@cloud-dog/ui";
import { useGeoState } from "../state/AppState";
import { errMessage, useEntityList } from "../lib/ui";
import type { GeoSession } from "../lib/api";

const WRITE_ROLES = new Set(["geo.operator", "geo.analyst", "geo.admin", "admin", "read-write"]);

export function SessionsPage() {
  const { api, appVersion } = useGeoState();
  const auth = useAuth();
  const canWrite = (auth.user?.roles ?? []).some((r) => WRITE_ROLES.has(r));
  const { rows, loading, error, reload } = useEntityList<GeoSession>(() => api.listSessions(), [api]);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [form, setForm] = React.useState<{ session_id: string; profile_id: string }>({ session_id: "", profile_id: "" });
  const [status, setStatus] = React.useState<string | null>(null);
  const [formError, setFormError] = React.useState<string | null>(null);
  const sessionById = React.useMemo(() => new Map(rows.map((row) => [String(row.session_id ?? ""), row])), [rows]);

  const fields: EntityFieldDef[] = [
    { name: "session_id", label: "Session ID — unique identifier", type: "text", required: true },
    { name: "profile_id", label: "Profile ID", type: "text" },
  ];

  const submit = async () => {
    setFormError(null);
    try {
      await api.createSession({ session_id: form.session_id.trim(), profile_id: form.profile_id.trim() || undefined });
      setStatus(`Created session ${form.session_id.trim()}.`);
      setDialogOpen(false);
      await reload();
    } catch (e) {
      setFormError(errMessage(e, "Failed to create session (you may lack permission)."));
    }
  };

  const close = React.useCallback(async (s: GeoSession) => {
    await api.closeSession(s.session_id ?? "");
    setStatus(`Closed session ${s.session_id}.`);
    await reload();
  }, [api, reload]);

  const panelRows = React.useMemo<SessionsHistoryRow[]>(() => rows.map((row, index) => {
    const id = String(row.session_id ?? index);
    const profileId = typeof row.profile_id === "string" ? row.profile_id : undefined;
    return {
      id,
      label: id,
      title: <span className="font-mono">{id}</span>,
      status: typeof row.status === "string" ? row.status : "unknown",
      actor: typeof row.tenant_id === "string" ? row.tenant_id : undefined,
      target: profileId,
      createdAt: typeof row.created_at === "string" ? row.created_at : undefined,
      lastActivityAt: typeof row.updated_at === "string" ? row.updated_at : undefined,
      expiresAt: typeof row.expires_at === "string" ? row.expires_at : undefined,
      retention: typeof row.expires_at === "string" ? "Expires by policy" : undefined,
      summary: profileId ? `Profile ${profileId}` : "Geospatial work session",
    };
  }), [rows]);

  const actions = React.useMemo<SessionsHistoryAction[]>(() => canWrite ? [
    {
      id: "close",
      label: "Close",
      destructive: true,
      onClick: (row) => {
        const target = sessionById.get(row.id);
        if (target) void close(target).catch((e) => setStatus(errMessage(e, "Failed to close session (you may lack permission).")));
      },
      confirm: {
        title: "Close Session",
        description: "Close this session. Open work in the session is finalised.",
        confirmLabel: "Close Session",
      },
    },
  ] : [], [canWrite, close, sessionById]);

  return (
    <div className="space-y-6" data-testid="page-sessions">
      <SessionsHistoryPanel
        title="Sessions"
        description={`Tenant-scoped geospatial work sessions.${appVersion ? ` Version ${appVersion}.` : ""}`}
        rows={panelRows}
        loading={loading}
        error={error}
        emptyMessage="No sessions."
        canonicalRoute="/sessions"
        onRefresh={() => void reload()}
        onCreate={canWrite ? () => { setForm({ session_id: "", profile_id: "" }); setFormError(null); setDialogOpen(true); } : undefined}
        createLabel="New Session"
        actions={actions}
        pageSize={10}
        tableId="geospatial-sessions"
        renderDetail={(row) => <JsonExplorer data={sessionById.get(row.id) ?? row} defaultExpanded />}
      />

      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title="New Session"
        fields={fields}
        values={form as unknown as Record<string, unknown>}
        onChange={(name, value) => setForm((cur) => ({ ...cur, [name]: String(value ?? "") }))}
        onSubmit={() => void submit()}
        onCancel={() => setDialogOpen(false)}
        mode="add"
        extra={formError ? <p role="alert" className="text-sm text-destructive">{formError}</p> : undefined}
      />

    </div>
  );
}
