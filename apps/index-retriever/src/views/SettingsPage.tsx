// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0
// PS-73 Settings Page WebUI Standard — index-retriever implementation.

import * as React from "react";
import { Badge, Button, Card, CardContent, CardHeader, CodeEditor, Input, JsonExplorer, SettingsPanel, type SettingGroupDef } from "@cloud-dog/ui";
import { useConfig } from "@cloud-dog/config";
import { useIndexRetrieverState } from "../state/AppState";

/** SW4: Mask secrets in config objects before display or export. */
function maskSecrets(obj: unknown): unknown {
  if (obj === null || obj === undefined || typeof obj === "string") return obj;
  if (Array.isArray(obj)) return obj.map(maskSecrets);
  if (typeof obj === "object") {
    const masked: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const l = k.toLowerCase();
      if ((l.includes("password") || l.includes("secret") || l.includes("token") || l.includes("api_key") || l.includes("apikey") || l.includes("key_hash") || l.includes("credential")) && typeof v === "string" && v.length > 0) {
        masked[k] = "****";
      } else if (typeof v === "string" && (l.includes("uri") || l.includes("url") || l.includes("connection")) && v.includes("@")) {
        masked[k] = v.replace(/:([^:@]+)@/, ":****@");
      } else {
        masked[k] = maskSecrets(v);
      }
    }
    return masked;
  }
  return obj;
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function pickSection(source: Record<string, unknown>, keys: string[]): Record<string, unknown> {
  const section: Record<string, unknown> = {};
  for (const key of keys) {
    const value = source[key];
    if (value !== undefined) section[key] = value;
  }
  return section;
}

type RuntimeConfig = Readonly<{
  API_BASE_URL: string;
  AUTH_MODE?: string;
  APP_VERSION?: string;
  DEFAULT_PROFILE?: string;
  DEFAULT_COLLECTION?: string;
  MCP_BASE_URL?: string;
  A2A_BASE_URL?: string;
  SESSION_TIMEOUT_MINUTES?: number;
}>;

