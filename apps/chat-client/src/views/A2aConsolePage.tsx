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

import * as React from "react";
import { A2aConsole, Badge, Button, Card, CardContent, CardHeader, FileDropZone, Input, Select } from "@cloud-dog/ui";
import { useConfig } from "../lib/runtime-config";
import { useAppState } from "../state/AppState";

type RuntimeConfig = {
  A2A_EVENTS_URL: string;
  A2A_WS_URL: string;
};

function resolveA2aHttpBase(eventsUrl: string): string {
  if (typeof window === "undefined") return "/weba2a";
  try {
    const absolute = new URL(eventsUrl, window.location.origin);
    const path = absolute.pathname.replace(/\/events\/?$/i, "") || "/weba2a";
    return new URL(path, absolute.origin).toString().replace(/\/$/, "");
  } catch {
    return `${window.location.origin}/weba2a`;
  }
}

function parseTaskOutput(text: string): unknown {
  const raw = String(text || "").trim();
  if (!raw) return "";
  try {
    return JSON.parse(raw);
  } catch {
    return raw;
  }
}

function encodeBytesToBase64(bytes: Uint8Array): string {
  let binary = "";
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return window.btoa(binary);
}

function decodeBase64ToBytes(value: string): Uint8Array {
  const binary = window.atob(value);
  const bytes = new Uint8Array(binary.length);
  for (let index = 0; index < binary.length; index += 1) {
    bytes[index] = binary.charCodeAt(index);
  }
  return bytes;
}

