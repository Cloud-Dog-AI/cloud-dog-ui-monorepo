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

// @cloud-dog/app-git-mcp — Repository browser page for tree navigation, file viewing, and file operations.

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import {
  Badge,
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  DocumentViewer,
  EntityDialog,
  FolderTree,
  Input,
  JsonBlock,
  Label,
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
  Textarea,
  type DataColumn,
  type EntityFieldDef,
} from "@cloud-dog/ui";
import { useGitMcpState } from "../state/AppState";
import {
  buildFolderTree,
  filterEntriesForPath,
  joinRepoPath,
  normaliseRepoPath,
  repoBaseName,
  repoParentPath,
  type RepoDirEntry,
} from "../lib/gitUi";
import { getGitRoleAccess } from "../lib/rbac";
import { buildWorkspaceOpenArgs, useWorkspaceSession, WorkspaceSessionCard } from "./WorkspaceSessionCard";

type DialogState = Readonly<{
  mode: "create-file" | "create-folder" | "rename" | "copy";
  path: string;
  content: string;
}>;

const dialogFields: Record<DialogState["mode"], EntityFieldDef[]> = {
  "create-file": [
    { name: "path", label: "File path", type: "text", required: true },
    { name: "content", label: "Initial content", type: "textarea" },
  ],
  "create-folder": [{ name: "path", label: "Directory path", type: "text", required: true }],
  rename: [{ name: "path", label: "New path", type: "text", required: true }],
  copy: [{ name: "path", label: "Copy target path", type: "text", required: true }],
};

function downloadBase64(path: string, base64Content: string) {
  const binary = atob(base64Content);
  const bytes = Uint8Array.from(binary, (char) => char.charCodeAt(0));
  const blob = new Blob([bytes]);
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = repoBaseName(path);
  anchor.click();
  URL.revokeObjectURL(url);
}

