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

// @cloud-dog/app-chat-client — Core chat page with inline file handling.

import * as React from "react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  ChatTimeline,
  Checkbox,
  DataTable,
  FileArtifactCard,
  FileDropZone,
  RelativeTime,
  Spinner,
  Textarea,
  ToolCallPanel,
} from "@cloud-dog/ui";
import type { DataColumn } from "@cloud-dog/ui";
import type { FileArtifactPreview, TimelineMessage } from "@cloud-dog/ui";
import { useRightDrawer } from "@cloud-dog/shell";
import { useAuth } from "@cloud-dog/auth";
import type { ChatApi } from "../lib/api";
import {
  buildReferencePath,
  classifyReference,
  deriveFileIntakeGating,
  isFileArtifactToolResult,
  resolveFileIntake,
} from "../lib/file-intake";
import { isReadOnlyUser } from "../lib/rbac";
import { useAppState } from "../state/AppState";
import { mediaResultFromHit } from "../lib/media";
import type { MediaResult } from "../lib/media";
import { MediaResultList } from "../components/MediaInline";
import type { ChatProfileRecord, FileIntakeSettings, LlmTestResult, McpServer, SessionSummary, ToolExecutionResult, TranscriptEvent } from "../lib/types";

type FileArtifactKind = "attachment" | "upload" | "download" | "reference";

type TimelineFileArtifact = Readonly<{
  id: string;
  kind: FileArtifactKind;
  path: string;
  byteSize?: number;
  serverIndex?: number | null;
  statusLabel?: string;
  description?: string;
}>;

type ChatTimelineMessage = TimelineMessage &
  Readonly<{
    artifacts?: TimelineFileArtifact[];
  }>;

type PendingAttachment = Readonly<{
  id: string;
  file: File;
  path: string;
  byteSize: number;
  serverIndex: number | null;
}>;

type UploadedAttachment = Readonly<{
  id: string;
  path: string;
  byteSize: number;
  serverIndex: number | null;
}>;

type PendingReference = Readonly<{
  id: string;
  reference: string;
  mode: "path" | "url";
  path: string;
  serverIndex: number | null;
}>;

type ParsedTranscript = Readonly<{
  messages: ChatTimelineMessage[];
  toolResults: ToolExecutionResult[];
}>;

type PreviewState =
  | Readonly<{ status: "idle" }>
  | Readonly<{ status: "loading" }>
  | Readonly<{ status: "ready"; preview: FileArtifactPreview }>
  | Readonly<{ status: "error"; message: string }>;

const IMAGE_EXTENSIONS = new Set(["png", "jpg", "jpeg", "gif", "webp", "svg"]);
const TEXT_EXTENSIONS = new Set([
  "txt",
  "md",
  "json",
  "csv",
  "log",
  "yaml",
  "yml",
  "xml",
  "html",
  "css",
  "js",
  "jsx",
  "ts",
  "tsx",
  "py",
  "sh",
]);

function fileNameFromPath(path: string): string {
  return path.split("/").filter(Boolean).pop() || "file";
}

function fileExtension(path: string): string {
  const name = fileNameFromPath(path);
  const index = name.lastIndexOf(".");
  if (index < 0) return "";
  return name.slice(index + 1).toLowerCase();
}

function isPreviewablePath(path: string): boolean {
  const extension = fileExtension(path);
  return IMAGE_EXTENSIONS.has(extension) || TEXT_EXTENSIONS.has(extension);
}

function isTextContentType(contentType: string): boolean {
  return (
    contentType.startsWith("text/") ||
    contentType.includes("json") ||
    contentType.includes("xml") ||
    contentType.includes("yaml")
  );
}

function buildAttachmentPath(file: File, index: number): string {
  const cleanedName =
    file.name
      .trim()
      .replace(/[^A-Za-z0-9._-]+/g, "-")
      .replace(/^-+|-+$/g, "") || `attachment-${index + 1}`;
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  return `uploads/${stamp}-${index + 1}-${cleanedName}`;
}

function isFileServer(server: McpServer): boolean {
  return server.name.toLowerCase().includes("file");
}

function resolveFileServerIndex(mcpServers: McpServer[], selectedIndices: number[]): number | null {
  const selectedFileServer = mcpServers.find(
    (server) => selectedIndices.includes(server.index) && isFileServer(server)
  );
  if (selectedFileServer) return selectedFileServer.index;
  return mcpServers.find(isFileServer)?.index ?? null;
}

function sessionTitle(session: { id: string; metadata?: Record<string, unknown> }): string {
  return String(session.metadata?.title ?? "Untitled session").trim() || "Untitled session";
}

function sessionProfileId(session: { metadata?: Record<string, unknown> }): string {
  return String(session.metadata?.profile_id ?? "").trim();
}

function sessionLastActivity(session: { created_at: string; metadata?: Record<string, unknown> }): string {
  return String(session.metadata?.last_used_at ?? session.metadata?.updated_at ?? session.created_at);
}

function profileLabel(profiles: ChatProfileRecord[], profileId: string): string {
  if (!profileId) return "All profiles";
  return profiles.find((profile) => profile.profile_id === profileId)?.name ?? profileId;
}

