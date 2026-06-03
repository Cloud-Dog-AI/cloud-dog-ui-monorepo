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

// @cloud-dog/app-imap-mcp — Mailbox workspace using shared folder, message, and viewer patterns.

import * as React from "react";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  Checkbox,
  CodeViewer,
  DataTable,
  DocumentViewer,
  FolderTree,
  Input,
  JsonExplorer,
  Label,
  MessageList,
  Select,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  type DataColumn,
  type FolderNode,
  type MessageBulkAction,
  type MessageItem,
} from "@cloud-dog/ui";
import type { JsonRecord } from "../lib/types";
import { useImapMcpState } from "../state/AppState";

type MutationGateState = Readonly<{
  allowSetSeen: boolean;
  allowMoveDuplicates: boolean;
  allowMoveMessages: boolean;
  allowDeleteMessages: boolean;
}>;

type WorkspaceMessageRow = Readonly<{
  uid: string;
  subject: string;
  sender: string;
  preview: string;
  timestamp: string;
  mailbox: string;
  status: string;
  unread: boolean;
  attachmentCount: number;
  raw: JsonRecord;
}>;

type AttachmentRow = Readonly<{
  partId: string;
  filename: string;
  contentType: string;
  size: string;
  raw: JsonRecord;
}>;

type MailboxFolderRow = Readonly<{
  name: string;
  delimiter: string;
  specialUse: string[];
  attributes: string[];
  source: "imap" | "config";
}>;

type ProfileOption = Readonly<{
  profileId: string;
  folders: MailboxFolderRow[];
  raw: JsonRecord;
}>;

const MUTATION_GATE_STORAGE_KEY = "imap-mcp.mutation-gates";
const DEFAULT_FOLDERS = ["INBOX", "Archive", "Sent", "Trash"];
const DEFAULT_FOLDER_ROWS: MailboxFolderRow[] = DEFAULT_FOLDERS.map((name) => ({
  name,
  delimiter: "/",
  specialUse: [],
  attributes: [],
  source: "config",
}));

const DEFAULT_GATES: MutationGateState = {
  allowSetSeen: true,
  allowMoveDuplicates: true,
  allowMoveMessages: true,
  allowDeleteMessages: true,
};

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  return value as JsonRecord;
}

function asStringList(value: unknown): string[] {
  return Array.isArray(value)
    ? value.map((item) => String(item ?? "").trim()).filter((item) => item.length > 0)
    : [];
}

function loadMutationGates(): MutationGateState {
  try {
    const raw = window.localStorage.getItem(MUTATION_GATE_STORAGE_KEY);
    if (!raw) return DEFAULT_GATES;
    const data = JSON.parse(raw) as Partial<MutationGateState>;
    return {
      allowSetSeen: data.allowSetSeen ?? DEFAULT_GATES.allowSetSeen,
      allowMoveDuplicates: data.allowMoveDuplicates ?? DEFAULT_GATES.allowMoveDuplicates,
      allowMoveMessages: data.allowMoveMessages ?? DEFAULT_GATES.allowMoveMessages,
      allowDeleteMessages: data.allowDeleteMessages ?? DEFAULT_GATES.allowDeleteMessages,
    };
  } catch {
    return DEFAULT_GATES;
  }
}

function saveMutationGates(value: MutationGateState): void {
  try {
    window.localStorage.setItem(MUTATION_GATE_STORAGE_KEY, JSON.stringify(value));
  } catch {
    // Ignore storage failures.
  }
}

function extractFolders(profile: JsonRecord): MailboxFolderRow[] {
  const sync = asRecord(profile.sync);
  const folderPolicy = asRecord(sync.folder_policy);
  const includeGlobs = asStringList(folderPolicy.include_globs);
  const excludeGlobs = new Set(asStringList(folderPolicy.exclude_globs));
  const folders = [...includeGlobs, ...DEFAULT_FOLDERS]
    .map((item) => item.replace(/\*+/g, "").replace(/^\/+|\/+$/g, "").trim())
    .filter((item) => item.length > 0 && !excludeGlobs.has(item));
  return [...new Set(folders)]
    .sort((left, right) => left.localeCompare(right))
    .map((name) => ({
      name,
      delimiter: "/",
      specialUse: [],
      attributes: [],
      source: "config",
    }));
}

