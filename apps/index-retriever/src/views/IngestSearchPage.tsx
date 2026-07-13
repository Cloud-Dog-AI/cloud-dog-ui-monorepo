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

// @cloud-dog/app-index-retriever — Upload/index/search/retrieve workflows.

import * as React from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  ConfirmDialog,
  DataTable,
  FileBrowser,
  FileDropZone,
  JsonExplorer,
  Label,
  SearchPanel,
  Select,
  Textarea,
  type DataColumn,
  type FileItem,
  type FolderNode,
} from "@cloud-dog/ui";
import { useIndexRetrieverState } from "../state/AppState";
import type { JsonRecord, StoredFileRecord } from "../lib/types";

type SearchRow = Readonly<{
  doc_id: string;
  chunk_id: string;
  text: string;
  score: number;
  metadata: JsonRecord;
}>;

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonRecord;
}

function asSearchRows(value: unknown): SearchRow[] {
  if (!Array.isArray(value)) return [];

  const rows: SearchRow[] = [];
  for (const item of value) {
    const obj = asRecord(item);
    const docId = String(obj.doc_id ?? "").trim();
    if (!docId) continue;

    rows.push({
      doc_id: docId,
      chunk_id: String(obj.chunk_id ?? ""),
      text: String(obj.text ?? ""),
      score: Number(obj.score ?? 0),
      metadata: asRecord(obj.metadata),
    });
  }
  return rows;
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

function asStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((item): item is string => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);
}

function asStoredFileRows(value: unknown): StoredFileRecord[] {
  if (!Array.isArray(value)) return [];
  const rows: StoredFileRecord[] = [];
  for (const item of value) {
    const record = asRecord(item);
    const fileId = String(record.file_id ?? "").trim();
    if (!fileId) continue;
    rows.push({
      file_id: fileId,
      filename: String(record.filename ?? ""),
      profile: String(record.profile ?? "default"),
      size_bytes: Number(record.size_bytes ?? 0),
      content_hash: typeof record.content_hash === "string" ? record.content_hash : undefined,
      actor: typeof record.actor === "string" ? record.actor : undefined,
      created_at: typeof record.created_at === "string" ? record.created_at : undefined,
    });
  }
  return rows;
}

