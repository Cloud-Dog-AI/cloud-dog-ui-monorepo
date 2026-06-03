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

// @cloud-dog/app-index-retriever — Connector/source configuration workflows.

import * as React from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CodeEditor,
  DataTable,
  EntityDialog,
  EntityForm,
  FileDropZone,
  Input,
  JsonExplorer,
  Label,
  RelativeTime,
  RelatedItemsPanel,
  Select,
  Textarea,
  type DataColumn,
  type EntityFieldDef,
  type EntityFormMode,
} from "@cloud-dog/ui";
import { useIndexRetrieverState } from "../state/AppState";
import type { JsonRecord, SourceConfig, SourceConfigRecord } from "../lib/types";

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function parseJsonObject(input: string): JsonRecord {
  const text = input.trim();
  if (!text) return {};
  const parsed = JSON.parse(text);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Metadata JSON must be an object.");
  }
  return parsed as JsonRecord;
}

function slug(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

function sourceTypeForUri(uri: string): string {
  const value = uri.trim().toLowerCase();
  if (value.startsWith("http://") || value.startsWith("https://")) return "http";
  if (value.startsWith("s3://")) return "s3";
  return "filesystem";
}

function toSavedSourceConfig(record: SourceConfigRecord): SourceConfig {
  return {
    profile: record.profile,
    collection: record.collection,
    sourceUri: record.uri,
    dedupePolicy: "skip",
    indexingSignature: "chunk:v1",
    staleAfterDays: 30,
    metadataJson: JSON.stringify(record.metadata ?? {}, null, 2),
  };
}

function asSourceConfigRecord(value: unknown): SourceConfigRecord {
  const record = asRecord(value);
  return {
    source_id: String(record.source_id ?? ""),
    source_type: String(record.source_type ?? "filesystem"),
    uri: String(record.uri ?? ""),
    schedule: String(record.schedule ?? ""),
    profile: String(record.profile ?? "default"),
    collection: String(record.collection ?? ""),
    enabled: record.enabled !== false,
    metadata: asRecord(record.metadata),
  };
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function applySourceEventTimes(records: SourceConfigRecord[], events: unknown): SourceConfigRecord[] {
  const rows = Array.isArray(events) ? events.map(asRecord) : [];
  const byId = new Map<string, { created_at?: string; updated_at?: string }>();
  for (const row of rows) {
    if (String(row.entity_type ?? "") !== "source_config") continue;
    const entityId = String(row.entity_id ?? "").trim();
    if (!entityId) continue;
    const timestamp = String(row.created_at ?? row.timestamp ?? "").trim();
    if (!timestamp) continue;
    const current = byId.get(entityId) ?? {};
    if (String(row.action ?? "").includes("created") && !current.created_at) current.created_at = timestamp;
    current.updated_at = timestamp;
    byId.set(entityId, current);
  }
  return records.map((record) => ({ ...record, ...byId.get(record.source_id) }));
}

type SourceDraft = Readonly<{
  source_id: string;
  source_type: string;
  uri: string;
  schedule: string;
  profile: string;
  collection: string;
  enabled: boolean;
  metadata_json: string;
}>;

function toDraft(record?: SourceConfigRecord | null): SourceDraft {
  return {
    source_id: record?.source_id ?? "",
    source_type: record?.source_type ?? "filesystem",
    uri: record?.uri ?? "",
    schedule: record?.schedule ?? "manual",
    profile: record?.profile ?? "default",
    collection: record?.collection ?? "",
    enabled: record?.enabled ?? true,
    metadata_json: JSON.stringify(record?.metadata ?? {}, null, 2),
  };
}

export function SourceConfigPage() {
  const app = useIndexRetrieverState();
  const { api, captureFailure, recordActivity } = app;
  const canManageSourceConfigs = app.roles.includes("admin");
  const canTriggerSync = app.roles.some((role) => ["writer", "maintainer", "admin"].includes(role));

  const [savedConfigs, setSavedConfigs] = React.useState<SourceConfigRecord[]>([]);
  const [selected, setSelected] = React.useState<SourceConfigRecord | null>(null);
  const [draft, setDraft] = React.useState<SourceDraft>(toDraft({
    source_id: "default-source",
    source_type: "filesystem",
    uri: app.sourceConfig.sourceUri,
    schedule: "manual",
    profile: app.sourceConfig.profile,
    collection: app.sourceConfig.collection,
    enabled: true,
    metadata: parseJsonObject(app.sourceConfig.metadataJson),
  }));
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogMode, setDialogMode] = React.useState<EntityFormMode>("add");
  const [relatedItems, setRelatedItems] = React.useState<{ id: string; label: string }[]>([]);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [result, setResult] = React.useState<unknown>(null);
  const [profileOptions, setProfileOptions] = React.useState<string[]>([app.sourceConfig.profile]);
  const [collectionOptions, setCollectionOptions] = React.useState<string[]>([app.sourceConfig.collection]);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  const connectorGuide = React.useMemo(() => {
    if (draft.source_type === "http") {
      return {
        source_type: "http",
        expected_uri: "https://example.com/document.pdf",
        schedule_hint: "manual or periodic fetch",
      };
    }
    if (draft.source_type === "s3") {
      return {
        source_type: "s3",
        expected_uri: "s3://bucket/path/object",
        schedule_hint: "manual or object-store polling",
      };
    }
    return {
      source_type: "filesystem",
      expected_uri: "file://index-retriever/document.txt",
      schedule_hint: "manual or local file sync",
    };
  }, [draft.source_type]);

  const fields = React.useMemo<EntityFieldDef[]>(
    () => [
      { name: "source_id", label: "Source ID", type: "text", required: true, readOnly: dialogMode !== "add" },
      { name: "source_type", label: "Source type", type: "select", options: ["filesystem", "http", "s3", "webdav", "ftp", "gdrive"], required: true },
      { name: "profile", label: "Profile", type: "text", required: true },
      { name: "collection", label: "Collection", type: "text", required: true },
      { name: "uri", label: "URI", type: "text", required: true },
      { name: "schedule", label: "Schedule", type: "text" },
      { name: "enabled", label: "Enabled", type: "boolean" },
    ],
    [dialogMode]
  );

  const errors = React.useMemo(() => {
    const next: Record<string, string> = {};
    if (!draft.source_id.trim()) next.source_id = "Source ID is required.";
    if (!draft.uri.trim()) next.uri = "URI is required.";
    if (!draft.profile.trim()) next.profile = "Profile is required.";
    if (!draft.collection.trim()) next.collection = "Collection is required.";
    try {
      parseJsonObject(draft.metadata_json);
    } catch (parseError) {
      next.metadata_json = parseError instanceof Error ? parseError.message : "Invalid metadata JSON.";
    }
    return next;
  }, [draft]);

  const run = React.useCallback(async (action: string, fn: () => Promise<unknown>) => {
    setError(null);
    setStatus("");
    try {
      const response = await fn();
      setResult(response);
      setStatus(`${action} OK`);
      recordActivity(`source.${action}`, "ok");
      return response;
    } catch (runError) {
      const message = captureFailure(runError);
      setError(message);
      recordActivity(`source.${action}`, "error", message);
      throw runError;
    }
  }, [captureFailure, recordActivity]);

  const listConfigs = React.useCallback(async () => {
    const [out, events] = await Promise.all([
      api.listSourceConfigs(),
      api.getA2aEvents().catch(() => ({ events: [] })),
    ]);
    const sourceConfigsPayload = asRecord(out).source_configs;
    const rows = Array.isArray(sourceConfigsPayload) ? sourceConfigsPayload.map(asSourceConfigRecord) : [];
    const withTimes = applySourceEventTimes(rows, asRecord(events).events).sort((left, right) => {
      const leftTime = Date.parse(left.updated_at ?? left.created_at ?? "");
      const rightTime = Date.parse(right.updated_at ?? right.created_at ?? "");
      return (Number.isFinite(rightTime) ? rightTime : 0) - (Number.isFinite(leftTime) ? leftTime : 0);
    });
    setSavedConfigs(withTimes);
    return withTimes;
  }, [api]);

  React.useEffect(() => {
    void listConfigs();
  }, [listConfigs]);

  React.useEffect(() => {
    let cancelled = false;
    const loadOptions = async () => {
      try {
        const profilesOut = await api.callTool<JsonRecord>("profiles_list", {});
        if (cancelled) return;
        const profiles = asStringArray(profilesOut.profiles);
        setProfileOptions(Array.from(new Set([app.sourceConfig.profile, ...profiles].filter(Boolean))));
      } catch {
        if (!cancelled) setProfileOptions([app.sourceConfig.profile].filter(Boolean));
      }
    };
    void loadOptions();
    return () => {
      cancelled = true;
    };
  }, [api, app.sourceConfig.profile]);

  React.useEffect(() => {
    let cancelled = false;
    const profile = app.sourceConfig.profile.trim() || "default";
    const loadCollections = async () => {
      try {
        const collectionsOut = asRecord(await api.listCollections(profile));
        if (cancelled) return;
        const collections = Array.isArray(collectionsOut.collections)
          ? collectionsOut.collections.map(asRecord).map((item) => String(item.collection ?? "").trim()).filter(Boolean)
          : [];
        setCollectionOptions(Array.from(new Set([app.sourceConfig.collection, ...collections].filter(Boolean))));
      } catch {
        if (!cancelled) setCollectionOptions([app.sourceConfig.collection].filter(Boolean));
      }
    };
    void loadCollections();
    return () => {
      cancelled = true;
    };
  }, [api, app.sourceConfig.collection, app.sourceConfig.profile]);

  React.useEffect(() => {
    if (!selected) {
      setRelatedItems([]);
      return;
    }

    const related = [
      { id: `${selected.profile}:${selected.collection}`, label: `Collection target: ${selected.profile}/${selected.collection}` },
      ...app.activity
        .filter((item) => item.action.startsWith("source.") || item.action.startsWith("ingest."))
        .slice(0, 5)
        .map((item, index) => ({ id: `${item.timestamp}-${index}`, label: `${item.action}: ${item.outcome}` })),
    ];
    setRelatedItems(related);
  }, [app.activity, selected]);

  const payload = (): JsonRecord => ({
    source_id: draft.source_id.trim(),
    source_type: draft.source_type,
    uri: draft.uri.trim(),
    schedule: draft.schedule.trim(),
    profile: draft.profile.trim() || "default",
    collection: draft.collection.trim() || "",
    enabled: draft.enabled,
    metadata: parseJsonObject(draft.metadata_json),
  });

  const openAdd = () => {
    setDialogMode("add");
    setDraft(toDraft({
      source_id: "",
      source_type: "filesystem",
      uri: app.sourceConfig.sourceUri,
      schedule: "manual",
      profile: app.sourceConfig.profile,
      collection: app.sourceConfig.collection,
      enabled: true,
      metadata: parseJsonObject(app.sourceConfig.metadataJson),
    }));
    setDialogOpen(true);
  };

  const openDialog = (row: SourceConfigRecord, mode: EntityFormMode) => {
    setSelected(row);
    setDialogMode(mode);
    setDraft(toDraft(row));
    setDialogOpen(true);
  };

  const submit = async () => {
    if (Object.keys(errors).length > 0 || dialogMode === "view") return;

    if (dialogMode === "add") {
      await run("create", async () => {
        const out = await api.createSourceConfig(payload());
        await listConfigs();
        return out;
      });
    } else {
      await run("update", async () => {
        const out = await api.updateSourceConfig(draft.source_id.trim(), payload());
        await listConfigs();
        return out;
      });
    }

    setDialogOpen(false);
  };

  const deleteConfig = async (row: SourceConfigRecord) => {
    await run("delete", async () => {
      const out = await api.deleteSourceConfig(row.source_id);
      await listConfigs();
      return out;
    });
  };

  const useInIngest = (row: SourceConfigRecord) => {
    app.setSourceConfig(() => toSavedSourceConfig(row));
    setStatus("use_in_ingest OK");
    setError(null);
    app.recordActivity("source.use_in_ingest", "ok", row.source_id);
  };

  const probeReference = async (row: SourceConfigRecord) => {
    await run("probe_reference", async () => {
      return api.callTool("ingest_reference", {
        profile: row.profile,
        collection: row.collection,
        uri: row.uri,
      });
    });
  };

  const saveCurrentSourceConfig = async () => {
    const profile = app.sourceConfig.profile.trim() || "default";
    const collection = app.sourceConfig.collection.trim() || "";
    const sourceUri = app.sourceConfig.sourceUri.trim();
    const metadata = parseJsonObject(app.sourceConfig.metadataJson);
    const sourceId = `${slug(profile) || "default"}-${slug(collection) || "source"}-quick`;
    const payload = {
      source_id: sourceId,
      source_type: sourceTypeForUri(sourceUri),
      uri: sourceUri,
      schedule: "manual",
      profile,
      collection,
      enabled: true,
      metadata,
    } satisfies JsonRecord;

    await run("save_source_config", async () => {
      const existing = asRecord(await api.listSourceConfigs());
      const exists = Array.isArray(existing.source_configs)
        && existing.source_configs.some((item) => asSourceConfigRecord(item).source_id === sourceId);
      const out = exists
        ? await api.updateSourceConfig(sourceId, payload)
        : await api.createSourceConfig(payload);
      await listConfigs();
      return out;
    });
  };

  const columns: DataColumn<SourceConfigRecord>[] = [
    {
      id: "source_id",
      header: "Source ID",
      cell: (row) => (
        <Button
          variant="link"
          size="sm"
          className="h-auto p-0"
          onClick={() => openDialog(row, canManageSourceConfigs ? "edit" : "view")}
        >
          {row.source_id}
        </Button>
      ),
      sortable: true,
      sortValue: (row) => row.source_id,
    },
    { id: "type", header: "Type", cell: (row) => row.source_type },
    { id: "profile", header: "Profile", cell: (row) => row.profile },
    { id: "uri", header: "URI", cell: (row) => <span className="font-mono text-xs break-all">{row.uri}</span> },
    { id: "status", header: "Status", cell: (row) => (row.enabled ? "enabled" : "disabled") },
    {
      id: "created",
      header: "Created",
      cell: (row) => (row.created_at ? <RelativeTime timestamp={row.created_at} /> : "N/A"),
      sortable: true,
      sortValue: (row) => row.created_at ?? "",
    },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => openDialog(row, "view")}>
            View
          </Button>
          <Button size="sm" variant="secondary" onClick={() => openDialog(row, "edit")} disabled={!canManageSourceConfigs}>
            Edit
          </Button>
          <Button size="sm" variant="secondary" onClick={() => useInIngest(row)}>
            Use In Ingest
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void probeReference(row)} disabled={!canTriggerSync}>
            Test
          </Button>
          <Button size="sm" variant="destructive" onClick={() => void deleteConfig(row)} disabled={!canManageSourceConfigs}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header className="flex items-center gap-3">
        <h1 className="text-2xl font-semibold">Source Configuration</h1>
        <Button variant="secondary" size="sm" onClick={() => void listConfigs()}>
          Refresh Source Configs
        </Button>
      </header>

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      {status ? (
        <p role="status" className="text-sm text-foreground/80">
          {status}
        </p>
      ) : null}

      <Card aria-hidden={dialogOpen ? true : undefined}>
        <CardHeader>
          <h2 className="text-lg font-semibold">Active source config</h2>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="active-source-profile">Profile</Label>
            <Select
              id="active-source-profile"
              value={app.sourceConfig.profile}
              onChange={(event) =>
                app.setSourceConfig((current) => ({
                  ...current,
                  profile: event.target.value,
                }))
              }
            >
              {profileOptions.map((profile) => (
                <option key={profile} value={profile}>{profile}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="active-source-collection">Collection</Label>
            <Select
              id="active-source-collection"
              value={app.sourceConfig.collection}
              onChange={(event) =>
                app.setSourceConfig((current) => ({
                  ...current,
                  collection: event.target.value,
                }))
              }
            >
              {collectionOptions.map((collection) => (
                <option key={collection} value={collection}>{collection}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="active-source-uri">Source URI</Label>
            <Input
              id="active-source-uri"
              value={app.sourceConfig.sourceUri}
              onChange={(event) =>
                app.setSourceConfig((current) => ({
                  ...current,
                  sourceUri: event.target.value,
                }))
              }
              placeholder="file://path/to/document.txt or https://example.com/doc.pdf or s3://bucket/key"
            />
            <FileDropZone
              accept=".txt,.pdf,.md,.json,.csv,.html,.xml,.doc,.docx"
              onDrop={(files) => {
                if (files.length > 0) {
                  const name = files[0].name;
                  app.setSourceConfig((current) => ({
                    ...current,
                    sourceUri: `file://${name}`,
                  }));
                }
              }}
            />
            <p className="text-xs text-muted-foreground">
              Drop or select a file to populate the URI, or type/paste a URI directly.
            </p>
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="active-source-metadata">Metadata JSON</Label>
            <CodeEditor
              ariaLabel="Active source metadata JSON"
              language="json"
              height={180}
              value={app.sourceConfig.metadataJson}
              onChange={(value) =>
                app.setSourceConfig((current) => ({
                  ...current,
                  metadataJson: value,
                }))
              }
            />
          </div>
          <div className="md:col-span-2">
            <Button onClick={() => void saveCurrentSourceConfig()} disabled={!canManageSourceConfigs}>Save Source Config</Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Saved source configs</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Button onClick={openAdd} disabled={!canManageSourceConfigs}>Add Source Config</Button>
            <Button variant="secondary" size="sm" onClick={() => void listConfigs()}>
              Refresh
            </Button>
          </div>
          <DataTable
            tableId="source-config-list"
            ariaLabel="source config list"
            rows={savedConfigs}
            getRowId={(row) => row.source_id}
            columns={columns}
            emptyMessage="No saved source configs yet."
            page={page}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            selectable={true}
            bulkActions={canManageSourceConfigs ? [{ label: "Delete Selected", action: "delete" }] : []}
            onBulkAction={(_action, ids) => {
              if (!canManageSourceConfigs) return;
              const rows = savedConfigs.filter((row) => ids.includes(row.source_id));
              void (async () => {
                for (const row of rows) await deleteConfig(row);
              })();
            }}
            columnPickerEnabled={true}
          />
        </CardContent>
      </Card>

      <RelatedItemsPanel
        title="Related items"
        items={relatedItems}
        emptyMessage="Select a source config to inspect target collection and ingest history."
      />

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Probe result</h2>
        </CardHeader>
        <CardContent>
          <JsonExplorer title="result" data={result ?? {}} defaultExpanded />
        </CardContent>
      </Card>

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={dialogMode === "add" ? "Add Source Config" : dialogMode === "edit" ? "Edit Source Config" : "View Source Config"}
        body={(
          <div className="space-y-4">
            <EntityForm
              fields={fields}
              values={draft as unknown as Record<string, unknown>}
              errors={errors}
              mode={dialogMode}
              onChange={(name, value) => setDraft((current) => ({ ...current, [name]: value }) as SourceDraft)}
              onSubmit={() => void submit()}
              onCancel={() => setDialogOpen(false)}
            />
            <Card>
              <CardHeader>
                <h3 className="text-base font-semibold">Connector-aware metadata</h3>
              </CardHeader>
              <CardContent className="space-y-3">
                <JsonExplorer data={connectorGuide} defaultExpanded />
                {dialogMode === "view" ? (
                  <CodeEditor
                    value={draft.metadata_json}
                    language="json"
                    ariaLabel="Metadata JSON"
                    readOnly
                    height={220}
                  />
                ) : (
                  <Textarea
                    id="ef-metadata_json"
                    name="metadata_json"
                    aria-label="Metadata JSON"
                    rows={10}
                    value={draft.metadata_json}
                    onChange={(event) =>
                      setDraft((current) => ({ ...current, metadata_json: event.target.value }) as SourceDraft)
                    }
                  />
                )}
                {errors.metadata_json ? <p className="text-sm text-destructive">{errors.metadata_json}</p> : null}
              </CardContent>
            </Card>
          </div>
        )}
      />
    </div>
  );
}