function buildFolderTree(folders: MailboxFolderRow[]): FolderNode[] {
  const root = new Map<string, FolderNode & { childrenMap?: Map<string, FolderNode & { childrenMap?: Map<string, FolderNode> }> }>();

  for (const folder of folders) {
    const fullPath = folder.name.trim();
    const delimiter = folder.delimiter || "/";
    const parts = fullPath.split(delimiter).filter(Boolean);
    let cursor = root;
    let currentPath = "";

    for (const part of parts) {
      currentPath = currentPath ? `${currentPath}${delimiter}${part}` : part;
      const existing = cursor.get(part);
      if (!existing) {
        const created: FolderNode & { childrenMap?: Map<string, FolderNode> } = {
          name: part,
          path: currentPath,
          childrenMap: new Map<string, FolderNode>(),
        };
        cursor.set(part, created);
      }
      const next = cursor.get(part) as FolderNode & { childrenMap?: Map<string, FolderNode> };
      cursor = (next.childrenMap ?? new Map<string, FolderNode>()) as Map<string, FolderNode & { childrenMap?: Map<string, FolderNode> }>;
      next.childrenMap = cursor as unknown as Map<string, FolderNode>;
    }
  }

  const serialise = (
    nodes: Map<string, FolderNode & { childrenMap?: Map<string, FolderNode> }>,
  ): FolderNode[] =>
    [...nodes.values()]
      .sort((left, right) => left.path.localeCompare(right.path))
      .map((node) => ({
        name: node.name,
        path: node.path,
        children: node.childrenMap && node.childrenMap.size > 0 ? serialise(node.childrenMap as Map<string, FolderNode & { childrenMap?: Map<string, FolderNode> }>) : undefined,
      }));

  return serialise(root);
}

function toMessageRow(item: unknown, fallbackMailbox: string): WorkspaceMessageRow {
  const row = asRecord(item);
  const attachments = Array.isArray(row.attachments) ? row.attachments.length : Number(row.attachment_count ?? 0);
  const flags = asStringList(row.flags).map((flag) => flag.toLowerCase());
  return {
    uid: String(row.uid ?? ""),
    subject: String(row.subject ?? "No subject"),
    sender: String(row.from ?? row.sender ?? "Unknown sender"),
    preview: String(row.preview ?? row.snippet ?? row.body_preview ?? "No preview available."),
    timestamp: String(row.received_at ?? row.date ?? row.internal_date ?? ""),
    mailbox: String(row.mailbox ?? row.folder ?? fallbackMailbox),
    status: String(row.status ?? (flags.includes("\\seen") ? "read" : "unread")),
    unread: !flags.includes("\\seen"),
    attachmentCount: Number.isFinite(attachments) ? attachments : 0,
    raw: row,
  };
}

function toMessageItem(row: WorkspaceMessageRow): MessageItem {
  return {
    id: row.uid,
    subject: row.subject,
    sender: row.sender,
    preview: row.preview,
    timestamp: row.timestamp || new Date().toISOString(),
    status: row.status || "available",
    unread: row.unread,
    attachmentCount: row.attachmentCount,
  };
}

function toAttachmentRow(item: unknown): AttachmentRow {
  const row = asRecord(item);
  return {
    partId: String(row.part_id ?? ""),
    filename: String(row.filename ?? ""),
    contentType: String(row.content_type ?? ""),
    size: String(row.size ?? row.size_bytes ?? ""),
    raw: row,
  };
}

function toFolderRow(item: unknown): MailboxFolderRow | null {
  const row = asRecord(item);
  const name = String(row.name ?? "").trim();
  if (!name) {
    return null;
  }
  return {
    name,
    delimiter: String(row.delimiter ?? "/") || "/",
    specialUse: asStringList(row.special_use),
    attributes: asStringList(row.attributes),
    source: "imap",
  };
}

function formatMutationResult(status: number, code: string, message: string, requestId: string, correlationId: string): string {
  return `status=${status} code=${code || "-"} message=${message || "-"} request_id=${requestId || "-"} correlation_id=${correlationId || "-"}`;
}