export function IngestSearchPage() {
  const app = useIndexRetrieverState();
  const { api, sourceConfig } = app;
  const canIngest = app.roles.some((role) => ["writer", "maintainer", "admin"].includes(role));
  const canManageFiles = app.roles.some((role) => ["maintainer", "admin"].includes(role));

  const [text, setText] = React.useState("");
  const [query, setQuery] = React.useState("");
  const [topK, setTopK] = React.useState("10");
  const [searchRows, setSearchRows] = React.useState<SearchRow[]>([]);
  const [ingestHistory, setIngestHistory] = React.useState<string[]>([]);
  const [retrieveResult, setRetrieveResult] = React.useState<unknown>(null);
  const [queuedFiles, setQueuedFiles] = React.useState<File[]>([]);
  const [storedFiles, setStoredFiles] = React.useState<StoredFileRecord[]>([]);
  const [storedFileResult, setStoredFileResult] = React.useState<unknown>(null);
  const [deleteFileTarget, setDeleteFileTarget] = React.useState<StoredFileRecord | null>(null);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [searchLoading, setSearchLoading] = React.useState(false);
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
        setProfileOptions(Array.from(new Set([sourceConfig.profile, ...asStringArray(out.profiles)].filter(Boolean))));
      } catch {
        if (!cancelled) setProfileOptions([sourceConfig.profile].filter(Boolean));
      }
    };
    void loadProfiles();
    return () => {
      cancelled = true;
    };
  }, [api, sourceConfig.profile]);

  React.useEffect(() => {
    let cancelled = false;
    const profile = sourceConfig.profile.trim() || "default";
    const loadCollections = async () => {
      try {
        const out = asRecord(await api.listCollections(profile));
        if (cancelled) return;
        const collections = Array.isArray(out.collections)
          ? out.collections.map(asRecord).map((item) => String(item.collection ?? "").trim()).filter(Boolean)
          : [];
        setCollectionOptions(Array.from(new Set([sourceConfig.collection, ...collections].filter(Boolean))));
      } catch {
        if (!cancelled) setCollectionOptions([sourceConfig.collection].filter(Boolean));
      }
    };
    void loadCollections();
    return () => {
      cancelled = true;
    };
  }, [api, sourceConfig.collection, sourceConfig.profile]);

  const rememberJob = (jobId: string) => {
    setIngestHistory((current) => (jobId ? [jobId, ...current].slice(0, 10) : current));
  };

  const refreshStoredFiles = React.useCallback(async () => {
    const response = asRecord(await api.listStoredFiles(sourceConfig.profile));
    const rows = asStoredFileRows(response.files);
    setStoredFiles(rows);
    return rows;
  }, [api, sourceConfig.profile]);

  React.useEffect(() => {
    void refreshStoredFiles().catch(() => undefined);
  }, [refreshStoredFiles]);

  const runIngest = async () => {
    setError(null);
    setStatus("");
    try {
      const metadata = parseJsonObject(sourceConfig.metadataJson);
      const response = await api.callTool<JsonRecord>("ingest_text", {
        profile: sourceConfig.profile,
        collection: sourceConfig.collection,
        source: sourceConfig.sourceUri,
        text,
        metadata,
        dedupe_policy: sourceConfig.dedupePolicy,
        indexing_signature: sourceConfig.indexingSignature,
        stale_after_days: sourceConfig.staleAfterDays,
      });

      const jobId = String(response.job_id ?? "").trim();
      rememberJob(jobId);
      setStatus(`ingest_text queued (${jobId || "no job id"})`);
      app.recordActivity("ingest.ingest_text", "ok", jobId || "queued");
    } catch (runError) {
      const message = app.captureFailure(runError);
      setError(message);
      app.recordActivity("ingest.ingest_text", "error", message);
    }
  };

  const runReferenceIngest = async () => {
    setError(null);
    setStatus("");
    try {
      const metadata = parseJsonObject(sourceConfig.metadataJson);
      const response = await api.callTool<JsonRecord>("ingest_reference", {
        profile: sourceConfig.profile,
        collection: sourceConfig.collection,
        uri: sourceConfig.sourceUri,
        metadata,
      });
      const jobId = String(response.job_id ?? "").trim();
      rememberJob(jobId);
      setRetrieveResult(response);
      setStatus(`ingest_reference queued (${jobId || "no job id"})`);
      app.recordActivity("ingest.ingest_reference", "ok", jobId || sourceConfig.sourceUri);
    } catch (runError) {
      const message = app.captureFailure(runError);
      setError(message);
      app.recordActivity("ingest.ingest_reference", "error", message);
    }
  };

  const runUpload = async () => {
    if (queuedFiles.length === 0) return;
    setError(null);
    setStatus("upload 0%");

    try {
      const metadata = parseJsonObject(sourceConfig.metadataJson);
      const responses: JsonRecord[] = [];
      for (const [index, file] of queuedFiles.entries()) {
        setStatus(`upload ${Math.round((index / queuedFiles.length) * 100)}%`);
        const response = asRecord(
          await api.uploadFile({
            profile: sourceConfig.profile,
            collection: sourceConfig.collection,
            file,
            metadata,
          })
        );
        responses.push(response);
        const jobId = String(response.job_id ?? "").trim();
        rememberJob(jobId);
      }
      setRetrieveResult(responses.length === 1 ? responses[0] : responses);
      setStatus(`upload 100% (${queuedFiles.length} file${queuedFiles.length === 1 ? "" : "s"})`);
      app.recordActivity("ingest.upload", "ok", queuedFiles.map((file) => file.name).join(", "));
    } catch (uploadError) {
      const message = app.captureFailure(uploadError);
      setError(message);
      setStatus("");
      app.recordActivity("ingest.upload", "error", message);
    }
  };

  const runStoredUpload = async () => {
    if (queuedFiles.length === 0) return;
    setError(null);
    setStatus("");
    try {
      const metadata = parseJsonObject(sourceConfig.metadataJson);
      const response = asRecord(
        await api.uploadStoredFile({
          profile: sourceConfig.profile,
          file: queuedFiles[0],
          metadata,
        })
      );
      setStoredFileResult(response);
      await refreshStoredFiles();
      const file = asRecord(response.file);
      setStatus(`stored file uploaded (${String(file.file_id ?? "no file id")})`);
      app.recordActivity("files.upload", "ok", String(file.file_id ?? queuedFiles[0].name));
    } catch (uploadError) {
      const message = app.captureFailure(uploadError);
      setError(message);
      app.recordActivity("files.upload", "error", message);
    }
  };

  const viewStoredFile = async (fileId: string) => {
    setError(null);
    try {
      const response = await api.getStoredFile(fileId);
      setStoredFileResult(response);
      setStatus(`file metadata loaded (${fileId})`);
      app.recordActivity("files.get", "ok", fileId);
    } catch (viewError) {
      const message = app.captureFailure(viewError);
      setError(message);
      app.recordActivity("files.get", "error", message);
    }
  };

  const downloadStoredFile = async (fileId: string) => {
    setError(null);
    try {
      const response = await api.downloadStoredFile(fileId);
      setStoredFileResult(response);
      setStatus(`file download loaded (${fileId})`);
      app.recordActivity("files.download", "ok", fileId);
    } catch (downloadError) {
      const message = app.captureFailure(downloadError);
      setError(message);
      app.recordActivity("files.download", "error", message);
    }
  };

  const deleteStoredFile = async (fileId: string) => {
    setError(null);
    try {
      const response = await api.deleteStoredFile(fileId);
      setStoredFileResult(response);
      await refreshStoredFiles();
      setStatus(`file deleted (${fileId})`);
      app.recordActivity("files.delete", "ok", fileId);
    } catch (deleteError) {
      const message = app.captureFailure(deleteError);
      setError(message);
      app.recordActivity("files.delete", "error", message);
    }
  };

  const storedFilePath = React.useCallback((row: StoredFileRecord) => `/stored-files/${row.file_id}/${row.filename}`, []);
  const storedFileByPath = React.useMemo(() => new Map(storedFiles.map((row) => [storedFilePath(row), row])), [storedFilePath, storedFiles]);
  const storedFileBrowserFiles = React.useMemo<FileItem[]>(
    () => storedFiles.map((row) => ({
      name: row.filename,
      path: storedFilePath(row),
      size: `${row.size_bytes} B`,
      contentType: row.profile,
      status: row.content_hash ? "hashed" : "stored",
      modified: row.created_at,
      kind: "file",
      testId: `index-retriever-stored-file-${row.file_id}`,
    })),
    [storedFilePath, storedFiles]
  );
  const storedFileBrowserFolders = React.useMemo<FolderNode[]>(
    () => [{ name: "Stored files", path: "/stored-files", children: [] }],
    []
  );

  const runSearch = async (nextQuery = query, nextTopK = topK) => {
    setError(null);
    setStatus("");
    setSearchLoading(true);
    try {
      const numericTopK = Number(nextTopK);
      const response = await api.callTool<JsonRecord>("search", {
        profile: sourceConfig.profile,
        collection: sourceConfig.collection,
        query: nextQuery,
        top_k: Number.isFinite(numericTopK) ? numericTopK : 10,
      });

      const rows = asSearchRows(response.results);
      setSearchRows(rows);
      setStatus(`search returned ${rows.length} row(s)`);
      app.recordActivity("ingest.search", "ok", String(rows.length));
    } catch (searchError) {
      const message = app.captureFailure(searchError);
      setError(message);
      app.recordActivity("ingest.search", "error", message);
    } finally {
      setSearchLoading(false);
    }
  };

  const runRetrieve = async (docId: string) => {
    setError(null);
    setStatus("");
    try {
      const response = await api.callTool("retrieve", {
        profile: sourceConfig.profile,
        collection: sourceConfig.collection,
        doc_id: docId,
      });
      setRetrieveResult(response);
      setStatus(`retrieve executed for ${docId}`);
      app.recordActivity("ingest.retrieve", "ok", docId);
    } catch (retrieveError) {
      const message = app.captureFailure(retrieveError);
      setError(message);
      app.recordActivity("ingest.retrieve", "error", message);
    }
  };

  const runExplain = async () => {
    setError(null);
    setStatus("");
    try {
      const numericTopK = Number(topK);
      const response = await api.callTool("search_explain", {
        profile: sourceConfig.profile,
        collection: sourceConfig.collection,
        query,
        top_k: Number.isFinite(numericTopK) ? numericTopK : 10,
      });
      setRetrieveResult(response);
      setStatus("search_explain returned explanation payload");
      app.recordActivity("ingest.search_explain", "ok");
    } catch (runError) {
      const message = app.captureFailure(runError);
      setError(message);
      app.recordActivity("ingest.search_explain", "error", message);
    }
  };

  const runReindex = async () => {
    setError(null);
    setStatus("");
    try {
      const response = await api.callTool("reindex_run", {
        profile: sourceConfig.profile,
        collection: sourceConfig.collection,
      });
      setRetrieveResult(response);
      setStatus("reindex_run accepted");
      app.recordActivity("ingest.reindex", "ok");
    } catch (reindexError) {
      const message = app.captureFailure(reindexError);
      setError(message);
      app.recordActivity("ingest.reindex", "error", message);
    }
  };

  const columns: DataColumn<SearchRow>[] = [
    {
      id: "doc",
      header: "Doc ID",
      cell: (row) => (
        <Button variant="link" size="sm" className="h-auto p-0 text-left" onClick={() => void runRetrieve(row.doc_id)}>
          {row.doc_id}
        </Button>
      ),
      sortable: true,
      sortValue: (row) => row.doc_id,
    },
    {
      id: "chunk",
      header: "Chunk",
      cell: (row) => <span className="font-mono text-xs break-all">{row.chunk_id || "-"}</span>,
    },
    {
      id: "score",
      header: "Score",
      cell: (row) => row.score.toFixed(3),
      sortable: true,
      sortValue: (row) => row.score,
    },
    {
      id: "text",
      header: "Snippet",
      cell: (row) => <span className="text-xs">{row.text.slice(0, 120)}</span>,
    },
    {
      id: "action",
      header: "Action",
      cell: (row) => (
        <Button size="sm" variant="secondary" onClick={() => void runRetrieve(row.doc_id)}>
          Retrieve
        </Button>
      ),
    },
  ];

  const storedFileColumns: DataColumn<StoredFileRecord>[] = [
    {
      id: "file_id",
      header: "File ID",
      cell: (row) => (
        <Button variant="link" size="sm" className="h-auto p-0 text-left font-mono text-xs" onClick={() => void viewStoredFile(row.file_id)}>
          {row.file_id}
        </Button>
      ),
      sortable: true,
      sortValue: (row) => row.file_id,
    },
    { id: "filename", header: "Filename", cell: (row) => row.filename, sortable: true, sortValue: (row) => row.filename },
    { id: "profile", header: "Profile", cell: (row) => row.profile, sortable: true, sortValue: (row) => row.profile },
    { id: "size", header: "Size", cell: (row) => String(row.size_bytes), sortable: true, sortValue: (row) => row.size_bytes },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex flex-wrap gap-2">
          <Button size="sm" variant="secondary" onClick={() => void viewStoredFile(row.file_id)}>
            Metadata
          </Button>
          <Button size="sm" variant="secondary" onClick={() => void downloadStoredFile(row.file_id)}>
            Download
          </Button>
          <Button size="sm" variant="destructive" onClick={() => setDeleteFileTarget(row)} disabled={!canManageFiles}>
            Delete
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Ingest Search Retrieve</h1>
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
          <h2 className="text-lg font-semibold">Target profile and collection</h2>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="ingest-profile">Profile</Label>
            <Select
              id="ingest-profile"
              value={sourceConfig.profile}
              onChange={(event) => app.setSourceConfig((current) => ({ ...current, profile: event.target.value }))}
            >
              {profileOptions.map((profile) => (
                <option key={profile} value={profile}>{profile}</option>
              ))}
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="ingest-collection">Collection</Label>
            <Select
              id="ingest-collection"
              value={sourceConfig.collection}
              onChange={(event) => app.setSourceConfig((current) => ({ ...current, collection: event.target.value }))}
            >
              {collectionOptions.map((collection) => (
                <option key={collection} value={collection}>{collection}</option>
              ))}
            </Select>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Ingest document text</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label htmlFor="ingest-text" className="text-sm font-medium">
              Document text
            </label>
            <Textarea id="ingest-text" rows={6} value={text} onChange={(event) => setText(event.target.value)} />
          </div>

          <div className="flex flex-wrap gap-2">
            <Button onClick={() => void runIngest()} disabled={!text.trim() || !canIngest}>
              Ingest Text
            </Button>
            <Button variant="secondary" onClick={() => void runIngest()} disabled={!text.trim() || !canIngest}>
              Ingest Same Content Again
            </Button>
            <Button variant="secondary" onClick={() => void runReferenceIngest()} disabled={!sourceConfig.sourceUri.trim() || !canIngest}>
              Ingest Reference
            </Button>
            <Button variant="secondary" onClick={() => void runReindex()} disabled={!canIngest}>
              Reindex Run
            </Button>
          </div>

          {ingestHistory.length > 0 ? (
            <ul className="text-xs font-mono" aria-label="ingest jobs">
              {ingestHistory.map((job, idx) => (
                <li key={`${job}-${idx}`}>job_id: {job}</li>
              ))}
            </ul>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Browser file upload</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <FileDropZone
            accept=".txt,.pdf,.md,.json,.csv,.html"
            disabled={!canIngest}
            label="Upload browser file"
            description="Queued files can be uploaded for indexing or stored-file lifecycle tests."
            disabledDescription="Your current role cannot upload files."
            onDrop={(files) => setQueuedFiles(files)}
            testId="index-retriever-upload-file-drop-zone"
          />
          <div className="text-sm text-muted-foreground">
            {queuedFiles.length > 0 ? `Selected: ${queuedFiles.map((file) => file.name).join(", ")}` : "No files selected."}
          </div>
          <Button onClick={() => void runUpload()} disabled={queuedFiles.length === 0 || !canIngest}>
            Upload And Index File
          </Button>
          <Button variant="secondary" onClick={() => void runStoredUpload()} disabled={queuedFiles.length === 0 || !canIngest}>
            Upload Stored File
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Stored file lifecycle</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex justify-end">
            <Button variant="secondary" size="sm" onClick={() => void refreshStoredFiles()}>
              Refresh Files
            </Button>
          </div>
          <FileBrowser
            folders={storedFileBrowserFolders}
            files={storedFileBrowserFiles}
            currentPath="/stored-files"
            rootLabel="stored"
            filesLabel="Stored files"
            emptyMessage="No stored files."
            readOnly={!canManageFiles}
            statusMessage={`${storedFiles.length} stored files`}
            onNavigate={() => undefined}
            onRefresh={refreshStoredFiles}
            onOpen={(path) => {
              const row = storedFileByPath.get(path);
              if (row) void viewStoredFile(row.file_id);
            }}
            onDownload={(path) => {
              const row = storedFileByPath.get(path);
              if (row) void downloadStoredFile(row.file_id);
            }}
            onDelete={canManageFiles ? (path) => {
              const row = storedFileByPath.get(path);
              if (row) void deleteStoredFile(row.file_id);
            } : undefined}
            deleteConfirmation={{
              enabled: true,
              title: "Delete stored file",
              description: "Permanently delete this stored file from Index Retriever storage.",
              confirmLabel: "Delete file",
            }}
            testId="index-retriever-stored-file-browser"
          />
          <DataTable
            tableId="stored-file-lifecycle-table"
            ariaLabel="stored file lifecycle"
            rows={storedFiles}
            getRowId={(row) => row.file_id}
            columns={storedFileColumns}
            emptyMessage="No stored files."
            pageSize={10}
            columnPickerEnabled={true}
          />
          <JsonExplorer title="file result" data={storedFileResult ?? {}} defaultExpanded />
        </CardContent>
      </Card>

      <ConfirmDialog
        open={Boolean(deleteFileTarget)}
        onOpenChange={(open) => {
          if (!open) setDeleteFileTarget(null);
        }}
        title="Delete stored file"
        description="Permanently delete this stored file from Index Retriever storage."
        targetName={deleteFileTarget?.filename ?? deleteFileTarget?.file_id}
        confirmLabel="Delete file"
        confirmVariant="destructive"
        onConfirm={() => {
          const target = deleteFileTarget;
          setDeleteFileTarget(null);
          if (target) void deleteStoredFile(target.file_id);
        }}
      />

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Search index</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <SearchPanel
            queryInputId="search-query"
            queryLabel="Query"
            queryAriaLabel="Query"
            placeholder="Search indexed content"
            loading={searchLoading}
            filters={[
              { name: "top_k", label: "Top K", type: "text", defaultValue: topK },
            ]}
            onSearch={(nextQuery, filters) => {
              const nextTopK = typeof filters.top_k === "string" ? filters.top_k : topK;
              setQuery(nextQuery);
              setTopK(nextTopK);
              void runSearch(nextQuery, nextTopK);
            }}
            results={(
              <div className="space-y-3">
                <div className="flex justify-end">
                  <Button variant="secondary" size="sm" onClick={() => void runExplain()} disabled={!query.trim()}>
                    Explain Search
                  </Button>
                </div>
                <DataTable
                  tableId="search-results-table"
                  ariaLabel="search results table"
                  rows={searchRows}
                  getRowId={(row) => `${row.doc_id}:${row.chunk_id}`}
                  columns={columns}
                  emptyMessage="No search results yet."
                  page={page}
                  onPageChange={setPage}
                  pageSize={pageSize}
                  onPageSizeChange={setPageSize}
                  selectable={true}
                  bulkActions={[{ label: "Export Selected", action: "export" }]}
                  onBulkAction={(action, ids) => {
                    if (action !== "export") return;
                    const rows = searchRows.filter((row) => ids.includes(`${row.doc_id}:${row.chunk_id}`));
                    const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
                    const url = URL.createObjectURL(blob);
                    const link = document.createElement("a");
                    link.href = url;
                    link.download = "index-retriever-search-results.json";
                    link.click();
                    URL.revokeObjectURL(url);
                    setStatus(`Exported ${rows.length} result(s)`);
                  }}
                  columnPickerEnabled={true}
                />
              </div>
            )}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Retrieve result</h2>
        </CardHeader>
        <CardContent>
          <JsonExplorer title="result" data={retrieveResult ?? {}} defaultExpanded />
        </CardContent>
      </Card>
    </div>
  );
}