export function SettingsPage() {
  const cfg = useConfig<RuntimeConfig>();
  const app = useIndexRetrieverState();
  const { api } = app;

  const [draft, setDraft] = React.useState<Record<string, unknown>>({
    API_BASE_URL: cfg.API_BASE_URL,
    AUTH_MODE: cfg.AUTH_MODE ?? "api_key",
    APP_VERSION: cfg.APP_VERSION ?? "dev",
    DEFAULT_PROFILE: cfg.DEFAULT_PROFILE ?? "default",
    DEFAULT_COLLECTION: cfg.DEFAULT_COLLECTION ?? "",
    MCP_BASE_URL: cfg.MCP_BASE_URL ?? `${window.location.origin}/mcp`,
    A2A_BASE_URL: cfg.A2A_BASE_URL ?? `${window.location.origin}/a2a`,
    SESSION_TIMEOUT_MINUTES: cfg.SESSION_TIMEOUT_MINUTES ?? 30,
  });
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [importedConfig, setImportedConfig] = React.useState<unknown>(null);
  const [runtimeConfig, setRuntimeConfig] = React.useState<Record<string, unknown>>({});
  const [healthData, setHealthData] = React.useState<Record<string, unknown> | null>(null);
  const [healthOk, setHealthOk] = React.useState(false);
  const [editorValue, setEditorValue] = React.useState("");
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Fetch health on mount
  React.useEffect(() => {
    api.getHealth().then((h) => { setHealthData(h as Record<string, unknown>); setHealthOk(String((h as Record<string, unknown>).status) === "ok"); }).catch(() => {});
  }, [api]);

  React.useEffect(() => {
    api.getConfig().then(setRuntimeConfig).catch(() => setRuntimeConfig({}));
  }, [api]);

  const currentConfig = React.useMemo(
    () => maskSecrets(importedConfig ?? (Object.keys(runtimeConfig).length > 0 ? runtimeConfig : draft)),
    [draft, importedConfig, runtimeConfig]
  );

  React.useEffect(() => {
    setEditorValue(JSON.stringify(currentConfig, null, 2));
  }, [currentConfig]);

  const groups = React.useMemo<SettingGroupDef[]>(
    () => [
      {
        id: "indexing",
        label: "Indexing",
        settings: [
          { key: "DEFAULT_PROFILE", label: "Default profile", type: "text", value: draft.DEFAULT_PROFILE, readOnly: true, description: "Default ingest/search profile." },
          { key: "DEFAULT_COLLECTION", label: "Default collection", type: "text", value: draft.DEFAULT_COLLECTION, readOnly: true, description: "Default ingest/search collection." },
        ],
      },
      {
        id: "build",
        label: "Build",
        settings: [
          { key: "APP_VERSION", label: "App version", type: "text", value: draft.APP_VERSION, readOnly: true, description: "SPA build version." },
        ],
      },
    ],
    [draft]
  );
  const currentConfigRecord = React.useMemo(() => asRecord(currentConfig), [currentConfig]);
  const serverSection = React.useMemo(
    () => pickSection(currentConfigRecord, ["api_server", "web_server", "mcp_server", "a2a_server"]),
    [currentConfigRecord],
  );
  const authSection = React.useMemo(
    () => pickSection(currentConfigRecord, ["auth", "rbac", "web_login"]),
    [currentConfigRecord],
  );
  const storageSection = React.useMemo(
    () => ({
      storage: currentConfigRecord.storage,
      queue: currentConfigRecord.queue,
      profile_defaults: asRecord(currentConfigRecord.profiles).default ?? currentConfigRecord.profiles,
    }),
    [currentConfigRecord],
  );
  const loggingSection = React.useMemo(
    () => ({
      audit: asRecord(currentConfigRecord.storage).audit,
      log: currentConfigRecord.log,
    }),
    [currentConfigRecord],
  );
  const runtimeLogSection = React.useMemo(
    () => asRecord(currentConfigRecord.log),
    [currentConfigRecord],
  );
  const runtimeQueueSection = React.useMemo(
    () => asRecord(currentConfigRecord.queue),
    [currentConfigRecord],
  );

  const runHealthCheck = async () => {
    setError(null);
    setStatus("");
    try {
      const health = await api.getHealth();
      setHealthData(health as Record<string, unknown>);
      setHealthOk(String((health as Record<string, unknown>).status) === "ok");
      setStatus(`Health check passed (${(health as Record<string, unknown>).status}).`);
      app.recordActivity("settings.health_check", "ok", String((health as Record<string, unknown>).status));
    } catch (healthError) {
      setHealthOk(false);
      const message = app.captureFailure(healthError);
      setError(message);
      app.recordActivity("settings.health_check", "error", message);
    }
  };

  const exportConfig = () => {
    const blob = new Blob([JSON.stringify(maskSecrets(draft), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "index-retriever-runtime-settings.json";
    link.click();
    URL.revokeObjectURL(url);
    setStatus("Exported runtime settings JSON (secrets masked).");
  };

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Settings</h1>
        <p className="text-sm text-muted-foreground">Runtime configuration display (PS-73) and system checks.</p>
      </header>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}

      {/* PS-73 SW2.1: Service Info */}
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Service Info</h2></CardHeader>
        <CardContent>
          <JsonExplorer
            data={maskSecrets({
              service: "index-retriever-mcp-server",
              version: draft.APP_VERSION ?? "unknown",
              environment: runtimeLogSection.environment ?? runtimeQueueSection.server_id ?? "unknown",
              default_profile: draft.DEFAULT_PROFILE,
              default_collection: draft.DEFAULT_COLLECTION,
              api_base_url: draft.API_BASE_URL,
            })}
            defaultExpanded
          />
        </CardContent>
      </Card>

      {/* PS-73 SW2.2: Server */}
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Server</h2></CardHeader>
        <CardContent>
          <JsonExplorer data={serverSection} defaultExpanded />
        </CardContent>
      </Card>

      {/* PS-73 SW2.3: Auth */}
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Auth</h2></CardHeader>
        <CardContent>
          <JsonExplorer data={maskSecrets(authSection)} defaultExpanded />
        </CardContent>
      </Card>

      {/* PS-73 SW2.4: Storage / Backend */}
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Storage / Backend</h2></CardHeader>
        <CardContent>
          <JsonExplorer data={maskSecrets(storageSection)} defaultExpanded />
        </CardContent>
      </Card>

      {/* PS-73 SW2.5: Logging */}
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Logging</h2></CardHeader>
        <CardContent>
          <JsonExplorer data={maskSecrets(loggingSection)} defaultExpanded />
        </CardContent>
      </Card>

      {/* PS-73 SW2.6: Service-Specific */}
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Service-Specific</h2></CardHeader>
        <CardContent>
          <JsonExplorer data={currentConfig} defaultExpanded />
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Configuration JSON Editor</h2></CardHeader>
        <CardContent className="space-y-3">
          <CodeEditor value={editorValue} onChange={setEditorValue} language="json" height={320} />
          <div className="flex gap-2">
            <Button
              variant="secondary"
              onClick={() => {
                try {
                  setImportedConfig(JSON.parse(editorValue));
                  setStatus("Applied configuration editor preview.");
                } catch (parseError) {
                  setError(app.captureFailure(parseError));
                }
              }}
            >
              Apply Preview
            </Button>
            <Button variant="secondary" onClick={() => setEditorValue(JSON.stringify(currentConfig, null, 2))}>
              Reset Editor
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* PS-73 SW2.7: Health */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Health</h2>
            <Badge variant={healthOk ? "default" : "destructive"} className={healthOk ? "bg-emerald-600 text-white border-emerald-700" : ""}>{healthOk ? "ok" : "unknown"}</Badge>
          </div>
        </CardHeader>
        <CardContent className="space-y-2">
          <JsonExplorer data={maskSecrets(healthData ?? { status: "loading" })} defaultExpanded />
          <Button onClick={() => void runHealthCheck()}>Refresh Health</Button>
        </CardContent>
      </Card>

      {/* User Preferences (preserved) */}
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">User Preferences</h2></CardHeader>
        <CardContent>
          <SettingsPanel
            groups={groups}
            onSave={(key, value) => { setDraft((current) => ({ ...current, [key]: value })); setStatus(`Updated ${key}`); }}
            onExport={exportConfig}
            onImport={() => fileInputRef.current?.click()}
          />
        </CardContent>
      </Card>

      <Input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        className="sr-only"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          if (!file) return;
          try {
            const text = await file.text();
            setImportedConfig(JSON.parse(text));
            setStatus(`Imported ${file.name}`);
          } catch (loadError) {
            setError(app.captureFailure(loadError));
          }
        }}
      />
    </div>
  );
}
