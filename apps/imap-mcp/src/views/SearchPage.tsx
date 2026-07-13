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

// @cloud-dog/app-imap-mcp — Search and retrieve workflows using SearchPanel and shared viewers.

import * as React from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CodeViewer,
  DataTable,
  DocumentViewer,
  EntityDialog,
  JsonExplorer,
  RelativeTime,
  SearchPanel,
  Textarea,
  formatBytes,
  type BulkAction,
  type DataColumn,
  type SearchFilterDef,
  type SearchFilterValues,
} from "@cloud-dog/ui";
import { useImapMcpState } from "../state/AppState";

type MessageRow = Readonly<{
  uid: string;
  subject: string;
  from: string;
  date: string;
  mailbox: string;
  relevance: number;
  raw: Record<string, unknown>;
}>;

type AttachmentRow = Readonly<{
  partId: string;
  filename: string;
  contentType: string;
  size: string;
  raw: Record<string, unknown>;
}>;

function downloadJson(filename: string, value: unknown): void {
  const blob = new Blob([JSON.stringify(value, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function asRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as Record<string, unknown>;
}

export function SearchRetrievePage() {
  const { api } = useImapMcpState();

  const [profileId, setProfileId] = React.useState("operations");
  const [folder, setFolder] = React.useState("INBOX");
  const [mode, setMode] = React.useState("cache");
  const [query, setQuery] = React.useState("ALL");
  const [loading, setLoading] = React.useState(false);

  const [messages, setMessages] = React.useState<MessageRow[]>([]);
  const [selectedUid, setSelectedUid] = React.useState("");
  const [attachments, setAttachments] = React.useState<AttachmentRow[]>([]);

  const [rawMessage, setRawMessage] = React.useState("");
  const [extractedJson, setExtractedJson] = React.useState<Record<string, unknown> | null>(null);
  const [extractedMarkdown, setExtractedMarkdown] = React.useState("");
  const [downloadResult, setDownloadResult] = React.useState<Record<string, unknown> | null>(null);
  const [messageDialogOpen, setMessageDialogOpen] = React.useState(false);
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState("");
  const [messagePage, setMessagePage] = React.useState(1);
  const [messagePageSize, setMessagePageSize] = React.useState(10);
  const [attachmentPage, setAttachmentPage] = React.useState(1);
  const [attachmentPageSize, setAttachmentPageSize] = React.useState(10);
  const [availableProfiles, setAvailableProfiles] = React.useState<string[]>([]);
  const [availableFolders, setAvailableFolders] = React.useState<string[]>([]);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      const r = await api.listProfiles();
      if (!cancelled && r.ok && r.data) {
        setAvailableProfiles(r.data);
        if (r.data.length > 0 && !r.data.includes(profileId)) setProfileId(r.data[0]);
      }
    })();
    return () => { cancelled = true; };
  }, [api]);

  React.useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!profileId) return;
      const r = await api.callTool<{ folders?: string[] }>("mail_list_folders", { profile_id: profileId });
      if (!cancelled && r.ok && r.data?.folders) {
        setAvailableFolders(r.data.folders);
      }
    })();
    return () => { cancelled = true; };
  }, [api, profileId]);

  const selectedMessage = React.useMemo(
    () => messages.find((item) => item.uid === selectedUid) ?? null,
    [messages, selectedUid],
  );

  React.useEffect(() => {
    if (typeof document === "undefined") {
      return;
    }
    document.getElementById("cloud-dog-search-panel-query")?.setAttribute("aria-label", "Query");
  }, []);

  const filters = React.useMemo<readonly SearchFilterDef[]>(
    () => [
      availableProfiles.length > 0
        ? {
            name: "profileId",
            label: "Channel",
            type: "select",
            defaultValue: availableProfiles.includes(profileId) ? profileId : availableProfiles[0],
            options: availableProfiles.map((p) => ({ label: p, value: p })),
          }
        : { name: "profileId", label: "Channel", type: "text", defaultValue: profileId, placeholder: "operations" },
      availableFolders.length > 0
        ? {
            name: "folder",
            label: "Folder",
            type: "select",
            defaultValue: availableFolders.includes(folder) ? folder : availableFolders[0],
            options: availableFolders.map((f) => ({ label: f, value: f })),
          }
        : { name: "folder", label: "Folder", type: "text", defaultValue: folder, placeholder: "INBOX" },
      {
        name: "mode",
        label: "Mode",
        type: "select",
        defaultValue: "imap",
        options: [
          { label: "imap (live IMAP fetch)", value: "imap" },
          { label: "cache (local search ledger)", value: "cache" },
          { label: "vector (similarity)", value: "vector" },
          { label: "hybrid (cache+vector)", value: "hybrid" },
        ],
      },
      {
        // IMAP-368: configurable result limit (default 200).
        name: "limit",
        label: "Limit",
        type: "select",
        defaultValue: "200",
        options: [
          { label: "50", value: "50" },
          { label: "100", value: "100" },
          { label: "200 (default)", value: "200" },
          { label: "500", value: "500" },
          { label: "1000", value: "1000" },
        ],
      },
    ],
    [availableProfiles, availableFolders, profileId, folder],
  );

  const search = React.useCallback(
    async (nextQuery: string, filterValues: SearchFilterValues) => {
      const nextProfileId = String(filterValues.profileId ?? "operations").trim() || "operations";
      const nextFolder = String(filterValues.folder ?? "INBOX").trim() || "INBOX";
      const nextMode = String(filterValues.mode ?? "cache").trim() || "cache";
      const effectiveQuery = nextQuery.trim() || "ALL";

      setProfileId(nextProfileId);
      setFolder(nextFolder);
      setMode(nextMode);
      setQuery(effectiveQuery);
      setError("");
      setStatus("Searching...");
      setLoading(true);

      // IMAP-368: respect operator-chosen limit (default 200).
      const nextLimit = Number(String(filterValues.limit ?? "200")) || 200;
      const runSearch = async (requestedMode: string) =>
        api.callTool<{ messages?: unknown[] }>("mail_search", {
          profile_id: nextProfileId,
          mode: requestedMode,
          query: effectiveQuery,
          filters: { folder: nextFolder },
          limit: nextLimit,
        });

      let effectiveMode = nextMode;
      let result = await runSearch(effectiveMode);
      if (
        (!result.ok || !result.data) &&
        effectiveMode === "imap" &&
        /credentials are not configured/i.test(result.errorMessage)
      ) {
        effectiveMode = "cache";
        setMode("cache");
        result = await runSearch(effectiveMode);
      }

      setLoading(false);

      if (!result.ok || !result.data) {
        setStatus("");
        setError(`Search failed (${result.meta.status}) ${result.errorCode}: ${result.errorMessage}`);
        setMessages([]);
        setSelectedUid("");
        setAttachments([]);
        return;
      }

      const rows = (result.data.messages ?? []).map((item) => {
        const row = item as Record<string, unknown>;
        return {
          uid: String(row.uid ?? ""),
          subject: String(row.subject ?? ""),
          from: String(row.from ?? row.sender ?? ""),
          date: String(row.received_at ?? row.date ?? ""),
          mailbox: String(row.mailbox ?? row.folder ?? nextFolder),
          relevance: Number(row.relevance_score ?? row.score ?? 0),
          raw: row,
        } satisfies MessageRow;
      });

      setMessages(rows);
      setSelectedUid("");
      setAttachments([]);
      setRawMessage("");
      setExtractedJson(null);
      setExtractedMarkdown("");
      setDownloadResult(null);
      setStatus(
        effectiveMode === nextMode
          ? `Found ${rows.length} messages.`
          : `Found ${rows.length} messages using ${effectiveMode} mode.`
      );
    },
    [api],
  );

  const getMessage = React.useCallback(async () => {
    if (!selectedUid) return;
    setError("");
    const result = await api.callTool<{ raw_eml?: string }>("mail_get_message", {
      profile_id: profileId.trim(),
      uid: selectedUid,
      folder,
    });
    if (!result.ok || !result.data) {
      setError(`Get message failed (${result.meta.status}) ${result.errorMessage}`);
      return;
    }
    setRawMessage(String(result.data.raw_eml ?? ""));
    setStatus(`Fetched message UID ${selectedUid}.`);
  }, [api, folder, profileId, selectedUid]);

  const extractMessage = React.useCallback(async () => {
    if (!selectedUid) return;
    setError("");
    const result = await api.callTool<{ json?: unknown; markdown?: string }>("mail_extract_message", {
      profile_id: profileId.trim(),
      uid: selectedUid,
      folder,
      format: "both",
    });
    if (!result.ok || !result.data) {
      setError(`Extract failed (${result.meta.status}) ${result.errorMessage}`);
      return;
    }
    setExtractedJson(asRecord(result.data.json));
    setExtractedMarkdown(String(result.data.markdown ?? ""));
    setStatus(`Extracted message UID ${selectedUid}.`);
  }, [api, folder, profileId, selectedUid]);

  const listAttachments = React.useCallback(async () => {
    if (!selectedUid) return;
    setError("");
    const result = await api.callTool<{ attachments?: unknown[] }>("mail_list_attachments", {
      profile_id: profileId.trim(),
      uid: selectedUid,
      folder,
    });
    if (!result.ok || !result.data) {
      setError(`List attachments failed (${result.meta.status}) ${result.errorMessage}`);
      return;
    }
    const rows = (result.data.attachments ?? []).map((item) => {
      const row = item as Record<string, unknown>;
      return {
        partId: String(row.part_id ?? ""),
        filename: String(row.filename ?? ""),
        contentType: String(row.content_type ?? ""),
        size: String(row.size ?? row.size_bytes ?? ""),
        raw: row,
      } satisfies AttachmentRow;
    });
    setAttachments(rows);
    setStatus(`Found ${rows.length} attachments for UID ${selectedUid}.`);
  }, [api, folder, profileId, selectedUid]);

  const downloadAttachment = React.useCallback(
    async (partId: string) => {
      if (!selectedUid || !partId) {
        setError("No attachment is available to download.");
        return;
      }
      setError("");
      const result = await api.callTool<Record<string, unknown>>("mail_download_attachment", {
        profile_id: profileId.trim(),
        uid: selectedUid,
        part_id: partId,
        folder,
      });
      if (!result.ok || !result.data) {
        setError(`Download failed (${result.meta.status}) ${result.errorMessage}`);
        return;
      }
      setDownloadResult(result.data);
      setStatus(`Downloaded attachment part ${partId} for UID ${selectedUid}.`);
    },
    [api, folder, profileId, selectedUid],
  );

  const openMessageDialog = React.useCallback(
    async (uid: string) => {
      setSelectedUid(uid);
      setMessageDialogOpen(true);
      setRawMessage("");
      setExtractedJson(null);
      setExtractedMarkdown("");
      setAttachments([]);
      setDownloadResult(null);
      setError("");
      const [msgResult, extractResult, attachResult] = await Promise.all([
        api.callTool<{ raw_eml?: string }>("mail_get_message", { profile_id: profileId.trim(), uid, folder }),
        api.callTool<{ json?: unknown; markdown?: string }>("mail_extract_message", {
          profile_id: profileId.trim(),
          uid,
          folder,
          format: "both",
        }),
        api.callTool<{ attachments?: unknown[] }>("mail_list_attachments", {
          profile_id: profileId.trim(),
          uid,
          folder,
        }),
      ]);
      if (msgResult.ok && msgResult.data) setRawMessage(String(msgResult.data.raw_eml ?? ""));
      if (extractResult.ok && extractResult.data) {
        setExtractedJson(asRecord(extractResult.data.json));
        setExtractedMarkdown(String(extractResult.data.markdown ?? ""));
      }
      if (attachResult.ok && attachResult.data) {
        const rows = (attachResult.data.attachments ?? []).map((item) => {
          const row = item as Record<string, unknown>;
          return {
            partId: String(row.part_id ?? ""),
            filename: String(row.filename ?? ""),
            contentType: String(row.content_type ?? ""),
            size: String(row.size ?? row.size_bytes ?? ""),
            raw: row,
          } satisfies AttachmentRow;
        });
        setAttachments(rows);
      }
      setStatus(`Loaded message UID ${uid}.`);
    },
    [api, folder, profileId],
  );

  const downloadFirstAttachment = React.useCallback(async () => {
    const partId = attachments[0]?.partId;
    if (!selectedUid || !partId) {
      setError("No attachment is available to download.");
      return;
    }
    setError("");
    const result = await api.callTool<Record<string, unknown>>("mail_download_attachment", {
      profile_id: profileId.trim(),
      uid: selectedUid,
      part_id: partId,
      folder,
    });
    if (!result.ok || !result.data) {
      setError(`Download failed (${result.meta.status}) ${result.errorMessage}`);
      return;
    }
    setDownloadResult(result.data);
    setStatus(`Downloaded attachment part ${partId} for UID ${selectedUid}.`);
  }, [api, attachments, folder, profileId, selectedUid]);

  const messageColumns = React.useMemo<DataColumn<MessageRow>[]>(
    () => [
      {
        id: "subject",
        header: "Subject",
        cell: (row) => row.subject || "N/A",
        sortable: true,
        sortValue: (row) => row.subject,
      },
      {
        id: "from",
        header: "From",
        cell: (row) => row.from || "N/A",
        sortable: true,
        sortValue: (row) => row.from,
      },
      {
        id: "date",
        header: "Date",
        cell: (row) => (row.date ? <RelativeTime timestamp={row.date} /> : "N/A"),
        sortable: true,
        sortValue: (row) => row.date,
      },
      { id: "mailbox", header: "Mailbox", cell: (row) => row.mailbox || "N/A" },
      {
        // IMAP-367: size from raw.
        id: "size",
        header: "Size",
        cell: (row) => {
          const sz = (row.raw as Record<string, unknown>)?.size_bytes ?? (row.raw as Record<string, unknown>)?.size;
          return typeof sz === "number" ? <span className="font-mono text-xs">{formatBytes(sz)}</span> : <span className="text-xs text-muted-foreground">—</span>;
        },
        sortable: true,
        sortValue: (row) => Number((row.raw as Record<string, unknown>)?.size_bytes ?? 0),
      },
      {
        // IMAP-367: MIME type indicator.
        id: "contentType",
        header: "Type",
        cell: (row) => {
          const ct = String((row.raw as Record<string, unknown>)?.content_type ?? "");
          if (!ct) return <span className="text-xs text-muted-foreground">—</span>;
          // Compact: text/plain → "text", multipart/mixed → "multipart", text/html → "html"
          const compact = ct.includes("html") ? "html" : ct.includes("multipart") ? "multipart" : ct.split("/")[0];
          return <span className="font-mono text-xs">{compact}</span>;
        },
      },
      {
        // IMAP-367: attachment indicator.
        id: "attachments",
        header: "📎",
        cell: (row) => {
          const n = Array.isArray((row.raw as Record<string, unknown>)?.attachments)
            ? ((row.raw as Record<string, unknown>).attachments as unknown[]).length
            : Number((row.raw as Record<string, unknown>)?.attachment_count ?? 0);
          return n > 0 ? <span className="text-xs">📎 {n}</span> : <span className="text-xs text-muted-foreground">—</span>;
        },
        sortable: true,
        sortValue: (row) => {
          const att = (row.raw as Record<string, unknown>)?.attachments;
          return Array.isArray(att) ? att.length : Number((row.raw as Record<string, unknown>)?.attachment_count ?? 0);
        },
      },
      {
        // IMAP-362: live/cached indicator from row.raw.mode_used or per-row cached flag.
        id: "source",
        header: "Source",
        cell: (row) => {
          const raw = row.raw as Record<string, unknown>;
          const cached = raw.cached === true || raw.source === "cache";
          return <span className={`text-xs ${cached ? "text-muted-foreground" : "text-emerald-700"}`}>{cached ? "cached" : "live"}</span>;
        },
      },
      {
        id: "relevance",
        header: "Relevance",
        cell: (row) => String(row.relevance),
        sortable: true,
        sortValue: (row) => row.relevance,
      },
      {
        id: "select",
        header: "Action",
        cell: (row) => (
          <div className="flex gap-1">
            <Button size="sm" variant={row.uid === selectedUid ? "default" : "secondary"} onClick={() => setSelectedUid(row.uid)}>
              {row.uid === selectedUid ? "Selected" : "Select"}
            </Button>
            <Button size="sm" variant="ghost" onClick={() => void openMessageDialog(row.uid)}>
              Open
            </Button>
          </div>
        ),
      },
    ],
    [openMessageDialog, selectedUid],
  );

  const attachmentColumns = React.useMemo<DataColumn<AttachmentRow>[]>(
    () => [
      { id: "partId", header: "Part", cell: (row) => row.partId, sortable: true, sortValue: (row) => row.partId },
      { id: "filename", header: "Filename", cell: (row) => row.filename || "N/A", sortable: true, sortValue: (row) => row.filename },
      { id: "contentType", header: "Type", cell: (row) => row.contentType || "N/A" },
      { id: "size", header: "Size", cell: (row) => row.size || "N/A" },
      {
        id: "download",
        header: "Download",
        cell: (row) => (
          <Button size="sm" variant="secondary" onClick={() => void downloadAttachment(row.partId)}>
            Download
          </Button>
        ),
      },
    ],
    [downloadAttachment],
  );

  const messageBulkActions: BulkAction[] = [{ label: "Export", action: "export" }];
  const attachmentBulkActions: BulkAction[] = [{ label: "Export", action: "export" }];

  const results = (
    <div className="space-y-6">
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      {status ? <p role="status" className="text-sm text-foreground/80">{status}</p> : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Results</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <DataTable
            columns={messageColumns}
            rows={messages}
            getRowId={(row) => row.uid}
            emptyMessage="No messages returned for this query."
            page={messagePage}
            pageSize={messagePageSize}
            onPageChange={setMessagePage}
            onPageSizeChange={setMessagePageSize}
            selectable
            bulkActions={messageBulkActions}
            onBulkAction={(action, ids) => {
              if (action === "export") {
                downloadJson(
                  "imap-search-results.json",
                  messages.filter((row) => ids.includes(row.uid)).map((row) => row.raw),
                );
              }
            }}
            columnPickerEnabled
            tableId="imap-search-results"
          />

          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => void getMessage()} disabled={!selectedUid}>Get Message</Button>
            <Button variant="secondary" onClick={() => void extractMessage()} disabled={!selectedUid}>Extract Message</Button>
            <Button variant="secondary" onClick={() => void listAttachments()} disabled={!selectedUid}>List Attachments</Button>
            <Button variant="secondary" onClick={() => void downloadFirstAttachment()} disabled={!selectedUid || attachments.length === 0}>
              Download First Attachment
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Attachments</h2>
        </CardHeader>
        <CardContent>
          <DataTable
            columns={attachmentColumns}
            rows={attachments}
            getRowId={(row) => row.partId}
            emptyMessage="No attachments listed."
            page={attachmentPage}
            pageSize={attachmentPageSize}
            onPageChange={setAttachmentPage}
            onPageSizeChange={setAttachmentPageSize}
            selectable
            bulkActions={attachmentBulkActions}
            onBulkAction={(action, ids) => {
              if (action === "export") {
                downloadJson(
                  "imap-attachments.json",
                  attachments.filter((row) => ids.includes(row.partId)).map((row) => row.raw),
                );
              }
            }}
            columnPickerEnabled
            tableId="imap-search-attachments"
          />
        </CardContent>
      </Card>

      {selectedMessage ? (
        <JsonExplorer title="Selected Message" data={selectedMessage.raw} defaultExpanded maxDepth={6} />
      ) : null}

      {rawMessage ? (
        <div className="space-y-4">
          <CodeViewer
            title="Raw Message"
            code={rawMessage}
            language="text"
            maxHeight={360}
          />
          <Textarea aria-label="Raw Message" value={rawMessage} readOnly rows={10} className="font-mono text-xs" />
        </div>
      ) : null}

      {extractedJson ? (
        <JsonExplorer title="Extracted JSON" data={extractedJson} defaultExpanded maxDepth={6} />
      ) : null}

      {extractedMarkdown ? (
        <div className="space-y-4">
          <DocumentViewer
            title="Extracted Markdown"
            content={extractedMarkdown}
            format="markdown"
            maxHeight="320px"
            downloadFilename={`${selectedUid || "message"}-extract.md`}
          />
          <Textarea aria-label="Extracted Markdown" value={extractedMarkdown} readOnly rows={10} className="font-mono text-xs" />
        </div>
      ) : null}

      {downloadResult ? (
        <div className="space-y-4">
          <JsonExplorer title="Download Result" data={downloadResult} defaultExpanded maxDepth={6} />
          <Textarea
            aria-label="Download Response"
            value={JSON.stringify(downloadResult, null, 2)}
            readOnly
            rows={10}
            className="font-mono text-xs"
          />
        </div>
      ) : null}
    </div>
  );

  return (
    <div className="space-y-6">
      <header className="space-y-1">
        {/* IMAP-360 / IMAP-361: rename to Search and Retrieve. */}
        <h1 className="text-2xl font-semibold">Search and Retrieve</h1>
        <p className="text-sm text-muted-foreground">
          Targeted retrieval: pick a channel, folder, and mode, then query.
          <strong> Mode:</strong> <code>imap</code> = live IMAP fetch (slow, authoritative);
          <code> cache</code> = local search-ledger (instant, may be stale).
          <strong> Query syntax:</strong> RFC 3501 (e.g. <code>TEXT ukraine SINCE 25-May-2026</code>, <code>FROM "alice@example.com"</code>, <code>ALL</code>).
        </p>
      </header>

      <SearchPanel
        filters={filters}
        placeholder="ALL"
        loading={loading}
        onSearch={(nextQuery, filterValues) => void search(nextQuery, filterValues)}
        results={results}
      />

      <EntityDialog
        open={messageDialogOpen}
        onOpenChange={setMessageDialogOpen}
        title={selectedMessage ? `Message — ${selectedMessage.subject || selectedUid}` : `Message UID ${selectedUid}`}
        body={
          <div className="space-y-4 max-h-[70vh] overflow-y-auto">
            {selectedMessage ? (
              <div className="space-y-1 text-sm">
                <div><span className="text-muted-foreground">From:</span> {selectedMessage.from || "N/A"}</div>
                <div><span className="text-muted-foreground">Subject:</span> {selectedMessage.subject || "N/A"}</div>
                <div><span className="text-muted-foreground">Mailbox:</span> {selectedMessage.mailbox}</div>
                <div><span className="text-muted-foreground">Date:</span> {selectedMessage.date || "N/A"}</div>
              </div>
            ) : null}

            <DataTable
              columns={attachmentColumns}
              rows={attachments}
              getRowId={(row) => row.partId}
              emptyMessage="No attachments on this message."
              tableId="imap-message-dialog-attachments"
              columnPickerEnabled
              selectable
              bulkActions={attachmentBulkActions}
              onBulkAction={(action, ids) => {
                if (action === "export") {
                  downloadJson(
                    "imap-message-attachments.json",
                    attachments.filter((row) => ids.includes(row.partId)).map((row) => row.raw),
                  );
                }
              }}
            />

            {extractedMarkdown ? (
              <DocumentViewer
                title="Message body (markdown)"
                content={extractedMarkdown}
                format="markdown"
                maxHeight="320px"
                downloadFilename={`${selectedUid || "message"}-body.md`}
              />
            ) : null}

            {extractedJson ? (
              <JsonExplorer title="Extracted JSON" data={extractedJson} defaultExpanded={false} maxDepth={5} />
            ) : null}

            {rawMessage ? (
              <CodeViewer title="Raw RFC822" code={rawMessage} language="text" maxHeight={300} />
            ) : null}
          </div>
        }
      />
    </div>
  );
}
