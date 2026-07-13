// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0

import * as React from "react";
import { Button, Card, CardContent, CardHeader, CodeEditor, JsonExplorer } from "@cloud-dog/ui";
import { Save } from "lucide-react";
import { useSbomState } from "../state/AppState";
import { PageHeader, StatusLine, errMessage } from "../lib/ui";
import { normaliseMaskedSettings, removeRedactedValues } from "../lib/masking";

function pretty(value: unknown): string {
  return JSON.stringify(value, null, 2);
}

export function AdminSettingsPage() {
  const { api, appVersion } = useSbomState();
  const [settings, setSettings] = React.useState<Record<string, unknown> | null>(null);
  const [draft, setDraft] = React.useState("{}");
  const [loading, setLoading] = React.useState(true);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [notice, setNotice] = React.useState<string | null>(null);

  const load = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await api.getSettings();
      const masked = normaliseMaskedSettings(result.settings);
      setSettings(masked);
      setDraft(pretty(masked));
    } catch (e) {
      setError(errMessage(e, "Failed to load admin settings."));
    } finally {
      setLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    void load();
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

  return (
    <div className="space-y-6">
      <PageHeader
        title="Admin Settings"
        version={appVersion}
        description="Admin-only runtime settings update. Masked values stay rendered as <redacted>."
      >
        <Button variant="secondary" size="sm" onClick={() => void load()}>Reload</Button>
      </PageHeader>
      <StatusLine loading={loading} error={error} status={notice} />
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
              height={384}
              value={draft}
              onChange={setDraft}
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
      {settings ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Current masked settings</h2>
          </CardHeader>
          <CardContent>
            <JsonExplorer data={settings} />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
