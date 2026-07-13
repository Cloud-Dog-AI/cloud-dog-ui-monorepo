// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0

import * as React from "react";
import { Button, Card, CardContent, CardHeader, CodeEditor, DataTable, SettingsPanel, StatusBadge, type DataColumn } from "@cloud-dog/ui";
import { Save } from "lucide-react";
import { useSbomState } from "../state/AppState";
import { errMessage } from "../lib/ui";
import { flattenSettings, normaliseMaskedSettings, removeRedactedValues } from "../lib/masking";
import type { StorageProfileResponse } from "../lib/types";

type SettingRow = { path: string; value: unknown; masked: boolean };

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function SettingsPage() {
  const { api, appVersion } = useSbomState();
  const [settings, setSettings] = React.useState<Record<string, unknown> | null>(null);
  const [draft, setDraft] = React.useState("{}");
  const [profiles, setProfiles] = React.useState<StorageProfileResponse[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const load = React.useCallback(async (isActive: () => boolean = () => true) => {
    setLoading(true);
    setError(null);
    setNotice(null);
    try {
      const [settingsResponse, profileResponse] = await Promise.all([
        api.getSettings(),
        api.listStorageProfiles(),
      ]);
      if (isActive()) {
        const masked = normaliseMaskedSettings(settingsResponse.settings);
        setSettings(masked);
        setDraft(pretty(masked));
        setProfiles(profileResponse.items.map((profile) => ({
          ...profile,
          config: normaliseMaskedSettings(profile.config),
        })));
      }
    } catch (e) {
      if (isActive()) setError(errMessage(e, "Failed to load settings."));
    } finally {
      if (isActive()) setLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    let active = true;
    void load(() => active);
    return () => {
      active = false;
    };
  }, [load]);

  const save = async (event: React.FormEvent) => {
    event.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const parsed = JSON.parse(draft) as Record<string, unknown>;
      const payload = removeRedactedValues(parsed) as Record<string, unknown>;
      const result = await api.updateSettings(payload);
      const masked = normaliseMaskedSettings(result.settings);
      setSettings(masked);
      setDraft(pretty(masked));
      setNotice("Settings saved.");
    } catch (e) {
      setError(errMessage(e, "Failed to save settings."));
    } finally {
      setSaving(false);
    }
  };

  const settingRows = React.useMemo(() => (settings ? flattenSettings(settings) : []), [settings]);

  const settingColumns: DataColumn<SettingRow>[] = [
    { id: "path", header: "Setting", sortable: true, sortValue: (r) => r.path, cell: (r) => <span className="font-mono text-xs">{r.path}</span> },
    { id: "value", header: "Value", sortable: true, sortValue: (r) => String(r.value ?? ""), cell: (r) => <span className={r.masked ? "font-mono text-xs text-muted-foreground" : "font-mono text-xs"}>{String(r.value ?? "—")}</span> },
    { id: "masked", header: "Mask", sortable: true, sortValue: (r) => (r.masked ? 1 : 0), cell: (r) => r.masked ? <StatusBadge value="redacted" /> : "—" },
  ];

  const profileColumns: DataColumn<StorageProfileResponse>[] = [
    { id: "name", header: "Profile", sortable: true, sortValue: (r) => r.name, cell: (r) => r.name },
    { id: "backend", header: "Backend", sortable: true, sortValue: (r) => r.backend, cell: (r) => r.backend },
    { id: "default", header: "Default", sortable: true, sortValue: (r) => (r.default ? 1 : 0), cell: (r) => r.default ? <StatusBadge value="default" /> : "—" },
    { id: "config", header: "Config", cell: (r) => <span className="font-mono text-xs">{JSON.stringify(r.config)}</span> },
  ];

  return (
    <div className="space-y-6">
      <SettingsPanel
        title="Settings"
        serviceName="sbom-mcp"
        version={appVersion}
        description="Effective masked runtime configuration and storage profiles."
        configData={settings ?? {}}
        maskToken="<redacted>"
        loading={loading}
        error={error}
        onRefresh={() => {
          void load();
        }}
        footer={notice ? <p role="status" className="text-sm text-foreground/80">{notice}</p> : null}
      >
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Edit settings JSON</h2>
          </CardHeader>
          <CardContent>
            <form className="space-y-3" onSubmit={save}>
              <input
                aria-label="Settings JSON"
                className="sr-only"
                value={draft}
                onChange={(event) => setDraft(event.currentTarget.value)}
              />
              <CodeEditor
                ariaLabel="Settings JSON"
                language="json"
                value={draft}
                onChange={setDraft}
                height={384}
              />
              <div className="flex justify-end">
                <Button type="submit" disabled={saving}>
                  <Save aria-hidden="true" className="h-4 w-4" />
                  {saving ? "Saving..." : "Save Settings"}
                </Button>
              </div>
            </form>
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Masked settings</h2>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={settingColumns}
              rows={settingRows}
              getRowId={(r) => r.path}
              emptyMessage="No settings returned."
              pageSize={25}
              columnPickerEnabled
              tableId="sbom-mcp-settings"
            />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Storage profiles</h2>
          </CardHeader>
          <CardContent>
            <DataTable
              columns={profileColumns}
              rows={profiles}
              getRowId={(r) => r.name}
              emptyMessage="No storage profiles returned."
              pageSize={10}
              tableId="sbom-mcp-storage-profiles"
            />
          </CardContent>
        </Card>
      </SettingsPanel>
    </div>
  );
}