function profileServerIndices(profile: ChatProfileRecord | undefined, servers: McpServer[]): number[] {
  if (!profile) return [];
  const indices: number[] = [];
  for (const binding of profile.mcp_bindings ?? []) {
    const directIndex = Number(binding.index ?? binding.server_index ?? -1);
    if (Number.isInteger(directIndex) && directIndex >= 0) {
      indices.push(directIndex);
      continue;
    }
    const name = String(binding.name ?? "").trim().toLowerCase();
    const baseUrl = String(binding.base_url ?? "").trim().toLowerCase();
    const match = servers.find((server) =>
      (name && server.name.trim().toLowerCase() === name) ||
      (baseUrl && server.base_url.trim().toLowerCase() === baseUrl)
    );
    if (match) indices.push(match.index);
  }
  return Array.from(new Set(indices)).sort((a, b) => a - b);
}

function buildAttachmentPromptText(text: string, attachments: PendingAttachment[]): string {
  if (attachments.length === 0) return text;
  const attachmentList = attachments.map((item) => `- ${item.path}`).join("\n");
  return `${text}\n\nAttached files available through the file external service:\n${attachmentList}`;
}

function extractFileReferences(content: string): string[] {
  const matches = content.match(/\/[A-Za-z0-9._/-]+\.[A-Za-z0-9]{1,10}/g) ?? [];
  return Array.from(new Set(matches.filter((item) => !item.startsWith("//"))));
}

function buildReferencePromptText(text: string, references: PendingReference[]): string {
  if (references.length === 0) return text;
  const refList = references.map((item) =>
    item.mode === "url"
      ? `- ${item.path} (fetched from ${item.reference})`
      : `- ${item.reference} (file reference)`
  ).join("\n");
  return `${text}\n\nFile references provided through the file external service:\n${refList}`;
}

/**
 * Extract any inline-renderable media (image/video/audio/PDF) from a tool
 * result so the conversation thread can render it via the shared @cloud-dog/ui
 * multimodal components (W28F-948 D2). Returns [] for non-media results.
 */
function extractMediaResults(data: Record<string, unknown>, idBase: string): MediaResult[] {
  const result = (data.result ?? data) as Record<string, unknown>;
  const candidates: unknown[] = Array.isArray((result as Record<string, unknown>).hits)
    ? ((result as Record<string, unknown>).hits as unknown[])
    : Array.isArray((result as Record<string, unknown>).media)
      ? ((result as Record<string, unknown>).media as unknown[])
      : [result];
  return candidates
    .map((c, i) => mediaResultFromHit(c, `${idBase}-${i}`))
    .filter((m): m is MediaResult => m !== null);
}

function parseTranscript(events: TranscriptEvent[]): ParsedTranscript {
  const messages: ChatTimelineMessage[] = [];
  const toolResults: ToolExecutionResult[] = [];

  const pendingCalls: Array<{
    key: string;
    serverIndex: number;
    toolName: string;
    arguments: Record<string, unknown>;
    timestamp: string;
  }> = [];

  for (const event of events) {
    if (event.event_type === "user_message") {
      messages.push({
        id: `u-${event.sequence ?? messages.length}`,
        role: "user",
        content: String(event.data?.content ?? ""),
        timestamp: event.timestamp,
      });
      continue;
    }

    if (event.event_type === "assistant_message" || event.event_type === "mcp_direct_response") {
      const content = String(event.data?.content ?? "");
      const references = extractFileReferences(content);
      messages.push({
        id: `a-${event.sequence ?? messages.length}`,
        role: "assistant",
        content,
        timestamp: event.timestamp,
        artifacts: references.map((path, index) => ({
          id: `ref-${event.sequence ?? messages.length}-${index}`,
          kind: "reference",
          path,
          statusLabel: "Referenced",
          description: "This file path was returned in the assistant response.",
        })),
      });
      continue;
    }

    if (event.event_type === "mcp_file_upload_result") {
      const path = String(event.data?.path ?? "").trim();
      if (!path) continue;
      const dryRun = Boolean(event.data?.dry_run);
      messages.push({
        id: `fu-${event.sequence ?? messages.length}`,
        role: "tool",
        content: dryRun
          ? "File upload dry-run completed."
          : "File uploaded to external service storage.",
        timestamp: event.timestamp,
        artifacts: [
          {
            id: `upload-${event.sequence ?? messages.length}`,
            kind: "upload",
            path,
            byteSize:
              event.data?.bytes_written == null ? undefined : Number(event.data.bytes_written ?? 0),
            serverIndex:
              event.data?.server_index == null ? null : Number(event.data.server_index ?? 0),
            statusLabel: dryRun ? "Dry run" : "Stored",
            description: dryRun
              ? "The file proxy validated the request without writing bytes."
              : "Stored through the authenticated chat-session file proxy.",
          },
        ],
      });
      continue;
    }

    if (event.event_type === "mcp_file_download_result") {
      const path = String(event.data?.path ?? "").trim();
      if (!path) continue;
      messages.push({
        id: `fd-${event.sequence ?? messages.length}`,
        role: "tool",
        content: "File download is ready from the chat timeline.",
        timestamp: event.timestamp,
        artifacts: [
          {
            id: `download-${event.sequence ?? messages.length}`,
            kind: "download",
            path,
            byteSize:
              event.data?.byte_size == null ? undefined : Number(event.data.byte_size ?? 0),
            serverIndex:
              event.data?.server_index == null ? null : Number(event.data.server_index ?? 0),
            statusLabel: "Ready",
            description: "Retrieved through the authenticated chat-session file proxy.",
          },
        ],
      });
      continue;
    }

    if (event.event_type === "mcp_tool_call") {
      const serverIndex = Number(event.data?.server_index ?? -1);
      const toolName = String(event.data?.name ?? "").trim();
      const args = (event.data?.arguments ?? {}) as Record<string, unknown>;
      if (serverIndex >= 0 && toolName) {
        pendingCalls.push({
          key: `${serverIndex}:${toolName}`,
          serverIndex,
          toolName,
          arguments: args,
          timestamp: event.timestamp,
        });
      }
      continue;
    }

    if (event.event_type === "mcp_tool_result") {
      const serverIndex = Number(event.data?.server_index ?? -1);
      const toolName = String(event.data?.name ?? "").trim();
      const key = `${serverIndex}:${toolName}`;
      const callIndex = pendingCalls.findIndex((item) => item.key === key);
      const call = callIndex >= 0 ? pendingCalls.splice(callIndex, 1)[0] : null;
      if (!call) continue;

      toolResults.push({
        toolName: call.toolName,
        serverIndex: call.serverIndex,
        arguments: call.arguments,
        result: event.data ?? {},
        timestamp: call.timestamp,
      });

      const artifactPath = isFileArtifactToolResult(event.data ?? {});
      if (artifactPath) {
        const resultObj = (event.data?.result ?? {}) as Record<string, unknown>;
        messages.push({
          id: `ta-${event.sequence ?? messages.length}`,
          role: "tool",
          content: `Tool ${call.toolName} produced a file artifact.`,
          timestamp: event.timestamp,
          artifacts: [
            {
              id: `tool-artifact-${event.sequence ?? messages.length}`,
              kind: "download",
              path: artifactPath,
              byteSize: resultObj.bytes_written != null ? Number(resultObj.bytes_written) : undefined,
              serverIndex: serverIndex >= 0 ? serverIndex : null,
              statusLabel: "Ready",
              description: `Produced by ${call.toolName} through the authenticated external service proxy.`,
            },
          ],
        });
      }

      const mediaItems = extractMediaResults(event.data ?? {}, `tr-${event.sequence ?? messages.length}`);
      if (mediaItems.length > 0) {
        messages.push({
          id: `tm-${event.sequence ?? messages.length}`,
          role: "tool",
          content: `Tool ${call.toolName} returned ${mediaItems.length === 1 ? "a media result" : `${mediaItems.length} media results`}.`,
          timestamp: event.timestamp,
          footer: <MediaResultList items={mediaItems} />,
        });
      }
    }
  }

  return {
    messages,
    toolResults,
  };
}