export function A2aConsolePage() {
  const cfg = useConfig<RuntimeConfig>();
  const { activeSessionId, api, apiKey, apiKeyHeader, mcpServers } = useAppState();
  const [eventError, setEventError] = React.useState<string | null>(null);
  const [taskError, setTaskError] = React.useState<string | null>(null);
  const [fileError, setFileError] = React.useState<string | null>(null);
  const [fileStatus, setFileStatus] = React.useState<string | null>(null);
  const [uploadPath, setUploadPath] = React.useState("/root/a2a-upload.txt");
  const [downloadPath, setDownloadPath] = React.useState("/root/a2a-upload.txt");
  const [selectedProfile, setSelectedProfile] = React.useState("default");
  const [profiles, setProfiles] = React.useState<string[]>([]);
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [taskResult, setTaskResult] = React.useState<unknown>(null);
  const [downloadResult, setDownloadResult] = React.useState<unknown>(null);
  const [busyAction, setBusyAction] = React.useState<"upload" | "download" | null>(null);

  const a2aHttpBase = React.useMemo(() => resolveA2aHttpBase(cfg.A2A_EVENTS_URL), [cfg.A2A_EVENTS_URL]);
  const fileServerIndex = React.useMemo(() => {
    const match = mcpServers.find((server) => server.name.toLowerCase().includes("file"));
    return match?.index ?? null;
  }, [mcpServers]);
  const authHeaders = React.useMemo(() => {
    const headers: Record<string, string> = {};
    if (apiKey.trim()) {
      headers[apiKeyHeader || "X-API-Key"] = apiKey.trim();
    }
    return headers;
  }, [apiKey, apiKeyHeader]);

  React.useEffect(() => {
    if (!activeSessionId || fileServerIndex === null) {
      setProfiles([]);
      return;
    }
    let cancelled = false;
    void api
      .listFileProfiles(activeSessionId, fileServerIndex)
      .then((listed) => {
        if (cancelled) return;
        setProfiles(listed);
        if (listed.length && !listed.includes(selectedProfile)) {
          setSelectedProfile(listed[0]);
        }
      })
      .catch(() => {
        if (!cancelled) setProfiles([]);
      });
    return () => {
      cancelled = true;
    };
  }, [activeSessionId, api, fileServerIndex, selectedProfile]);

  const submitTask = React.useCallback(
    async (skillId: string, payload: Record<string, unknown>) => {
      setTaskError(null);
      const response = await fetch(`${a2aHttpBase}/tasks`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json", ...authHeaders },
        body: JSON.stringify({
          id: crypto.randomUUID(),
          skill_id: skillId,
          input: { text: JSON.stringify(payload) },
        }),
      });
      const taskPayload = (await response.json().catch(() => ({}))) as {
        status?: string;
        error?: string;
        output?: { text?: string };
      };
      if (!response.ok || taskPayload.status === "failed") {
        throw new Error(String(taskPayload.error || response.statusText || "A2A task failed"));
      }
      return parseTaskOutput(String(taskPayload.output?.text ?? ""));
    },
    [a2aHttpBase, authHeaders]
  );

  const handleUpload = React.useCallback(async () => {
    if (!activeSessionId) {
      setFileError("Create or select a session before using A2A file transfer.");
      return;
    }
    if (fileServerIndex === null) {
      setFileError("No file external service is configured.");
      return;
    }
    if (!selectedFile) {
      setFileError("Select a file to upload.");
      return;
    }
    if (!uploadPath.trim()) {
      setFileError("Enter a destination path.");
      return;
    }
    setBusyAction("upload");
    setFileError(null);
    setFileStatus(null);
    try {
      const bytes = new Uint8Array(await selectedFile.arrayBuffer());
      const result = await submitTask("upload_file", {
        session_id: activeSessionId,
        server_index: fileServerIndex,
        path: uploadPath.trim(),
        profile: selectedProfile,
        overwrite: true,
        content_base64: encodeBytesToBase64(bytes),
      });
      setTaskResult(result);
      setDownloadPath(uploadPath.trim());
      setFileStatus(`Uploaded ${selectedFile.name} to ${uploadPath.trim()} via A2A.`);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "A2A upload failed");
    } finally {
      setBusyAction(null);
    }
  }, [activeSessionId, fileServerIndex, selectedFile, uploadPath, selectedProfile, submitTask]);

  const handleDownload = React.useCallback(async () => {
    if (!activeSessionId) {
      setFileError("Create or select a session before using A2A file transfer.");
      return;
    }
    if (fileServerIndex === null) {
      setFileError("No file external service is configured.");
      return;
    }
    if (!downloadPath.trim()) {
      setFileError("Enter a download path.");
      return;
    }
    setBusyAction("download");
    setFileError(null);
    setFileStatus(null);
    try {
      const result = (await submitTask("download_file", {
        session_id: activeSessionId,
        server_index: fileServerIndex,
        path: downloadPath.trim(),
        profile: selectedProfile,
      })) as { content_base64?: string; path?: string };
      const contentBase64 = String(result?.content_base64 ?? "").trim();
      if (!contentBase64) {
        throw new Error("A2A download did not return file content");
      }
      const bytes = decodeBase64ToBytes(contentBase64);
      const blobPart = new Uint8Array(bytes.length);
      blobPart.set(bytes);
      const blob = new Blob([blobPart], { type: "application/octet-stream" });
      const objectUrl = URL.createObjectURL(blob);
      const anchor = document.createElement("a");
      anchor.href = objectUrl;
      anchor.download = String(result?.path ?? downloadPath).split("/").pop() || "download.bin";
      anchor.click();
      URL.revokeObjectURL(objectUrl);
      setDownloadResult(result);
      setFileStatus(`Downloaded ${downloadPath.trim()} via A2A.`);
    } catch (error) {
      setFileError(error instanceof Error ? error.message : "A2A download failed");
    } finally {
      setBusyAction(null);
    }
  }, [activeSessionId, downloadPath, fileServerIndex, selectedProfile, submitTask]);

  return (
    <div className="space-y-6">
      {/* PS-72 MW4: Auth display */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-semibold">Authentication</h2>
            <Badge variant="default" className="bg-emerald-600 text-white border-emerald-700">session</Badge>
          </div>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            A2A event surface: <code className="text-xs">{cfg.A2A_EVENTS_URL}</code>. Task surface:
            {" "}
            <code className="text-xs">{a2aHttpBase}/tasks</code>.
          </p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h1 className="text-xl font-semibold">A2A Console</h1>
          <p className="text-sm text-muted-foreground">Submit A2A tasks directly against chat-client skills using the shared console component.</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <A2aConsole
            endpointUrl={`${a2aHttpBase}/tasks`}
            onSend={async (skillId, payload) => {
              const taskPayload =
                payload && typeof payload === "object" && !Array.isArray(payload)
                  ? (payload as Record<string, unknown>)
                  : { value: payload };
              const result = await submitTask(skillId, taskPayload);
              setTaskResult(result);
              return result;
            }}
          />
          {taskError ? <p role="alert" className="text-sm text-destructive">{taskError}</p> : null}
          {taskResult !== null ? (
            <pre className="overflow-auto rounded-md border bg-muted/30 p-3 text-xs">{JSON.stringify(taskResult, null, 2)}</pre>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">A2A File Transfer</h2>
          <p className="text-sm text-muted-foreground">
            Upload and download files through the A2A skill surface using the active chat session and file-mcp binding.
          </p>
        </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Active session</label>
            <Input value={activeSessionId ?? ""} readOnly aria-label="Active session" placeholder="No active session" />
          </div>
          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">File profile</label>
            <Select value={selectedProfile} onChange={(event) => setSelectedProfile(event.target.value)} disabled={!profiles.length}>
              {(profiles.length ? profiles : ["default"]).map((profile) => (
                <option key={profile} value={profile}>{profile}</option>
              ))}
            </Select>
          </div>
        </div>
        <div className="grid gap-3 md:grid-cols-2">
          <div className="space-y-2 rounded-md border p-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Upload path</label>
            <Input value={uploadPath} onChange={(event) => setUploadPath(event.target.value)} aria-label="Upload path" />
            <FileDropZone
              accept=".txt,.md,.json,.yaml,.yml,.xml,.html,.csv,.log,application/octet-stream,text/*"
              multiple={false}
              label="A2A upload file"
              description={selectedFile ? `${selectedFile.name} selected for upload.` : "Choose one file to upload through the A2A file skill."}
              dropLabel="Drop the A2A file here"
              browseLabel="Browse file"
              inputLabel="A2A upload file"
              disabled={busyAction !== null}
              onDrop={(files) => setSelectedFile(files[0] ?? null)}
            />
            <Button onClick={() => void handleUpload()} disabled={busyAction !== null || !selectedFile}>
              {busyAction === "upload" ? "Uploading..." : "Upload via A2A"}
            </Button>
          </div>
          <div className="space-y-2 rounded-md border p-3">
            <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Download path</label>
            <Input value={downloadPath} onChange={(event) => setDownloadPath(event.target.value)} aria-label="Download path" />
            <Button onClick={() => void handleDownload()} disabled={busyAction !== null || !downloadPath.trim()}>
              {busyAction === "download" ? "Downloading..." : "Download via A2A"}
            </Button>
          </div>
        </div>
        {fileStatus ? <p className="text-sm text-emerald-700">{fileStatus}</p> : null}
        {fileError ? <p role="alert" className="text-sm text-destructive">{fileError}</p> : null}
        {downloadResult !== null ? (
          <pre className="overflow-auto rounded-md border bg-muted/30 p-3 text-xs">{JSON.stringify(downloadResult, null, 2)}</pre>
        ) : null}
      </CardContent>
    </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">A2A Events</h2>
          <p className="text-sm text-muted-foreground">Inspect the persisted A2A event surface using the shared console pattern.</p>
        </CardHeader>
      <CardContent className="space-y-3">
        <A2aConsole
          endpointUrl={cfg.A2A_WS_URL}
          onSend={async (topic) => {
            setEventError(null);
            const response = await fetch(cfg.A2A_EVENTS_URL, { credentials: "include" });
            const payload = await response.json();
            if (!response.ok) {
              throw new Error(String(payload?.detail || response.statusText || "A2A request failed"));
            }
            const events = Array.isArray(payload?.events) ? payload.events : [];
            return {
              topic,
              events: events.filter((event: Record<string, unknown>) => !topic || String(event.topic || "").includes(String(topic))),
            };
          }}
        />
        {eventError ? <p role="alert" className="text-sm text-destructive">{eventError}</p> : null}
      </CardContent>
    </Card>
    </div>
  );
}
