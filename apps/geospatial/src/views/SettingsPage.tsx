// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0.

import * as React from "react";
import { SettingsPanel, type SettingsPanelServerTab } from "@cloud-dog/ui";
import { useGeoState } from "../state/AppState";

/** Settings (PS-73) — read-only effective config + capabilities + health via
 * the shared JsonExplorer. Provider credentials are references only and secrets
 * are masked at the backend; non-admin callers never receive ${vault.*} values. */
export function SettingsPage() {
  const { api, appVersion } = useGeoState();
  const [config, setConfig] = React.useState<Record<string, unknown>>({});
  const [capabilities, setCapabilities] = React.useState<Record<string, unknown>>({});
  const [health, setHealth] = React.useState<Record<string, unknown>>({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (isActive: () => boolean = () => true) => {
    setLoading(true);
    setError(null);
    try {
      const [cfg, caps, h] = await Promise.all([
        api.config().catch(() => ({})),
        api.capabilities().catch(() => ({})),
        api.health().catch(() => ({})),
      ]);
      if (!isActive()) return;
      setConfig(cfg);
      setCapabilities(caps);
      setHealth(h);
    } catch (e) {
      if (isActive()) setError(e instanceof Error ? e.message : "Failed to load settings.");
    } finally {
      if (isActive()) setLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    let cancelled = false;
    void load(() => !cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  const effectiveData = React.useMemo(
    () => ({
      configuration: config,
      capabilities,
      health,
    }),
    [capabilities, config, health],
  );
  const serverTabs = React.useMemo<SettingsPanelServerTab[]>(
    () => [
      { id: "all", label: "ALL", data: effectiveData },
      { id: "api", label: "API", data: effectiveData },
      { id: "mcp", label: "MCP", data: effectiveData },
      { id: "a2a", label: "A2A", data: effectiveData },
      { id: "webui", label: "WebUI", data: effectiveData },
    ],
    [effectiveData],
  );

  return (
    <div className="space-y-6" data-testid="page-settings">
      <SettingsPanel
        title="Settings"
        serviceName="geospatial"
        version={appVersion}
        description="Effective service configuration, capabilities and health."
        serverTabs={serverTabs}
        loading={loading}
        error={error}
        onRefresh={() => {
          void load();
        }}
      />
    </div>
  );
}