function ChatFileArtifactCard(props: {
  api: ChatApi;
  sessionId: string | null;
  artifact: TimelineFileArtifact;
  fallbackServerIndex: number | null;
  onRemove?: () => void;
}) {
  const { api, sessionId, artifact, fallbackServerIndex, onRemove } = props;
  const [isDownloading, setIsDownloading] = React.useState(false);
  const [previewState, setPreviewState] = React.useState<PreviewState>({ status: "idle" });
  const previewUrlRef = React.useRef<string | null>(null);

  const fileName = fileNameFromPath(artifact.path);
  const effectiveServerIndex = artifact.serverIndex ?? fallbackServerIndex ?? null;
  const canPreview = !onRemove && !!sessionId && isPreviewablePath(artifact.path);

  React.useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
        previewUrlRef.current = null;
      }
    };
  }, []);

  const downloadArtifact = React.useCallback(async () => {
    if (!sessionId) return;
    setIsDownloading(true);
    try {
      const file = await api.downloadFileContent(sessionId, {
        path: artifact.path,
        serverIndex: effectiveServerIndex,
        downloadName: fileName,
      });
      const url = URL.createObjectURL(file.blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = file.filename;
      link.click();
      window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    } finally {
      setIsDownloading(false);
    }
  }, [api, artifact.path, effectiveServerIndex, fileName, sessionId]);

  const loadPreview = React.useCallback(async () => {
    if (!sessionId || !canPreview) return;
    setPreviewState((current) =>
      current.status === "ready" || current.status === "loading" ? current : { status: "loading" }
    );

    try {
      const file = await api.downloadFileContent(sessionId, {
        path: artifact.path,
        serverIndex: effectiveServerIndex,
        downloadName: fileName,
      });

      if (file.contentType.startsWith("image/") || IMAGE_EXTENSIONS.has(fileExtension(file.filename))) {
        const previewUrl = URL.createObjectURL(file.blob);
        if (previewUrlRef.current) {
          URL.revokeObjectURL(previewUrlRef.current);
        }
        previewUrlRef.current = previewUrl;
        setPreviewState({
          status: "ready",
          preview: {
            kind: "image",
            src: previewUrl,
            alt: file.filename,
          },
        });
        return;
      }

      if (isTextContentType(file.contentType) || TEXT_EXTENSIONS.has(fileExtension(file.filename))) {
        const text = await file.blob.text();
        const previewText =
          text.length > 4000 ? `${text.slice(0, 4000)}\n\n... truncated ...` : text;
        setPreviewState({
          status: "ready",
          preview: {
            kind: "text",
            content: previewText,
          },
        });
        return;
      }

      setPreviewState({ status: "idle" });
    } catch (error) {
      setPreviewState({
        status: "error",
        message: error instanceof Error ? error.message : "Preview unavailable",
      });
    }
  }, [api, artifact.path, canPreview, effectiveServerIndex, fileName, sessionId]);

  React.useEffect(() => {
    if (!canPreview || previewState.status !== "idle") return;
    void loadPreview();
  }, [canPreview, loadPreview, previewState.status]);

  const description =
    previewState.status === "error"
      ? `${artifact.description ?? "File artifact."} Preview unavailable: ${previewState.message}`
      : artifact.description;

  return (
    <FileArtifactCard
      path={artifact.path}
      title={fileName}
      kind={artifact.kind}
      byteSize={artifact.byteSize}
      statusLabel={artifact.statusLabel}
      description={description}
      preview={previewState.status === "ready" ? previewState.preview : null}
      actions={
        onRemove
          ? [
              {
                label: "Remove",
                onClick: onRemove,
                variant: "outline",
              },
            ]
          : sessionId
          ? [
              {
                label: `Download ${fileName}`,
                onClick: downloadArtifact,
                variant: artifact.kind === "download" ? "default" : "secondary",
                loading: isDownloading,
              },
            ]
          : []
      }
    />
  );
}

