// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Apache-2.0

// chat-client — FileBrowserPage: proxy file browser via the configured file service.

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { Card, CardContent, CardHeader, FileBrowser, FileDropZone, Select, Spinner } from "@cloud-dog/ui";
import type { FileItem } from "@cloud-dog/ui";
import type { FolderNode } from "@cloud-dog/ui";
import { useConfig } from "@cloud-dog/config";
import { isReadOnlyUser } from "../lib/rbac";
import { useAppState } from "../state/AppState";

type McpServer = { index: number; name: string };
type RuntimeConfig = { MCP_BASE_URL: string; API_KEY_HEADER?: string };

export function FileBrowserPage() {
  const auth = useAuth();
  const { api, apiKey, apiKeyHeader, activeSessionId } = useAppState();
  const cfg = useConfig<RuntimeConfig>();
  const readOnly = isReadOnlyUser(auth.user);
  const [servers, setServers] = React.useState<McpServer[]>([]);
  const [serverIndex, setServerIndex] = React.useState<number | null>(null);
  const [currentPath, setCurrentPath] = React.useState("/");
  const [folders, setFolders] = React.useState<FolderNode[]>([]);
  const [files, setFiles] = React.useState<FileItem[]>([]);
  const [profiles, setProfiles] = React.useState<string[]>([]);
  const [selectedProfile, setSelectedProfile] = React.useState("default");
  const [loading, setLoading] = React.useState(false);
  const [error, setError] = React.useState<string | null>(null);

  // Helper: call MCP tool via session proxy
  const callTool = React.useCallback(async (name: string, args: Record<string, unknown>) => {
    if (serverIndex === null || !activeSessionId) return null;
    const headers: Record<string, string> = { "Content-Type": "application/json" };
    if (apiKey.trim()) headers[apiKeyHeader || cfg.API_KEY_HEADER || "X-API-Key"] = apiKey.trim();
    if (selectedProfile.trim()) headers["X-File-MCP-Profile"] = selectedProfile.trim();
    const resp = await fetch(`/sessions/${activeSessionId}/mcp/tools/call`, {
      method: "POST", credentials: "include", headers,
      body: JSON.stringify({ server_index: serverIndex, name, arguments: args }),
    });
    const data = await resp.json();
    return data?.result ?? data;
  }, [serverIndex, activeSessionId, apiKey, apiKeyHeader, cfg.API_KEY_HEADER]);

  // Find the configured file service index.
  React.useEffect(() => {
    (async () => {
      try {
        const headers: Record<string, string> = {};
        if (apiKey.trim()) headers[apiKeyHeader || cfg.API_KEY_HEADER || "X-API-Key"] = apiKey.trim();
        const resp = await fetch("/mcp/servers", { credentials: "include", headers });
        const data = await resp.json();
        const srvs = (data?.servers ?? []).filter(
          (s: any) => s.name?.toLowerCase().includes("file")
        );
        setServers(srvs);
        if (srvs.length > 0) setServerIndex(srvs[0].index);
      } catch {}
    })();
  }, [apiKey, apiKeyHeader, cfg.API_KEY_HEADER]);

  // Load file storage profiles via the chat-client backend proxy.
  React.useEffect(() => {
    if (serverIndex === null || !activeSessionId) return;
    (async () => {
      try {
        const listedProfiles = await api.listFileProfiles(activeSessionId, serverIndex);
        setProfiles(listedProfiles);
        if (listedProfiles.length && !listedProfiles.includes(selectedProfile)) {
          setSelectedProfile(listedProfiles[0]);
          setCurrentPath("/");
        }
      } catch {
        setProfiles([]);
      }
    })();
  }, [activeSessionId, api, selectedProfile, serverIndex]);

  // Load directory listing
  const loadDir = React.useCallback(async (path: string) => {
    if (serverIndex === null) return;
    setLoading(true);
    setError(null);
    try {
      const result = await callTool("list_dir", { path });
      const entries = result?.entries ?? result?.result?.entries ?? [];
      const folderNodes: FolderNode[] = [];
      const fileItems: FileItem[] = [];
      for (const entry of entries) {
        if (entry.type === "directory" || entry.is_dir) {
          folderNodes.push({ name: entry.name, path: entry.path ?? `${path}/${entry.name}`, children: [] });
        } else {
          fileItems.push({
            name: entry.name,
            path: entry.path ?? `${path}/${entry.name}`,
            size: entry.size != null ? String(entry.size) : undefined,
            modified: entry.modified ?? entry.modifiedAt,
          });
        }
      }
      setFolders(folderNodes);
      setFiles(fileItems);
      setCurrentPath(path);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to list directory");
    } finally {
      setLoading(false);
    }
  }, [serverIndex]);

  React.useEffect(() => {
    if (serverIndex !== null) loadDir(currentPath);
  }, [serverIndex, loadDir]); // eslint-disable-line react-hooks/exhaustive-deps

  const handleUpload = React.useCallback(async (uploadFiles: File[]) => {
    if (serverIndex === null) return;
    for (const file of uploadFiles) {
      const reader = new FileReader();
      reader.onload = async () => {
        const base64 = (reader.result as string).split(",")[1];
        try {
          await callTool("b64_decode_to_file", {
            path: `${currentPath}/${file.name}`,
            data: base64,
          });
        } catch {}
      };
      reader.readAsDataURL(file);
    }
    // Refresh after upload
    setTimeout(() => loadDir(currentPath), 1000);
  }, [serverIndex, currentPath, loadDir]);

  const handleDelete = React.useCallback(async (path: string) => {
    if (serverIndex === null) return;
    try {
      await callTool("delete_file", { path });
      loadDir(currentPath);
    } catch {}
  }, [api, serverIndex, currentPath, loadDir]);

  const handleDownload = React.useCallback(async (path: string) => {
    if (serverIndex === null) return;
    try {
      const result = await callTool("read_file", { path });
      const text = result?.result ?? result?.content ?? result ?? "";
      const blob = new Blob([typeof text === "string" ? text : JSON.stringify(text)]);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = path.split("/").pop() ?? "download";
      a.click();
      URL.revokeObjectURL(url);
    } catch {}
  }, [serverIndex]);

  if (serverIndex === null) {
    return (
      <Card>
        <CardHeader><h1 className="text-xl font-semibold">File Browser</h1></CardHeader>
        <CardContent>
          <p className="text-muted-foreground">No file service connected. Add a file-service backend in External Services settings.</p>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-semibold">File Browser</h1>
            <div className="flex items-center gap-2">
              {profiles.length > 0 && (
                <Select
                  value={selectedProfile}
                  onChange={(event) => { setSelectedProfile(event.target.value); setCurrentPath("/"); }}
                >
                  {profiles.map((p) => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </Select>
              )}
              <span className="text-sm text-muted-foreground">via {servers.find(s => s.index === serverIndex)?.name ?? "file-mcp"}</span>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {error && <p className="text-sm text-destructive mb-3">{error}</p>}
          {loading ? (
            <div className="flex justify-center py-8"><Spinner /></div>
          ) : (
            <FileBrowser
              folders={folders}
              files={files}
              currentPath={currentPath}
              onNavigate={loadDir}
              onUpload={() => {
                if (readOnly) return;
                const input = document.createElement("input");
                input.type = "file";
                input.multiple = true;
                input.onchange = () => {
                  if (input.files) handleUpload(Array.from(input.files));
                };
                input.click();
              }}
              onDelete={readOnly ? undefined : handleDelete}
              onDownload={handleDownload}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Upload files</h2></CardHeader>
        <CardContent className="space-y-2">
          <p className="text-sm text-muted-foreground">
            {readOnly ? "Read-only access: uploads are disabled for your role." : `Drop files here to upload to ${currentPath}`}
          </p>
          <FileDropZone
            onDrop={readOnly ? () => {} : handleUpload}
            disabled={readOnly}
          />
        </CardContent>
      </Card>
    </div>
  );
}