export function RepositoryBrowserPage() {
  const app = useGitMcpState();
  const runApiTool = app.runApiTool;
  const auth = useAuth();
  const session = useWorkspaceSession("main");
  const access = getGitRoleAccess(auth.user?.roles);

  const [entries, setEntries] = React.useState<RepoDirEntry[]>([]);
  const [treeEntries, setTreeEntries] = React.useState<RepoDirEntry[]>([]);
  const [currentPath, setCurrentPath] = React.useState(".");
  const [selectedPath, setSelectedPath] = React.useState("");
  const [selectedContent, setSelectedContent] = React.useState("");
  const [editorContent, setEditorContent] = React.useState("");
  const [viewerTab, setViewerTab] = React.useState("preview");
  const [status, setStatus] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const [dialogState, setDialogState] = React.useState<DialogState>({ mode: "create-file", path: "", content: "" });

  const openWorkspace = React.useCallback(async () => {
    setError(null);
    const outcome = await runApiTool("repo_open", buildWorkspaceOpenArgs(session));
    if (!outcome.ok) {
      setError(outcome.errorMessage || "Failed to open workspace.");
      return;
    }
    setStatus(`Opened workspace ${String((outcome.data as Record<string, unknown>).workspace_id ?? "").trim()}.`);
  }, [runApiTool, session]);

  const loadTree = React.useCallback(async () => {
    if (!session.workspaceId) return;
    const outcome = await runApiTool("dir_list", {
      workspace_id: session.workspaceId,
      path: ".",
      recursive: true,
      include_hidden: false,
    });
    if (!outcome.ok) {
      setError(outcome.errorMessage || "Failed to load repository tree.");
      return;
    }
    setTreeEntries(Array.isArray((outcome.data as Record<string, unknown>).entries) ? ((outcome.data as Record<string, unknown>).entries as RepoDirEntry[]) : []);
  }, [runApiTool, session.workspaceId]);

  const loadDirectory = React.useCallback(async (path = currentPath, announce = true) => {
    if (!session.workspaceId) return;
    setError(null);
    const outcome = await runApiTool("dir_list", {
      workspace_id: session.workspaceId,
      path,
      recursive: false,
      include_hidden: false,
    });
    if (!outcome.ok) {
      setError(outcome.errorMessage || "Failed to list directory.");
      return;
    }
    setCurrentPath(normaliseRepoPath(path));
    setEntries(Array.isArray((outcome.data as Record<string, unknown>).entries) ? ((outcome.data as Record<string, unknown>).entries as RepoDirEntry[]) : []);
    if (announce) {
      setStatus(`Loaded ${normaliseRepoPath(path)}.`);
    }
  }, [currentPath, runApiTool, session.workspaceId]);

  const loadFile = React.useCallback(async (path: string) => {
    if (!session.workspaceId) return;
    setError(null);
    const outcome = await runApiTool("file_read", { workspace_id: session.workspaceId, path });
    if (!outcome.ok) {
      setError(outcome.errorMessage || `Failed to read ${path}.`);
      return;
    }
    const content = String((outcome.data as Record<string, unknown>).content ?? "");
    setSelectedPath(path);
    setSelectedContent(content);
    setEditorContent(content);
    setStatus(`Loaded ${path}.`);
  }, [runApiTool, session.workspaceId]);

  React.useEffect(() => {
    if (!session.workspaceId) return;
    void loadTree();
    void loadDirectory(currentPath, false);
  }, [currentPath, loadDirectory, loadTree, session.workspaceId]);

  const visibleEntries = React.useMemo(
    () => (entries.length ? entries : filterEntriesForPath(treeEntries, currentPath)),
    [currentPath, entries, treeEntries],
  );

  const folderTree = React.useMemo(() => buildFolderTree(treeEntries), [treeEntries]);

  const columns: DataColumn<RepoDirEntry>[] = [
    {
      id: "name",
      header: "Name",
      sortable: true,
      sortValue: (row) => row.path,
      cell: (row) => (
        <Button
          type="button"
          size="sm"
          variant="secondary"
          className="h-auto justify-start gap-2 px-2 py-1 text-left"
          onClick={() => {
            if (row.type === "dir") {
              void loadDirectory(normaliseRepoPath(row.path));
              return;
            }
            void loadFile(normaliseRepoPath(row.path));
          }}
        >
          <Badge variant={row.type === "dir" ? "default" : "secondary"}>{row.type}</Badge>
          <span>{repoBaseName(row.path)}</span>
        </Button>
      ),
    },
    { id: "path", header: "Path", sortable: true, sortValue: (row) => row.path, cell: (row) => row.path },
    { id: "type", header: "Type", sortable: true, sortValue: (row) => row.type, cell: (row) => <Badge variant={row.type === "dir" ? "default" : "secondary"}>{row.type}</Badge> },
    { id: "size", header: "Size", cell: () => <span className="text-sm text-muted-foreground">N/A</span> },
    { id: "updated", header: "Updated", cell: () => <span className="text-sm text-muted-foreground">N/A</span> },
    {
      id: "actions",
      header: "Actions",
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.type === "file" ? (
            <Button size="sm" variant="secondary" onClick={() => void loadFile(row.path)}>Open</Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={() => void loadDirectory(row.path)}>Browse</Button>
          )}
          {row.type === "file" ? (
            <Button
              size="sm"
              variant="secondary"
              onClick={async () => {
                const outcome = await runApiTool("file_download", { workspace_id: session.workspaceId, path: row.path });
                if (!outcome.ok) {
                  setError(outcome.errorMessage || `Failed to download ${row.path}.`);
                  return;
                }
                downloadBase64(row.path, String((outcome.data as Record<string, unknown>).base64_content ?? ""));
              }}
            >
              Download
            </Button>
          ) : null}
          {access.canWriteRepository ? (
            <>
              <Button size="sm" variant="secondary" onClick={() => { setDialogState({ mode: "rename", path: row.path, content: row.path }); setDialogOpen(true); }}>
                Rename
              </Button>
              {row.type === "file" ? (
                <Button size="sm" variant="secondary" onClick={() => { setDialogState({ mode: "copy", path: `${row.path}.copy`, content: row.path }); setDialogOpen(true); }}>
                  Copy
                </Button>
              ) : null}
              <Button
                size="sm"
                variant="destructive"
                onClick={async () => {
                  const toolName = row.type === "dir" ? "dir_rmdir" : "file_delete";
                  const args = row.type === "dir"
                    ? { workspace_id: session.workspaceId, path: row.path, recursive: true }
                    : { workspace_id: session.workspaceId, path: row.path };
                  const outcome = await runApiTool(toolName, args);
                  if (!outcome.ok) {
                    setError(outcome.errorMessage || `Failed to delete ${row.path}.`);
                    return;
                  }
                  setStatus(`Deleted ${row.path}.`);
                  if (selectedPath === row.path) {
                    setSelectedPath("");
                    setSelectedContent("");
                    setEditorContent("");
                  }
                  await loadTree();
                  await loadDirectory(currentPath, false);
                }}
              >
                Delete
              </Button>
            </>
          ) : null}
        </div>
      ),
    },
  ];

  const submitDialog = async () => {
    if (!session.workspaceId) {
      setError("Open a workspace first.");
      return;
    }
    setError(null);
    let outcome;
    if (dialogState.mode === "create-file") {
      outcome = await runApiTool("file_write", {
        workspace_id: session.workspaceId,
        path: dialogState.path,
        content: dialogState.content,
        overwrite: true,
      });
    } else if (dialogState.mode === "create-folder") {
      outcome = await runApiTool("dir_mkdir", {
        workspace_id: session.workspaceId,
        path: dialogState.path,
        parents: true,
      });
    } else if (dialogState.mode === "rename") {
      outcome = await runApiTool("file_move", {
        workspace_id: session.workspaceId,
        src: selectedPath || dialogState.content || "",
        dst: dialogState.path,
        overwrite: false,
      });
    } else {
      outcome = await runApiTool("file_copy", {
        workspace_id: session.workspaceId,
        src: dialogState.content,
        dst: dialogState.path,
        overwrite: false,
      });
    }
    if (!outcome.ok) {
      setError(outcome.errorMessage || "Repository operation failed.");
      return;
    }
    setDialogOpen(false);
    setStatus(`Completed ${dialogState.mode.replace("-", " ")}.`);
    await loadTree();
    await loadDirectory(currentPath, false);
  };

  const selectedInfo = React.useMemo(
    () => (selectedPath ? { path: selectedPath, bytes: selectedContent.length, parent: repoParentPath(selectedPath) } : null),
    [selectedContent.length, selectedPath],
  );

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <h1 className="text-2xl font-bold">Repository Browser</h1>
        {selectedPath ? <Badge variant="secondary">{selectedPath}</Badge> : null}
      </header>

      <WorkspaceSessionCard
        state={session}
        onOpenWorkspace={openWorkspace}
        status={status}
        error={error}
        title="Repository context"
        actions={
          <>
            <Button variant="secondary" onClick={() => void loadTree()} disabled={!session.workspaceId}>Refresh tree</Button>
            <Button variant="secondary" onClick={() => void loadDirectory(currentPath)} disabled={!session.workspaceId}>Refresh folder</Button>
            {access.canWriteRepository ? (
              <>
                <Button variant="secondary" onClick={() => { setDialogState({ mode: "create-file", path: joinRepoPath(currentPath, "new-file.txt"), content: "" }); setDialogOpen(true); }} disabled={!session.workspaceId}>
                  New file
                </Button>
                <Button variant="secondary" onClick={() => { setDialogState({ mode: "create-folder", path: joinRepoPath(currentPath, "new-folder"), content: "" }); setDialogOpen(true); }} disabled={!session.workspaceId}>
                  New folder
                </Button>
                <label className="inline-flex items-center gap-2">
                  <Label htmlFor="repository-upload" className="sr-only">Upload file</Label>
                  <Input
                    id="repository-upload"
                    type="file"
                    className="max-w-xs"
                    disabled={!session.workspaceId}
                    onChange={(event) => {
                      const file = event.target.files?.[0];
                      if (!file || !session.workspaceId) return;
                      const reader = new FileReader();
                      reader.onload = () => {
                        const result = String(reader.result ?? "");
                        const base64Content = result.includes(",") ? result.split(",").pop() ?? "" : result;
                        void (async () => {
                          const outcome = await runApiTool("file_upload", {
                            workspace_id: session.workspaceId,
                            path: joinRepoPath(currentPath, file.name),
                            base64_content: base64Content,
                            overwrite: true,
                          });
                          if (!outcome.ok) {
                            setError(outcome.errorMessage || `Failed to upload ${file.name}.`);
                            return;
                          }
                          setStatus(`Uploaded ${file.name}.`);
                          await loadTree();
                          await loadDirectory(currentPath, false);
                        })();
                      };
                      reader.readAsDataURL(file);
                    }}
                  />
                </label>
              </>
            ) : null}
          </>
        }
      />

      <div className="grid gap-6 xl:grid-cols-[0.8fr_1.2fr]">
        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Folder tree</h2>
          </CardHeader>
          <CardContent>
            <FolderTree
              folders={folderTree}
              selectedPath={currentPath}
              onSelect={(path) => {
                void loadDirectory(path);
              }}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">Current folder</h2>
              <div className="flex items-center gap-2 text-sm">
                <Button variant="secondary" size="sm" onClick={() => void loadDirectory(repoParentPath(currentPath))} disabled={currentPath === "."}>
                  Up
                </Button>
                <Badge>{currentPath}</Badge>
              </div>
            </div>
          </CardHeader>
          <CardContent>
            <DataTable
              tableId="git-mcp.repository-browser.columns"
              columns={columns}
              rows={visibleEntries}
              getRowId={(row) => row.path}
              emptyMessage="No files or folders found in this location."
              columnPickerEnabled={true}
            />
          </CardContent>
        </Card>
      </div>

      <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
        <Card>
          <CardHeader>
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-xl font-semibold">File viewer</h2>
              {selectedPath ? <Badge variant="secondary">{selectedPath}</Badge> : null}
            </div>
          </CardHeader>
          <CardContent className="space-y-4">
            {!selectedPath ? (
              <p className="text-sm text-muted-foreground">Select a file to preview or edit it.</p>
            ) : (
              <Tabs value={viewerTab} onValueChange={setViewerTab}>
                <TabsList>
                  <TabsTrigger value="preview">Preview</TabsTrigger>
                  <TabsTrigger value="editor">Editor</TabsTrigger>
                  <TabsTrigger value="raw">Raw JSON</TabsTrigger>
                </TabsList>
                <TabsContent value="preview">
                  <DocumentViewer
                    title={repoBaseName(selectedPath)}
                    content={selectedContent}
                    downloadFilename={repoBaseName(selectedPath)}
                    maxHeight="520px"
                  />
                </TabsContent>
                <TabsContent value="editor">
                  <div className="space-y-3">
                    <Label htmlFor="repository-editor">Inline editor</Label>
                    <Textarea
                      id="repository-editor"
                      rows={18}
                      value={editorContent}
                      onChange={(event) => setEditorContent(event.target.value)}
                      disabled={!access.canWriteRepository}
                    />
                    <div className="flex flex-wrap gap-2">
                      <Button
                        onClick={async () => {
                          const outcome = await runApiTool("file_write", {
                            workspace_id: session.workspaceId,
                            path: selectedPath,
                            content: editorContent,
                            overwrite: true,
                          });
                          if (!outcome.ok) {
                            setError(outcome.errorMessage || `Failed to save ${selectedPath}.`);
                            return;
                          }
                          setSelectedContent(editorContent);
                          setStatus(`Saved ${selectedPath}.`);
                          await loadTree();
                          await loadDirectory(currentPath, false);
                        }}
                        disabled={!access.canWriteRepository || !selectedPath || !session.workspaceId}
                      >
                        Save file
                      </Button>
                      <Button variant="secondary" onClick={() => setEditorContent(selectedContent)} disabled={!selectedPath}>
                        Reset editor
                      </Button>
                    </div>
                  </div>
                </TabsContent>
                <TabsContent value="raw">
                  <JsonBlock title="Selected file" value={{ path: selectedPath, content: selectedContent }} defaultCollapsed={false} />
                </TabsContent>
              </Tabs>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <h2 className="text-xl font-semibold">Selection summary</h2>
          </CardHeader>
          <CardContent>
            <JsonBlock title="Repository selection" value={selectedInfo ?? { path: currentPath, entries: visibleEntries.length }} defaultCollapsed={false} />
          </CardContent>
        </Card>
      </div>

      <EntityDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        title={dialogState.mode === "create-file"
          ? "Create file"
          : dialogState.mode === "create-folder"
            ? "Create folder"
            : dialogState.mode === "rename"
              ? "Rename path"
              : "Copy file"}
        fields={dialogFields[dialogState.mode]}
        values={dialogState}
        mode={dialogState.mode === "rename" || dialogState.mode === "copy" ? "edit" : "add"}
        onChange={(name, value) => setDialogState((current) => ({ ...current, [name]: String(value) }))}
        onSubmit={() => void submitDialog()}
        onCancel={() => setDialogOpen(false)}
      />
    </div>
  );
}