export function ChatPage() {
  const {
    api,
    uiConfig,
    sessions,
    activeSessionId,
    setActiveSessionId,
    createSession,
    mcpServers,
    selectedServerIndices,
    setSelectedServerIndices,
    awaitSelectedServerIndicesSync,
    refreshMcpServers,
    profiles,
  } = useAppState();
  const auth = useAuth();
  const readOnlyUser = isReadOnlyUser(auth.user);

  const drawer = useRightDrawer();

  const [messages, setMessages] = React.useState<ChatTimelineMessage[]>([]);
  const [toolPanels, setToolPanels] = React.useState<ToolExecutionResult[]>([]);
  // CL-30 (W28E-1876): LLM/model reachability test action.
  const [modelTesting, setModelTesting] = React.useState(false);
  const [modelTestResult, setModelTestResult] = React.useState<LlmTestResult | null>(null);
  const [input, setInput] = React.useState("");
  const [pendingAttachments, setPendingAttachments] = React.useState<PendingAttachment[]>([]);
  const [pendingReferences, setPendingReferences] = React.useState<PendingReference[]>([]);
  const [referenceInput, setReferenceInput] = React.useState("");
  const [showAttachmentTray, setShowAttachmentTray] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);
  const [isSending, setIsSending] = React.useState(false);
  const [elapsedSeconds, setElapsedSeconds] = React.useState(0);
  const selectionRef = React.useRef<number[]>(selectedServerIndices);

  const waitTimeoutMs = Math.max(30_000, (uiConfig?.client_api?.ui_wait_timeout_seconds ?? 300) * 1000);
  const fileServerIndex = React.useMemo(
    () => resolveFileServerIndex(mcpServers, selectedServerIndices),
    [mcpServers, selectedServerIndices]
  );

  const fileIntake = React.useMemo(
    () => resolveFileIntake(profiles, selectedServerIndices),
    [profiles, selectedServerIndices]
  );

  const { uploadsEnabled, byValueAllowed, byReferenceAllowed, artifactRenderingEnabled } =
    deriveFileIntakeGating(fileIntake);

  React.useEffect(() => {
    selectionRef.current = selectedServerIndices;
  }, [selectedServerIndices]);

  const reloadTranscript = React.useCallback(
    async (sessionId: string) => {
      const events = await api.getTranscript(sessionId);
      const parsed = parseTranscript(events);
      setMessages(parsed.messages);
      setToolPanels(parsed.toolResults);
    },
    [api]
  );

  React.useEffect(() => {
    if (!activeSessionId) {
      setMessages([]);
      setToolPanels([]);
      return;
    }
    if (isSending) return;
    void reloadTranscript(activeSessionId).catch((err: unknown) => {
      setError(err instanceof Error ? err.message : "Failed to load transcript");
    });
  }, [activeSessionId, isSending, reloadTranscript]);

  React.useEffect(() => {
    if (!isSending) {
      setElapsedSeconds(0);
      return;
    }
    const timer = window.setInterval(() => {
      setElapsedSeconds((current) => current + 1);
    }, 1000);
    return () => window.clearInterval(timer);
  }, [isSending]);

  const queueAttachments = React.useCallback((files: File[]) => {
    setPendingAttachments((current) => {
      const next = [...current];
      for (const file of files) {
        const attachmentIndex = next.length;
        next.push({
          id: `${Date.now()}-${attachmentIndex}-${file.name}`,
          file,
          path: buildAttachmentPath(file, attachmentIndex),
          byteSize: file.size,
          serverIndex: fileServerIndex,
        });
      }
      return next;
    });
    setShowAttachmentTray(true);
  }, [fileServerIndex]);

  const removePendingAttachment = React.useCallback((attachmentId: string) => {
    setPendingAttachments((current) => current.filter((item) => item.id !== attachmentId));
  }, []);

  const addReference = React.useCallback(() => {
    const value = referenceInput.trim();
    if (!value) return;
    const mode = classifyReference(value);
    const index = pendingReferences.length;
    setPendingReferences((current) => [
      ...current,
      {
        id: `ref-${Date.now()}-${index}`,
        reference: value,
        mode,
        path: mode === "url" ? buildReferencePath(value, index) : value,
        serverIndex: fileServerIndex,
      },
    ]);
    setReferenceInput("");
    setShowAttachmentTray(true);
  }, [fileServerIndex, pendingReferences.length, referenceInput]);

  const removePendingReference = React.useCallback((refId: string) => {
    setPendingReferences((current) => current.filter((item) => item.id !== refId));
  }, []);

  const send = async () => {
    const text = input.trim();
    if (!text || isSending) return;

    const queuedAttachments = pendingAttachments;
    const queuedReferences = pendingReferences;
    const hasFiles = queuedAttachments.length > 0 || queuedReferences.length > 0;
    setError(null);
    setIsSending(true);

    let sessionId = activeSessionId;
    let createdSessionId = false;

    try {
      let effectiveSelectedIndices = selectionRef.current;
      const queuedFileServerIndex = queuedAttachments.find((attachment) => attachment.serverIndex != null)?.serverIndex ?? null;
      let resolvedFileServerIndex =
        hasFiles
          ? queuedFileServerIndex ?? resolveFileServerIndex(mcpServers, effectiveSelectedIndices) ?? fileServerIndex
          : null;
      if (hasFiles && resolvedFileServerIndex == null) {
        resolvedFileServerIndex = resolveFileServerIndex(await api.listMcpServers(), effectiveSelectedIndices);
      }
      if (hasFiles && resolvedFileServerIndex == null) {
        throw new Error("File operations require a configured file external service for this session.");
      }
      const expandedSelection =
        resolvedFileServerIndex != null && !effectiveSelectedIndices.includes(resolvedFileServerIndex);

      if (expandedSelection && resolvedFileServerIndex != null) {
        effectiveSelectedIndices = [...effectiveSelectedIndices, resolvedFileServerIndex].sort((a, b) => a - b);
        selectionRef.current = effectiveSelectedIndices;
      }

      if (!sessionId) {
        sessionId = await createSession(text.slice(0, 48));
        if (!sessionId) throw new Error("Unable to create session");
        createdSessionId = true;
      }

      setInput("");
      await awaitSelectedServerIndicesSync();

      if (createdSessionId && effectiveSelectedIndices.length > 0 && !readOnlyUser) {
        await api.setSessionPreferences(sessionId, effectiveSelectedIndices);
      } else if (expandedSelection) {
        await setSelectedServerIndices(effectiveSelectedIndices);
      }

      const uploadedAttachments: UploadedAttachment[] = [];

      if (queuedAttachments.length > 0) {
        for (const attachment of queuedAttachments) {
          const upload = await api.uploadFile(sessionId, {
            file: attachment.file,
            path: attachment.path,
            serverIndex: attachment.serverIndex ?? resolvedFileServerIndex,
          });
          uploadedAttachments.push({
            id: attachment.id,
            path: upload.path || attachment.path,
            byteSize: upload.bytesWritten ?? attachment.byteSize,
            serverIndex: upload.serverIndex ?? attachment.serverIndex ?? resolvedFileServerIndex,
          });
        }
      }

      const uploadedReferences: UploadedAttachment[] = [];

      if (queuedReferences.length > 0) {
        for (const ref of queuedReferences) {
          if (ref.mode === "url") {
            const upload = await api.uploadFileByReference(sessionId, {
              path: ref.path,
              sourceUrl: ref.reference,
              serverIndex: ref.serverIndex ?? resolvedFileServerIndex,
            });
            uploadedReferences.push({
              id: ref.id,
              path: upload.path || ref.path,
              byteSize: upload.bytesWritten ?? 0,
              serverIndex: upload.serverIndex ?? ref.serverIndex ?? resolvedFileServerIndex,
            });
          } else {
            uploadedReferences.push({
              id: ref.id,
              path: ref.reference,
              byteSize: 0,
              serverIndex: ref.serverIndex ?? resolvedFileServerIndex,
            });
          }
        }
      }

      const renderedAttachments = uploadedAttachments.length > 0 ? uploadedAttachments : queuedAttachments;

      const composedText = buildReferencePromptText(
        buildAttachmentPromptText(text, queuedAttachments),
        queuedReferences
      );

      const allArtifacts: TimelineFileArtifact[] = [
        ...renderedAttachments.map((attachment) => ({
          id: attachment.id,
          kind: "attachment" as FileArtifactKind,
          path: attachment.path,
          byteSize: attachment.byteSize,
          serverIndex: attachment.serverIndex,
          statusLabel: uploadedAttachments.length > 0 ? "Uploaded" : "Queued",
          description: uploadedAttachments.length > 0
            ? "Uploaded through the authenticated chat-session file proxy."
            : "This file will be uploaded through the chat-session file proxy.",
        })),
        ...uploadedReferences.map((ref) => ({
          id: ref.id,
          kind: "reference" as FileArtifactKind,
          path: ref.path,
          byteSize: ref.byteSize > 0 ? ref.byteSize : undefined,
          serverIndex: ref.serverIndex,
          statusLabel: queuedReferences.find((r) => r.id === ref.id)?.mode === "url" ? "Fetched" : "Referenced",
          description: queuedReferences.find((r) => r.id === ref.id)?.mode === "url"
            ? "Fetched from URL through the authenticated file transfer proxy."
            : "File reference provided for the downstream agent.",
        })),
      ];

      const userMessage: ChatTimelineMessage = {
        id: `u-local-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
        artifacts: allArtifacts.length > 0 ? allArtifacts : undefined,
      };
      const assistantMessage: ChatTimelineMessage = {
        id: `a-local-${Date.now()}`,
        role: "assistant",
        content: "",
        timestamp: new Date().toISOString(),
      };
      setMessages((current) => [...current, userMessage, assistantMessage]);

      await api.streamMessage(sessionId, composedText, waitTimeoutMs, {
        onDelta: (delta) => {
          setMessages((current) => {
            if (!current.length) return current;
            const next = [...current];
            const last = next[next.length - 1];
            if (last.role !== "assistant") return current;
            next[next.length - 1] = {
              ...last,
              content: `${last.content}${delta}`,
            };
            return next;
          });
        },
      });

      setPendingAttachments([]);
      setPendingReferences([]);
      setReferenceInput("");
      setShowAttachmentTray(false);
      await reloadTranscript(sessionId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to send message");
    } finally {
      setIsSending(false);
    }
  };

  const onInputKeyDown = async (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      await send();
    }
  };

  const toggleServer = async (index: number, checked: boolean) => {
    const current = selectionRef.current;
    const next = checked
      ? Array.from(new Set([...current, index])).sort((a, b) => a - b)
      : current.filter((item) => item !== index);
    selectionRef.current = next;

    try {
      await setSelectedServerIndices(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to update external service selection");
    }
  };

  // CL-25 (W28E-1876): show the logged-in user's name (not the raw "user" role)
  // in the header of their own messages, falling back gracefully.
  const userDisplayName = React.useMemo(
    () =>
      auth.user?.displayName?.trim() ||
      auth.user?.username?.trim() ||
      auth.user?.email?.trim() ||
      "You",
    [auth.user]
  );

  const renderedMessages = React.useMemo(
    () =>
      messages.map((message) => ({
        ...message,
        displayName: message.role === "user" ? userDisplayName : undefined,
        footer:
          message.artifacts && message.artifacts.length > 0 ? (
            <div className="space-y-2">
              {message.artifacts.map((artifact) => (
                <ChatFileArtifactCard
                  key={artifact.id}
                  api={api}
                  sessionId={activeSessionId}
                  artifact={artifact}
                  fallbackServerIndex={fileServerIndex}
                />
              ))}
            </div>
          ) : undefined,
      })),
    [activeSessionId, api, fileServerIndex, messages, userDisplayName]
  );

  const [selectedProfileId, setSelectedProfileId] = React.useState<string>("");
  const [sessionPage, setSessionPage] = React.useState(1);
  const [sessionPageSize, setSessionPageSize] = React.useState(5);
  const selectedProfile = React.useMemo(
    () => profiles.find((profile) => profile.profile_id === selectedProfileId),
    [profiles, selectedProfileId]
  );
  const activeSession = React.useMemo(
    () => sessions.find((session) => session.id === activeSessionId),
    [activeSessionId, sessions]
  );
  const filteredSessions = React.useMemo(() => {
    if (!selectedProfileId) return sessions;
    return sessions.filter((session) => sessionProfileId(session) === selectedProfileId);
  }, [sessions, selectedProfileId]);

  React.useEffect(() => {
    setSessionPage(1);
  }, [selectedProfileId]);

  const handleNewSession = React.useCallback(async () => {
    let title: string | undefined;
    const metadata: Record<string, unknown> = {};
    if (selectedProfile) {
      title = `${selectedProfile.name} - ${new Date().toLocaleString()}`;
      metadata.profile_id = selectedProfile.profile_id;
      metadata.profile_name = selectedProfile.name;
      metadata.profile_description = selectedProfile.description;
      const indices = profileServerIndices(selectedProfile, mcpServers);
      if (indices.length > 0) {
        metadata.selected_mcp_server_indices = indices;
      }
    }
    await createSession(title, metadata);
  }, [createSession, mcpServers, selectedProfile]);

  const sessionColumns = React.useMemo<DataColumn<SessionSummary>[]>(() => [
    {
      id: "title",
      header: "Session",
      sortable: true,
      sortValue: (session) => sessionTitle(session).toLowerCase(),
      cell: (session) => (
        <Button
          type="button"
          className="text-left font-medium underline-offset-4 hover:underline"
          variant={session.id === activeSessionId ? "secondary" : "ghost"}
          onClick={() => setActiveSessionId(session.id)}
        >
          {sessionTitle(session)}
        </Button>
      ),
    },
    {
      id: "profile",
      header: "Profile",
      sortable: true,
      sortValue: (session) => profileLabel(profiles, sessionProfileId(session)).toLowerCase(),
      cell: (session) => profileLabel(profiles, sessionProfileId(session)),
    },
    {
      id: "last_activity",
      header: "Last activity",
      sortable: true,
      sortValue: (session) => sessionLastActivity(session),
      cell: (session) => <RelativeTime timestamp={sessionLastActivity(session)} />,
    },
    {
      id: "actions",
      header: "Actions",
      cell: (session) => (
        <Button
          type="button"
          variant="secondary"
          onClick={() => setActiveSessionId(session.id)}
        >
          Open
        </Button>
      ),
    },
  ], [activeSessionId, profiles, setActiveSessionId]);

  const exportChat = React.useCallback(() => {
    if (!messages.length) return;
    const lines = messages.map((m) => `[${m.timestamp ?? ""}] ${m.role ?? "unknown"}: ${m.content ?? ""}`);
    const blob = new Blob([lines.join("\n\n")], { type: "text/plain" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `chat-${activeSessionId ?? "export"}-${Date.now()}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  }, [activeSessionId, messages]);

  // CL-30 (W28E-1876): probe the configured LLM/model with a minimal completion
  // and surface success/model/latency (or the error) inline, so a user can
  // verify the model responds before starting a real conversation.
  const handleTestModel = React.useCallback(async () => {
    setModelTesting(true);
    setModelTestResult(null);
    try {
      const result = await api.testModel();
      setModelTestResult(result);
    } catch (err) {
      setModelTestResult({
        ok: false,
        model: "",
        provider: "",
        latency_ms: 0,
        error: err instanceof Error ? err.message : "Model test failed",
      });
    } finally {
      setModelTesting(false);
    }
  }, [api]);

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col gap-2 lg:flex-row lg:items-center lg:justify-between">
            <div>
              <h1 className="text-xl font-semibold">Chat</h1>
              <p className="text-sm text-muted-foreground">
                Active session: {activeSession ? sessionTitle(activeSession) : "none"}
                {activeSession ? ` | ${profileLabel(profiles, sessionProfileId(activeSession))}` : ""}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="secondary"
                size="sm"
                onClick={() => void handleTestModel()}
                disabled={modelTesting}
                data-testid="chat-test-model"
              >
                {modelTesting ? "Testing model…" : "Test model"}
              </Button>
              <Button variant="secondary" size="sm" onClick={() => drawer.toggle()}>
                {drawer.isOpen ? "Hide activity" : "Show activity"}
              </Button>
              {messages.length > 0 ? (
                <Button variant="secondary" size="sm" onClick={exportChat}>
                  Export chat
                </Button>
              ) : null}
            </div>
          </div>
          {modelTestResult ? (
            <p
              role="status"
              data-testid="chat-model-test-result"
              className={
                modelTestResult.ok
                  ? "mt-2 text-xs text-emerald-700"
                  : "mt-2 text-xs text-destructive"
              }
            >
              {modelTestResult.ok
                ? `Model OK — ${modelTestResult.model || "configured model"} responded in ${modelTestResult.latency_ms} ms${
                    modelTestResult.sample ? ` ("${modelTestResult.sample}")` : ""
                  }`
                : `Model test failed — ${modelTestResult.error || "no response from the configured model"}`}
            </p>
          ) : null}
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="space-y-3 rounded-md border p-3" data-testid="chat-session-table">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-center gap-2">
              <label htmlFor="chat-profile-select" className="text-sm font-medium whitespace-nowrap">Profile</label>
              <select
                id="chat-profile-select"
                className="rounded border bg-background px-2 py-1 text-sm"
                value={selectedProfileId}
                onChange={(e) => setSelectedProfileId(e.target.value)}
                data-testid="chat-profile-selector"
              >
                <option value="">All profiles</option>
                {profiles.map((p) => <option key={p.profile_id} value={p.profile_id}>{p.name}</option>)}
              </select>
              </div>
              <Button variant="secondary" size="sm" onClick={() => void handleNewSession()} data-testid="chat-new-session">
                New session
              </Button>
            </div>
            <DataTable
              tableId="chat-inline-sessions"
              columns={sessionColumns}
              rows={filteredSessions}
              totalRows={filteredSessions.length}
              emptyMessage="No sessions match this profile."
              getRowId={(session) => session.id}
              page={sessionPage}
              onPageChange={setSessionPage}
              pageSize={sessionPageSize}
              onPageSizeChange={setSessionPageSize}
              columnPickerEnabled={true}
            />
          </div>

          <div className="grid grid-cols-1 gap-4 xl:grid-cols-[1fr_20rem]">
            <div className="min-h-[28rem] max-h-[60vh] overflow-auto rounded-md border bg-background p-3">
              {messages.length === 0 ? (
                <p className="text-sm text-muted-foreground">No messages yet. Start a conversation below.</p>
              ) : (
                <ChatTimeline messages={renderedMessages} />
              )}
            </div>

            <div className="space-y-3">
              <div className="space-y-2 rounded-md border p-3">
                <p className="text-sm font-medium">External services for this session</p>
                {mcpServers.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No external services configured.</p>
                ) : (
                  mcpServers.map((server) => (
                    <label key={server.index} className="flex items-start gap-2 text-sm">
                      <Checkbox
                        checked={selectedServerIndices.includes(server.index)}
                        onChange={(event) =>
                          void toggleServer(server.index, Boolean((event.target as HTMLInputElement).checked))
                        }
                      />
                      <span>
                        {server.index}: {server.name}
                      </span>
                    </label>
                  ))
                )}
              </div>

              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium">Recent tool calls</p>
                  {toolPanels.length > 0 ? (
                    <span className="text-[11px] text-muted-foreground" data-testid="tool-calls-count">
                      {toolPanels.length} recorded
                    </span>
                  ) : null}
                </div>
                {toolPanels.length === 0 ? (
                  <p className="text-xs text-muted-foreground" data-testid="tool-calls-empty">
                    {selectedServerIndices.length === 0
                      ? "No external services are selected for this session. Select one above, then each tool the assistant runs — with its arguments and result — is recorded here."
                      : "No tool calls yet. When the assistant invokes a selected external service, each call — with its arguments and result — is recorded here."}
                  </p>
                ) : (
                  toolPanels.slice(0, 4).map((panel) => (
                    <div key={`${panel.timestamp}-${panel.serverIndex}-${panel.toolName}`}>
                      <ToolCallPanel
                        toolName={`${panel.serverIndex}:${panel.toolName}`}
                        args={panel.arguments}
                        result={panel.result}
                        defaultOpen={false}
                      />
                      <RelativeTime timestamp={panel.timestamp} className="mt-1 text-[11px] text-muted-foreground" />
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          <div className="space-y-3">
            <div className="flex flex-wrap items-center gap-2">
              {uploadsEnabled ? (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowAttachmentTray((current) => !current)}
                >
                  {showAttachmentTray ? "Hide attachments" : "Attach files"}
                </Button>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {!uploadsEnabled
                  ? "File uploads are disabled by the active profile."
                  : pendingAttachments.length > 0 || pendingReferences.length > 0
                  ? `${pendingAttachments.length + pendingReferences.length} file(s) queued for the next message.`
                  : "Files are uploaded through the authenticated chat-session file proxy."}
              </p>
            </div>

            {showAttachmentTray && uploadsEnabled ? (
              <div className="space-y-3 rounded-md border border-dashed p-3">
                <p className="text-sm font-medium">Attach files to the next message</p>

                {byValueAllowed ? (
                  <FileDropZone
                    onDrop={queueAttachments}
                    disabled={isSending || fileServerIndex == null}
                    className="p-5"
                  />
                ) : null}

                {byReferenceAllowed ? (
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={referenceInput}
                      onChange={(event) => setReferenceInput(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter") {
                          event.preventDefault();
                          addReference();
                        }
                      }}
                      placeholder="File path or URL reference (e.g. /data/report.md or https://...)"
                      className="flex-1 rounded-md border bg-background px-3 py-2 text-sm"
                      disabled={isSending || fileServerIndex == null}
                      aria-label="File reference input"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={addReference}
                      disabled={isSending || fileServerIndex == null || !referenceInput.trim()}
                    >
                      Add reference
                    </Button>
                  </div>
                ) : null}

                {fileServerIndex == null ? (
                  <p className="text-xs text-destructive">
                    No file external service is currently configured for this chat client.
                  </p>
                ) : null}
                {pendingAttachments.length > 0 ? (
                  <div className="space-y-2">
                    {pendingAttachments.map((attachment) => (
                      <ChatFileArtifactCard
                        key={attachment.id}
                        api={api}
                        sessionId={null}
                        artifact={{
                          id: attachment.id,
                          kind: "attachment",
                          path: attachment.path,
                          byteSize: attachment.byteSize,
                          serverIndex: attachment.serverIndex ?? fileServerIndex,
                          statusLabel: "Pending",
                          description: "Queued for upload with your next chat message.",
                        }}
                        fallbackServerIndex={fileServerIndex}
                        onRemove={() => removePendingAttachment(attachment.id)}
                      />
                    ))}
                  </div>
                ) : null}
                {pendingReferences.length > 0 ? (
                  <div className="space-y-2">
                    {pendingReferences.map((ref) => (
                      <ChatFileArtifactCard
                        key={ref.id}
                        api={api}
                        sessionId={null}
                        artifact={{
                          id: ref.id,
                          kind: "reference",
                          path: ref.reference,
                          serverIndex: ref.serverIndex ?? fileServerIndex,
                          statusLabel: ref.mode === "url" ? "URL" : "Path",
                          description: ref.mode === "url"
                            ? "URL reference - content will be fetched through the file proxy on send."
                            : "File path reference - accessible to the downstream agent.",
                        }}
                        fallbackServerIndex={fileServerIndex}
                        onRemove={() => removePendingReference(ref.id)}
                      />
                    ))}
                  </div>
                ) : null}
              </div>
            ) : null}

            <label htmlFor="chat-input" className="text-sm font-medium">
              Message
            </label>
            <Textarea
              id="chat-input"
              value={input}
              onChange={(event) => setInput(event.target.value)}
              onKeyDown={onInputKeyDown}
              rows={4}
              className="resize-y"
              placeholder="Type your message. Press Enter to send, Shift+Enter for a new line."
            />
            <div className="flex items-center gap-3">
              <Button onClick={() => void send()} disabled={!input.trim() || isSending}>
                Send
              </Button>
              {isSending ? (
                <div className="inline-flex items-center gap-2 text-sm text-muted-foreground" aria-live="polite">
                  <Spinner />
                  Sending message... {elapsedSeconds}s
                </div>
              ) : null}
            </div>
          </div>

          {error ? (
            <div role="alert" className="rounded-md border border-destructive/50 bg-destructive/10 p-3">
              <p className="text-sm font-medium text-destructive">Chat error</p>
              <p className="mt-1 whitespace-pre-wrap text-sm text-destructive/80">{error}</p>
              <Button variant="ghost" size="sm" className="mt-2 text-xs" onClick={() => setError(null)}>Dismiss</Button>
            </div>
          ) : null}
        </CardContent>
      </Card>
    </div>
  );
}
