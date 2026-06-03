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

// @cloud-dog/app-index-retriever — Retention/reindex/delete controls with confirmations.

import * as React from "react";
import { Button, Card, CardContent, CardHeader, CodeEditor, Input, JsonExplorer, RelativeTime, Select, type DataColumn } from "@cloud-dog/ui";
import { DataTable } from "@cloud-dog/ui";
import { useIndexRetrieverState } from "../state/AppState";
import type { JsonRecord } from "../lib/types";

type RetentionRow = Readonly<{
  id: string;
  action: string;
  detail: string;
  timestamp: string;
}>;

function parseObject(text: string): JsonRecord {
  const trimmed = text.trim();
  if (!trimmed) return {};
  const parsed = JSON.parse(trimmed);
  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    throw new Error("Filter JSON must be an object.");
  }
  return parsed as JsonRecord;
}

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

export function RetentionDeletePage() {
  const app = useIndexRetrieverState();
  const { api, sourceConfig } = app;

  const [profile, setProfile] = React.useState(sourceConfig.profile);
  const [collection, setCollection] = React.useState(sourceConfig.collection);
  const [docId, setDocId] = React.useState("");
  const [olderThanDays, setOlderThanDays] = React.useState("90");
  const [filterJson, setFilterJson] = React.useState('{}');

  const [confirmRetention, setConfirmRetention] = React.useState("");
  const [confirmReindex, setConfirmReindex] = React.useState("");
  const [confirmDeleteFilter, setConfirmDeleteFilter] = React.useState("");
  const [confirmDeleteId, setConfirmDeleteId] = React.useState("");

  const [result, setResult] = React.useState<unknown>(null);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [profileOptions, setProfileOptions] = React.useState<string[]>([sourceConfig.profile]);
  const [collectionOptions, setCollectionOptions] = React.useState<string[]>([sourceConfig.collection]);
  const [page, setPage] = React.useState(1);
  const [pageSize, setPageSize] = React.useState(10);

  React.useEffect(() => {
    let cancelled = false;
    const loadProfiles = async () => {
      try {
        const out = await api.callTool<JsonRecord>("profiles_list", {});
        if (cancelled) return;
        setProfileOptions(Array.from(new Set([profile, ...asStringArray(out.profiles)].filter(Boolean))));
      } catch {
        if (!cancelled) setProfileOptions([profile].filter(Boolean));
      }
    };
    void loadProfiles();
    return () => {
      cancelled = true;
    };
  }, [api, profile]);

  React.useEffect(() => {
    let cancelled = false;
    const loadCollections = async () => {
      try {
        const out = asRecord(await api.listCollections(profile.trim() || "default"));
        if (cancelled) return;
        const collections = Array.isArray(out.collections)
          ? out.collections.map(asRecord).map((item) => String(item.collection ?? "").trim()).filter(Boolean)
          : [];
        setCollectionOptions(Array.from(new Set([collection, ...collections].filter(Boolean))));
      } catch {
        if (!cancelled) setCollectionOptions([collection].filter(Boolean));
      }
    };
    void loadCollections();
    return () => {
      cancelled = true;
    };
  }, [api, collection, profile]);

  const rows = React.useMemo<RetentionRow[]>(() => {
    return app.activity
      .filter((item) => item.action.startsWith("controls."))
      .map((item, index) => ({
        id: `${item.timestamp}-${index}`,
        action: item.action,
        detail: item.detail ?? item.outcome,
        timestamp: item.timestamp,
      }));
  }, [app.activity]);

  const run = async (action: string, fn: () => Promise<unknown>) => {
    setError(null);
    setStatus("");

    try {
      const out = await fn();
      setResult(out);
      setStatus(`${action} completed`);
      app.recordActivity(`controls.${action}`, "ok", `${profile}/${collection}`);
    } catch (runError) {
      const message = app.captureFailure(runError);
      setError(message);
      app.recordActivity(`controls.${action}`, "error", message);
    }
  };

  const columns: DataColumn<RetentionRow>[] = [
    { id: "action", header: "Document ID", cell: (row) => row.action, sortable: true, sortValue: (row) => row.action },
    { id: "collection", header: "Collection", cell: () => collection, sortable: true, sortValue: () => collection },
    {
      id: "ingested",
      header: "Ingested",
      cell: (row) => <RelativeTime timestamp={row.timestamp} />,
      sortable: true,
      sortValue: (row) => row.timestamp,
    },
    { id: "expires", header: "Expires", cell: () => `+${olderThanDays}d` },
    { id: "detail", header: "Detail", cell: (row) => row.detail, sortable: true, sortValue: (row) => row.detail },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Retention and Delete Controls</h1>
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

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Scope</h2>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <div>
            <label htmlFor="control-profile" className="text-sm font-medium">
              Profile
            </label>
            <Select id="control-profile" value={profile} onChange={(event) => setProfile(event.target.value)}>
              {profileOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="control-collection" className="text-sm font-medium">
              Collection
            </label>
            <Select id="control-collection" value={collection} onChange={(event) => setCollection(event.target.value)}>
              {collectionOptions.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </Select>
          </div>
          <div>
            <label htmlFor="control-doc-id" className="text-sm font-medium">
              Doc ID (delete by id)
            </label>
            <Input id="control-doc-id" value={docId} onChange={(event) => setDocId(event.target.value)} />
          </div>
          <div>
            <label htmlFor="control-older-days" className="text-sm font-medium">
              Older than days
            </label>
            <Input
              id="control-older-days"
              type="number"
              min={0}
              value={olderThanDays}
              onChange={(event) => setOlderThanDays(event.target.value)}
            />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Retention run</h2>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="rounded border p-3 text-sm text-muted-foreground space-y-1">
            <p><strong>Parameters:</strong> profile, collection, older_than_days</p>
            <p><strong>Behaviour:</strong> Marks documents ingested more than <em>older_than_days</em> ago as deleted. Only affects the latest version of each document. Documents with <code>lifecycle_state=archived</code> are skipped.</p>
            <p><strong>Expected outcome:</strong> Returns <code>{`{"deleted": <count>, "status": "ok"}`}</code>. Deleted documents are no longer returned by search but may be recoverable via reindex.</p>
          </div>
          <p className="text-sm text-muted-foreground">Type RETENTION to confirm.</p>
          <Input value={confirmRetention} onChange={(event) => setConfirmRetention(event.target.value)} aria-label="Confirm retention" />
          <Button
            variant="secondary"
            disabled={confirmRetention.trim().toUpperCase() !== "RETENTION"}
            onClick={() =>
              void run("retention_run", () =>
                api.callTool("retention_run", {
                  profile,
                  collection,
                  older_than_days: Number(olderThanDays) || 0,
                })
              )
            }
          >
            Run Retention
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Reindex run</h2>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="rounded border p-3 text-sm text-muted-foreground space-y-1">
            <p><strong>Parameters:</strong> profile, collection</p>
            <p><strong>Behaviour:</strong> Re-processes all documents in the collection using the current profile indexing settings (chunking strategy, embedding model, dimensions).</p>
            <p><strong>Expected outcome:</strong> Existing chunks are replaced with freshly computed embeddings. Long-running for large collections.</p>
          </div>
          <p className="text-sm text-muted-foreground">Type REINDEX to confirm.</p>
          <Input value={confirmReindex} onChange={(event) => setConfirmReindex(event.target.value)} aria-label="Confirm reindex" />
          <Button
            variant="secondary"
            disabled={confirmReindex.trim().toUpperCase() !== "REINDEX"}
            onClick={() => void run("reindex_run", () => api.callTool("reindex_run", { profile, collection }))}
          >
            Run Reindex
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Delete by filter</h2>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="rounded border p-3 text-sm text-muted-foreground space-y-1">
            <p><strong>Parameters:</strong> profile, collection, filters (JSON object)</p>
            <p><strong>Behaviour:</strong> Permanently deletes all documents matching the filter criteria from the vector database and metadata store.</p>
            <p><strong>Filter examples:</strong> <code>{`{"source": "file://path"}`}</code> or <code>{`{"metadata.tag": "value"}`}</code>. An empty filter <code>{`{}`}</code> deletes all documents.</p>
            <p><strong>Expected outcome:</strong> Returns the count of deleted documents. This operation is irreversible.</p>
          </div>
          <label htmlFor="control-filter-json" className="text-sm font-medium">
            Filter JSON
          </label>
          <CodeEditor value={filterJson} onChange={setFilterJson} language="json" height={180} />
          <p className="text-sm text-muted-foreground">Type DELETE FILTER to confirm.</p>
          <Input value={confirmDeleteFilter} onChange={(event) => setConfirmDeleteFilter(event.target.value)} aria-label="Confirm delete filter" />
          <Button
            variant="destructive"
            disabled={confirmDeleteFilter.trim().toUpperCase() !== "DELETE FILTER"}
            onClick={() =>
              void run("delete_by_filter", () =>
                api.callTool("delete_by_filter", {
                  profile,
                  collection,
                  filters: parseObject(filterJson),
                })
              )
            }
          >
            Delete by Filter
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Delete by ID</h2>
        </CardHeader>
        <CardContent className="space-y-2">
          <div className="rounded border p-3 text-sm text-muted-foreground space-y-1">
            <p><strong>Parameters:</strong> profile, collection, doc_id</p>
            <p><strong>Behaviour:</strong> Permanently deletes a single document by its ID from the vector database and metadata store.</p>
            <p><strong>Expected outcome:</strong> The document and all its chunks are removed. This operation is irreversible.</p>
          </div>
          <p className="text-sm text-muted-foreground">Type DELETE ID to confirm.</p>
          <Input value={confirmDeleteId} onChange={(event) => setConfirmDeleteId(event.target.value)} aria-label="Confirm delete id" />
          <Button
            variant="destructive"
            disabled={confirmDeleteId.trim().toUpperCase() !== "DELETE ID" || !docId.trim()}
            onClick={() => void run("delete_by_id", () => api.callTool("delete_by_id", { profile, collection, doc_id: docId.trim() }))}
          >
            Delete by ID
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Recent retention actions</h2>
        </CardHeader>
        <CardContent>
          <DataTable
            tableId="retention-list"
            rows={rows}
            getRowId={(row) => row.id}
            columns={columns}
            emptyMessage="No retention actions yet."
            page={page}
            onPageChange={setPage}
            pageSize={pageSize}
            onPageSizeChange={setPageSize}
            selectable={true}
            bulkActions={[{ label: "Export Selected", action: "export" }]}
            onBulkAction={(action, ids) => {
              if (action !== "export") return;
              const exportRows = rows.filter((row) => ids.includes(row.id));
              const blob = new Blob([JSON.stringify(exportRows, null, 2)], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const link = document.createElement("a");
              link.href = url;
              link.download = "retention-actions.json";
              link.click();
              URL.revokeObjectURL(url);
            }}
            columnPickerEnabled={true}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Control result</h2>
        </CardHeader>
        <CardContent>
          <JsonExplorer title="result" data={result ?? {}} defaultExpanded />
        </CardContent>
      </Card>
    </div>
  );
}
