// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0
//
// W28K-1404e — PS-73 v2 canonical Settings page.
//
// Renders the live effective config snapshot from
// /v1/admin/config/effective via the canonical @cloud-dog/ui JsonExplorer
// + a top-level SettingsPanel for action buttons (refresh, reveal, export).
// Secrets are masked by default; reveal=true requires settings.admin scope
// AND emits a structured app-log row (PS-73 §2.3).

import * as React from "react";
import {
  SettingsPanel,
  type SettingsPanelServerTab,
} from "@cloud-dog/ui";
import { useAuth } from "@cloud-dog/auth";
import { useAppState } from "../state/AppState";

type EffectiveConfig = Readonly<{
  config: Record<string, unknown>;
  redacted_keys: ReadonlyArray<string>;
  revealed: boolean;
  service: string;
}>;

function downloadJson(filename: string, payload: unknown) {
  const blob = new Blob([`${JSON.stringify(payload, null, 2)}\n`], {
    type: "application/json;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

export function SettingsPage() {
  const { apiBaseUrl } = useAppState();
  const auth = useAuth();
  const apiKey = auth.getAccessToken?.() ?? null;
  const [data, setData] = React.useState<EffectiveConfig | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [revealed, setRevealed] = React.useState(false);
  const [search, setSearch] = React.useState("");
  const [confirmReveal, setConfirmReveal] = React.useState(false);

  const load = React.useCallback(
    async (reveal: boolean) => {
      setLoading(true);
      setError(null);
      try {
        const r = await fetch(
          `${apiBaseUrl}/v1/admin/config/effective?reveal=${reveal ? "true" : "false"}`,
          {
            credentials: "include",
            headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
          },
        );
        if (!r.ok) throw new Error(`HTTP ${r.status}`);
        const body = (await r.json()) as EffectiveConfig;
        setData(body);
        setRevealed(body.revealed);
      } catch (e: any) {
        setError(e?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    },
    [apiBaseUrl, apiKey],
  );

  React.useEffect(() => {
    void load(false);
  }, [load]);

  const onExport = React.useCallback(async () => {
    try {
      const r = await fetch(`${apiBaseUrl}/v1/admin/config/effective/export`, {
        credentials: "include",
        headers: apiKey ? { Authorization: `Bearer ${apiKey}` } : {},
      });
      if (!r.ok) throw new Error(`HTTP ${r.status}`);
      const body = await r.json();
      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      downloadJson(`scheduler-effective-config-${ts}.json`, body);
    } catch (e: any) {
      setError(e?.message ?? String(e));
    }
  }, [apiBaseUrl, apiKey]);

  const serverTabs = React.useMemo<SettingsPanelServerTab[]>(
    () => {
      const config = data?.config ?? {};
      return [
        { id: "all", label: "ALL", data: config },
        { id: "api", label: "API", data: config },
        { id: "mcp", label: "MCP", data: config },
        { id: "a2a", label: "A2A", data: config },
        { id: "webui", label: "WebUI", data: config },
      ];
    },
    [data],
  );

  return (
    <div className="p-6 space-y-4" data-testid="settings-page">
      <SettingsPanel
        title="Settings"
        serviceName={data?.service ?? "scheduler-mcp"}
        description="Effective configuration snapshot."
        serverTabs={serverTabs}
        searchTerm={search}
        onSearchTermChange={setSearch}
        loading={loading}
        error={error}
        onRefresh={() => void load(revealed)}
        onExport={() => void onExport()}
        canRevealSecrets
        secretsRevealed={revealed}
        onRevealSecrets={revealed ? () => void load(false) : () => setConfirmReveal(true)}
        revealSecretsLabel="Reveal secrets"
        hideSecretsLabel="Hide secrets"
        confirmRevealOpen={confirmReveal}
        onConfirmReveal={() => {
          setConfirmReveal(false);
          void load(true);
        }}
        onCancelReveal={() => setConfirmReveal(false)}
        statusItems={data ? [
          { label: revealed ? "revealed" : "masked", testId: "settings-revealed" },
          { label: "redacted keys", value: data.redacted_keys.length, testId: "settings-redacted-count" },
        ] : undefined}
        footer={data ? <span data-testid="settings-service">Service: <strong>{data.service}</strong></span> : null}
      />
    </div>
  );
}