function decodeAttachmentContent(content: string, encoding: string): Uint8Array | string {
  if (encoding === "text") {
    return content;
  }
  const binary = window.atob(content);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

function triggerAttachmentDownload(filename: string, contentType: string, payload: Uint8Array | string): void {
  const blobPayload = typeof payload === "string" ? payload : (() => {
    const buffer = new ArrayBuffer(payload.byteLength);
    new Uint8Array(buffer).set(payload);
    return buffer;
  })();
  const blob = new Blob([blobPayload], { type: contentType || "application/octet-stream" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

export function MailboxWorkspacePage() {
  const { api } = useImapMcpState();
  const autoLoadedProfilesRef = React.useRef<Set<string>>(new Set());

  const [profiles, setProfiles] = React.useState<ProfileOption[]>([]);
  const [selectedProfileId, setSelectedProfileId] = React.useState("");
  const [selectedFolder, setSelectedFolder] = React.useState("INBOX");
  const [query, setQuery] = React.useState("ALL");
  const [destinationFolder, setDestinationFolder] = React.useState("Archive");
  const [gates, setGates] = React.useState<MutationGateState>(() => loadMutationGates());
  const [messages, setMessages] = React.useState<WorkspaceMessageRow[]>([]);
  const [selectedMessageId, setSelectedMessageId] = React.useState("");
  const [messageTab, setMessageTab] = React.useState("summary");
  const [attachments, setAttachments] = React.useState<AttachmentRow[]>([]);
  const [rawMessage, setRawMessage] = React.useState("");
  const [extractedJson, setExtractedJson] = React.useState<JsonRecord | null>(null);
  const [extractedMarkdown, setExtractedMarkdown] = React.useState("");
  const [status, setStatus] = React.useState("Loading channels...");
  const [error, setError] = React.useState("");
  const [loadingFolders, setLoadingFolders] = React.useState(false);
  const [loadingMessages, setLoadingMessages] = React.useState(false);
  const [loadingSelection, setLoadingSelection] = React.useState(false);
  const [downloadingAttachmentPartId, setDownloadingAttachmentPartId] = React.useState("");

  const selectedProfile = React.useMemo(
    () => profiles.find((item) => item.profileId === selectedProfileId) ?? null,
    [profiles, selectedProfileId],
  );
  const selectedMessage = React.useMemo(
    () => messages.find((item) => item.uid === selectedMessageId) ?? null,
    [messages, selectedMessageId],
  );

  const folderNodes = React.useMemo(
    () => buildFolderTree(selectedProfile?.folders ?? DEFAULT_FOLDER_ROWS),
    [selectedProfile],
  );

  const downloadAttachment = React.useCallback(
    async (attachment: AttachmentRow) => {
      if (!selectedProfileId || !selectedFolder || !selectedMessageId || !attachment.partId) {
        setError("Select a message attachment before downloading.");
        return;
      }

      setDownloadingAttachmentPartId(attachment.partId);
      setError("");
      const result = await api.callTool<Record<string, unknown>>("mail_download_attachment", {
        profile_id: selectedProfileId,
        uid: selectedMessageId,
        part_id: attachment.partId,
        folder: selectedFolder,
        filename: attachment.filename || undefined,
      });
      setDownloadingAttachmentPartId("");

      if (!result.ok || !result.data) {
        setError(`Attachment download failed (${result.meta.status}) ${result.errorMessage}`);
        return;
      }

      const filename = String(result.data.filename ?? attachment.filename ?? attachment.partId ?? "attachment.bin");
      const encoding = String(result.data.content_encoding ?? "base64").toLowerCase();
      const content = String(result.data.content ?? "");
      triggerAttachmentDownload(
        filename,
        attachment.contentType || "application/octet-stream",
        decodeAttachmentContent(content, encoding),
      );
      setStatus(`Downloaded attachment ${filename} from UID ${selectedMessageId}.`);
    },
    [api, selectedFolder, selectedMessageId, selectedProfileId],
  );

  const attachmentColumns = React.useMemo<DataColumn<AttachmentRow>[]>(
    () => [
      { id: "partId", header: "Part", cell: (row) => row.partId || "N/A" },
      { id: "filename", header: "Filename", cell: (row) => row.filename || "N/A" },
      { id: "contentType", header: "Type", cell: (row) => row.contentType || "N/A" },
      { id: "size", header: "Size", cell: (row) => row.size || "N/A" },
      {
        id: "action",
        header: "Action",
        cell: (row) => (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => void downloadAttachment(row)}
            disabled={downloadingAttachmentPartId === row.partId}
          >
            {downloadingAttachmentPartId === row.partId ? "Downloading..." : "Download"}
          </Button>
        ),
      },
    ],
    [downloadAttachment, downloadingAttachmentPartId],
  );

  const setGate = React.useCallback((key: keyof MutationGateState, value: boolean) => {
    setGates((current) => {
      const next = { ...current, [key]: value };
      saveMutationGates(next);
      return next;
    });
  }, []);

  const loadProfiles = React.useCallback(async () => {
    setError("");
    const listed = await api.listProfiles();
    if (!listed.ok) {
      setError(`List channels failed (${listed.meta.status}) ${listed.errorMessage}`);
      setStatus("Mailbox workspace is unavailable.");
      return;
    }

    const detailResults = await Promise.all(
      (listed.data ?? []).map(async (profileId) => ({
        profileId,
        detail: await api.getProfile(profileId),
      })),
    );

    const rows = detailResults
      .filter(({ detail }) => detail.ok && detail.data)
      .map(({ profileId, detail }) => ({
        profileId,
        folders: extractFolders(detail.data ?? {}),
        raw: detail.data ?? {},
      }))
      .sort((left, right) => left.profileId.localeCompare(right.profileId));

    setProfiles(rows);
    autoLoadedProfilesRef.current.clear();
    setSelectedProfileId((current) => {
      if (current && rows.some((item) => item.profileId === current)) {
        return current;
      }
      return rows[0]?.profileId ?? "";
    });
    setStatus(rows.length > 0 ? `Loaded ${rows.length} channels.` : "No channels configured.");
  }, [api]);

  const loadLiveFolders = React.useCallback(
    async (profileId: string, fallbackFolders: MailboxFolderRow[]) => {
      if (!profileId) {
        return;
      }
      setLoadingFolders(true);
      const result = await api.callTool<{ folders?: unknown[]; cached?: boolean }>("mail_list_folders", {
        profile_id: profileId,
      });
      setLoadingFolders(false);

      if (!result.ok || !result.data) {
        setProfiles((current) =>
          current.map((item) => (item.profileId === profileId ? { ...item, folders: fallbackFolders } : item)),
        );
        setStatus(
          `Live folder enumeration failed for ${profileId}; using configured fallback folders. ${result.errorMessage}`,
        );
        return;
      }

      const liveFolders = (result.data.folders ?? [])
        .map((item) => toFolderRow(item))
        .filter((item): item is MailboxFolderRow => item !== null);
      const nextFolders = liveFolders.length > 0 ? liveFolders : fallbackFolders;
      setProfiles((current) =>
        current.map((item) => (item.profileId === profileId ? { ...item, folders: nextFolders } : item)),
      );
      setStatus(
        `Loaded ${nextFolders.length} live folders for ${profileId}${result.data.cached ? " (cached)." : "."}`,
      );
    },
    [api],
  );

  const loadMessages = React.useCallback(
    async (profileId: string, folder: string, searchQuery: string) => {
      if (!profileId || !folder) {
        setMessages([]);
        setSelectedMessageId("");
        return;
      }

      setLoadingMessages(true);
      setError("");
      const result = await api.callTool<{ messages?: unknown[] }>("mail_search", {
        profile_id: profileId,
        mode: "cache",
        query: searchQuery.trim() || "ALL",
        filters: { folder },
      });
      setLoadingMessages(false);

      if (!result.ok || !result.data) {
        setMessages([]);
        setSelectedMessageId("");
        setStatus("");
        setError(`Search failed (${result.meta.status}) ${result.errorMessage}`);
        return;
      }

      const nextMessages = (result.data.messages ?? []).map((item) => toMessageRow(item, folder));
      setMessages(nextMessages);
      setSelectedMessageId((current) => (current && nextMessages.some((item) => item.uid === current) ? current : nextMessages[0]?.uid ?? ""));
      setStatus(`Loaded ${nextMessages.length} messages from ${folder}.`);
    },
    [api],
  );

  const loadSelectedMessage = React.useCallback(
    async (profileId: string, folder: string, uid: string) => {
      if (!profileId || !folder || !uid) {
        setRawMessage("");
        setAttachments([]);
        return;
      }

      setLoadingSelection(true);
      const [messageResult, attachmentResult] = await Promise.all([
        api.callTool<{ raw_eml?: string }>("mail_get_message", {
          profile_id: profileId,
          uid,
          folder,
        }),
        api.callTool<{ attachments?: unknown[] }>("mail_list_attachments", {
          profile_id: profileId,
          uid,
          folder,
        }),
      ]);
      setLoadingSelection(false);

      if (!messageResult.ok || !messageResult.data) {
        setRawMessage("");
        setError(`Get message failed (${messageResult.meta.status}) ${messageResult.errorMessage}`);
      } else {
        setRawMessage(String(messageResult.data.raw_eml ?? ""));
      }

      if (!attachmentResult.ok || !attachmentResult.data) {
        setAttachments([]);
      } else {
        setAttachments((attachmentResult.data.attachments ?? []).map((item) => toAttachmentRow(item)));
      }
    },
    [api],
  );

  const extractSelectedMessage = React.useCallback(async () => {
    if (!selectedProfileId || !selectedFolder || !selectedMessageId) {
      return;
    }
    setError("");
    const result = await api.callTool<{ json?: unknown; markdown?: string }>("mail_extract_message", {
      profile_id: selectedProfileId,
      uid: selectedMessageId,
      folder: selectedFolder,
      format: "both",
    });
    if (!result.ok || !result.data) {
      setError(`Extract failed (${result.meta.status}) ${result.errorMessage}`);
      return;
    }
    setExtractedJson(asRecord(result.data.json));
    setExtractedMarkdown(String(result.data.markdown ?? ""));
    setStatus(`Extracted message UID ${selectedMessageId}.`);
  }, [api, selectedFolder, selectedMessageId, selectedProfileId]);

  const runBulkAction = React.useCallback(
    async (action: MessageBulkAction, ids: string[]) => {
      if (!selectedProfileId || !selectedFolder || ids.length === 0) {
        return;
      }

      setError("");

      if (action === "mark-read") {
        if (!gates.allowSetSeen) {
          setError("Set Seen is blocked by the local mutation gate.");
          return;
        }
        const result = await api.callTool<Record<string, unknown>>("mail_set_seen", {
          profile_id: selectedProfileId,
          uids: ids,
          folder: selectedFolder,
          seen: true,
        });
        setStatus(formatMutationResult(result.meta.status, result.errorCode, result.errorMessage || "ok", result.meta.requestId, result.meta.correlationId));
      }

      if (action === "archive") {
        if (!gates.allowMoveMessages) {
          setError("Move Messages is blocked by the local mutation gate.");
          return;
        }
        const result = await api.callTool<Record<string, unknown>>("mail_move_messages", {
          profile_id: selectedProfileId,
          folder: selectedFolder,
          destination_folder: destinationFolder.trim() || "Archive",
          uids: ids,
          async_mode: true,
        });
        const moveJobId = (result.data as { job_id?: string } | undefined)?.job_id ?? "";
        setStatus(
          moveJobId
            ? `Queued move job ${moveJobId} — see /jobs for progress`
            : formatMutationResult(result.meta.status, result.errorCode, result.errorMessage || "ok", result.meta.requestId, result.meta.correlationId),
        );
      }

      if (action === "delete") {
        if (!gates.allowDeleteMessages) {
          setError("Delete Messages is blocked by the local mutation gate.");
          return;
        }
        if (!window.confirm(`Delete ${ids.length} message(s) from ${selectedFolder}?`)) {
          return;
        }
        const result = await api.callTool<Record<string, unknown>>("mail_delete_messages", {
          profile_id: selectedProfileId,
          folder: selectedFolder,
          uids: ids,
          async_mode: true,
        });
        const deleteJobId = (result.data as { job_id?: string } | undefined)?.job_id ?? "";
        setStatus(
          deleteJobId
            ? `Queued delete job ${deleteJobId} — see /jobs for progress`
            : formatMutationResult(result.meta.status, result.errorCode, result.errorMessage || "ok", result.meta.requestId, result.meta.correlationId),
        );
      }

      await loadMessages(selectedProfileId, selectedFolder, query);
    },
    [api, destinationFolder, gates.allowDeleteMessages, gates.allowMoveMessages, gates.allowSetSeen, loadMessages, query, selectedFolder, selectedProfileId],
  );

  const runMoveDuplicates = React.useCallback(async () => {
    if (!selectedProfileId) {
      return;
    }
    if (!gates.allowMoveDuplicates) {
      setError("Move Duplicates is blocked by the local mutation gate.");
      return;
    }
    if (!window.confirm(`Move duplicates from ${selectedFolder} to ${destinationFolder.trim() || "Archive"}?`)) {
      return;
    }
    const result = await api.callTool<Record<string, unknown>>("mail_move_duplicates_since_last_search", {
      profile_id: selectedProfileId,
      query: query.trim() || "ALL",
      destination_folder: destinationFolder.trim() || "Archive",
      strategy: "heuristic",
      policy: "newest",
      dry_run: false,
    });
    setStatus(formatMutationResult(result.meta.status, result.errorCode, result.errorMessage || "ok", result.meta.requestId, result.meta.correlationId));
    await loadMessages(selectedProfileId, selectedFolder, query);
  }, [api, destinationFolder, gates.allowMoveDuplicates, loadMessages, query, selectedFolder, selectedProfileId]);

  React.useEffect(() => {
    void loadProfiles();
  }, [loadProfiles]);

  React.useEffect(() => {
    if (!selectedProfile) {
      return;
    }
    const needsLiveFolders = selectedProfile.folders.some((folder) => folder.source !== "imap");
    if (needsLiveFolders && !autoLoadedProfilesRef.current.has(selectedProfile.profileId)) {
      autoLoadedProfilesRef.current.add(selectedProfile.profileId);
      void loadLiveFolders(selectedProfile.profileId, selectedProfile.folders);
    }
  }, [loadLiveFolders, selectedProfile]);

  React.useEffect(() => {
    if (!selectedProfile) {
      return;
    }
    setSelectedFolder((current) => {
      if (current && selectedProfile.folders.some((folder) => folder.name === current)) {
        return current;
      }
      return selectedProfile.folders[0]?.name ?? DEFAULT_FOLDERS[0];
    });
  }, [selectedProfile]);

  React.useEffect(() => {
    if (!selectedProfileId || !selectedFolder) {
      return;
    }
    void loadMessages(selectedProfileId, selectedFolder, query);
  }, [loadMessages, query, selectedFolder, selectedProfileId]);

  React.useEffect(() => {
    setExtractedJson(null);
    setExtractedMarkdown("");
    if (!selectedProfileId || !selectedFolder || !selectedMessageId) {
      setRawMessage("");
      setAttachments([]);
      return;
    }
    void loadSelectedMessage(selectedProfileId, selectedFolder, selectedMessageId);
  }, [loadSelectedMessage, selectedFolder, selectedMessageId, selectedProfileId]);

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold">Mailbox Workspace</h1>
          <Badge variant="secondary">PS-82</Badge>
        </div>
        <p className="text-sm text-muted-foreground">
          Folder-tree-driven browsing with per-message mutations (set seen, move, delete, duplicate sweep).
          For targeted search + attachment retrieval see <a href="/search-retrieve" className="text-primary underline-offset-4 hover:underline">Mailbox</a>.
        </p>
      </header>

      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}
      <p role="status" className="text-sm text-foreground/80">{status}</p>

      {profiles.length === 0 ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">No Channels Configured</h2>
          </CardHeader>
          <CardContent>
            <p className="text-sm text-muted-foreground">
              Create an IMAP channel in the Channels page before using the mailbox workspace.
            </p>
          </CardContent>
        </Card>
      ) : (<>
        {/* IMAP-060 / IMAP-061 / IMAP-065: single top-bar with channel +
            folder summary + query + refresh action so the operator can
            change scope from one row without scanning the left column. */}
        <Card>
          <CardContent className="flex flex-wrap items-end gap-3 p-4">
            <div className="space-y-1 min-w-[10rem]">
              <Label htmlFor="mailbox-profile-top">Channel</Label>
              <Select
                id="mailbox-profile-top"
                value={selectedProfileId}
                onChange={(event) => setSelectedProfileId(event.target.value)}
              >
                {profiles.map((profile) => (
                  <option key={profile.profileId} value={profile.profileId}>
                    {profile.profileId}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1 min-w-[10rem]">
              <Label>Folder (pick in tree below)</Label>
              <div className="rounded-md border bg-muted/30 px-3 py-2 text-sm font-mono">
                {selectedFolder || "INBOX"}
              </div>
            </div>
            <div className="space-y-1 flex-1 min-w-[14rem]">
              <Label htmlFor="mailbox-query-top">Query</Label>
              <Input
                id="mailbox-query-top"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="ALL"
              />
            </div>
            <div className="space-y-1 min-w-[10rem]">
              <Label htmlFor="mailbox-destination-top">Move/Archive to</Label>
              <Input
                id="mailbox-destination-top"
                value={destinationFolder}
                onChange={(event) => setDestinationFolder(event.target.value)}
              />
            </div>
            <Button onClick={() => void loadMessages(selectedProfileId, selectedFolder, query)}>
              {loadingMessages ? "Refreshing…" : "Refresh"}
            </Button>
            <Button
              variant="secondary"
              onClick={() => void loadLiveFolders(selectedProfileId, selectedProfile?.folders ?? DEFAULT_FOLDER_ROWS)}
              disabled={!selectedProfileId || loadingFolders}
            >
              Reload folders
            </Button>
          </CardContent>
        </Card>

        <div className="grid gap-6 xl:grid-cols-[18rem_minmax(0,1fr)_28rem]">
          <div className="space-y-6">

            <Card>
              <CardHeader>
                <h2 className="text-lg font-semibold">Folders</h2>
              </CardHeader>
              <CardContent>
                <FolderTree
                  folders={folderNodes}
                  selectedPath={selectedFolder}
                  onSelect={(path) => setSelectedFolder(path)}
                  className="max-h-[28rem]"
                />
              </CardContent>
            </Card>

            {/* IMAP-064: Mutation Gates panel removed. Mutation buttons in
                the message viewer's Mutations tab still respect the gate
                values, which default to allowed; per-mutation confirm
                dialogs already prevent accidental destructive actions. */}
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">Message List</h2>
                  <Badge variant="secondary">{selectedFolder}</Badge>
                  <Badge variant="secondary">{selectedProfileId}</Badge>
                </div>
              </CardHeader>
              <CardContent className="p-0">
                <MessageList
                  messages={messages.map((row) => toMessageItem(row))}
                  selectedId={selectedMessageId}
                  onSelect={setSelectedMessageId}
                  onBulkAction={(action, ids) => void runBulkAction(action, ids)}
                  loading={loadingMessages}
                />
              </CardContent>
            </Card>
          </div>

          <div className="space-y-6">
            <Card>
              <CardHeader>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-lg font-semibold">Message Viewer</h2>
                  {selectedMessage ? <Badge>{selectedMessage.uid}</Badge> : null}
                  {loadingSelection ? <Badge variant="secondary">loading</Badge> : null}
                </div>
              </CardHeader>
              <CardContent>
                {selectedMessage ? (
                  <Tabs value={messageTab} onValueChange={setMessageTab}>
                    <TabsList className="flex flex-wrap">
                      <TabsTrigger value="summary">Summary</TabsTrigger>
                      <TabsTrigger value="raw">Raw</TabsTrigger>
                      <TabsTrigger value="extract">Extract</TabsTrigger>
                      <TabsTrigger value="attachments">Attachments</TabsTrigger>
                      <TabsTrigger value="mutations">Mutations</TabsTrigger>
                    </TabsList>

                    <TabsContent value="summary">
                      <div className="space-y-4">
                        <JsonExplorer
                          title="Selected Message"
                          data={selectedMessage.raw}
                          defaultExpanded
                          maxDepth={6}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="raw">
                      <div className="space-y-4">
                        <CodeViewer
                          title="Raw Message"
                          language="text"
                          code={rawMessage || "No raw message loaded."}
                          maxHeight={360}
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="extract">
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          <Button onClick={() => void extractSelectedMessage()}>Extract Message</Button>
                        </div>
                        {extractedJson ? (
                          <JsonExplorer
                            title="Extracted JSON"
                            data={extractedJson}
                            defaultExpanded
                            maxDepth={6}
                          />
                        ) : null}
                        {extractedMarkdown ? (
                          <DocumentViewer
                            title="Extracted Markdown"
                            content={extractedMarkdown}
                            format="markdown"
                            maxHeight="320px"
                            downloadFilename={`${selectedMessage.uid}-extract.md`}
                          />
                        ) : null}
                        {!extractedJson && !extractedMarkdown ? (
                          <p className="text-sm text-muted-foreground">
                            Run extraction to view structured and markdown renditions for the selected message.
                          </p>
                        ) : null}
                      </div>
                    </TabsContent>

                    <TabsContent value="attachments">
                      <div className="space-y-4">
                        <DataTable
                          tableId="imap-mailbox-workspace-attachments"
                          columns={attachmentColumns}
                          rows={attachments}
                          getRowId={(row) => row.partId || row.filename}
                          emptyMessage="No attachments listed for the selected message."
                        />
                      </div>
                    </TabsContent>

                    <TabsContent value="mutations">
                      <div className="space-y-4">
                        <div className="flex flex-wrap gap-2">
                          <Button
                            variant="secondary"
                            disabled={!gates.allowSetSeen}
                            onClick={() => void runBulkAction("mark-read", [selectedMessage.uid])}
                          >
                            Mark Read
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={!gates.allowMoveMessages}
                            onClick={() => void runBulkAction("archive", [selectedMessage.uid])}
                          >
                            Archive to {destinationFolder.trim() || "Archive"}
                          </Button>
                          <Button
                            variant="destructive"
                            disabled={!gates.allowDeleteMessages}
                            onClick={() => void runBulkAction("delete", [selectedMessage.uid])}
                          >
                            Delete Message
                          </Button>
                          <Button
                            variant="secondary"
                            disabled={!gates.allowMoveDuplicates}
                            onClick={() => void runMoveDuplicates()}
                          >
                            Move Duplicates
                          </Button>
                        </div>
                      </div>
                    </TabsContent>
                  </Tabs>
                ) : (
                  <p className="text-sm text-muted-foreground">
                    Select a message from the list to inspect its content and attachments.
                  </p>
                )}
              </CardContent>
            </Card>

            {/* IMAP-063: Channel-configuration sub-form removed (duplicated
                /profiles). Replaced with a button that takes the operator
                straight to the Channels page with this channel pre-selected. */}
            {selectedProfile ? (
              <div className="rounded-md border bg-muted/30 p-3 text-sm">
                <div className="mb-2 text-muted-foreground">
                  Channel <span className="font-mono">{selectedProfile.profileId}</span> configuration is managed on the Channels page.
                </div>
                <a
                  href={`/profiles?channelId=${encodeURIComponent(selectedProfile.profileId)}`}
                  className="inline-flex items-center rounded-md border bg-background px-3 py-1 text-sm font-medium hover:bg-accent"
                >
                  Configure this channel →
                </a>
              </div>
            ) : null}
          </div>
        </div>
      </>)}
    </div>
  );
}

function splitUids(value: string): string[] {
  return value.split(",").map((item) => item.trim()).filter((item) => item.length > 0);
}

function confirmDestructive(action: string, scope: string): boolean {
  return window.confirm(`Confirm ${action}?\n\nAffected scope:\n${scope}`);
}

