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

// @cloud-dog/app-file-mcp — File browser page.

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { useSearchParams } from "react-router-dom";
import { File as FileIcon, Folder as FolderIcon, Grid3X3, List } from "lucide-react";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  DataTable,
  DocumentViewer,
  EntityDialog,
  FileBrowser,
  FileDropZone,
  FolderTree,
  Input,
  RelativeTime,
  SearchPanel,
  Select,
  Spinner,
  Textarea,
  type DataColumn,
  type EntityFieldDef,
  type EntityFormMode,
  type FileItem,
  type FolderNode,
} from "@cloud-dog/ui";
import type { BulkAction } from "@cloud-dog/ui";
import { canReadProfile, canWriteProfile } from "../lib/rbac";
import { useFileMcpState } from "../state/AppState";

type EntryRow = Readonly<{
  name: string;
  path: string;
  isDir: boolean;
  size: number | null;
  modifiedAt: string | null;
  createdAt: string | null;
  accessedAt: string | null;
  owner: string | null;
  extension: string;
}>;

type EntryDetail = Readonly<{
  path: string;
  is_dir: boolean;
  size: number | null;
  modified_at: string | null;
  created_at: string | null;
  accessed_at?: string | null;
  owner?: string | null;
}>;

type BreadcrumbItem = Readonly<{
  label: string;
  path: string;
}>;

function trimSlashes(value: string): string {
  return value.replace(/\/+$/, "");
}

function joinPath(base: string, leaf: string): string {
  const cleanLeaf = leaf.replace(/^\/+/, "");
  if (!base || base === ".") return cleanLeaf;
  return `${trimSlashes(base)}/${cleanLeaf}`;
}

function basename(path: string): string {
  const parts = path.split("/").filter(Boolean);
  return parts[parts.length - 1] ?? path;
}

function extensionOf(name: string, isDir: boolean): string {
  if (isDir) return "-";
  const index = name.lastIndexOf(".");
  if (index <= 0 || index === name.length - 1) return "(none)";
  return name.slice(index).toLowerCase();
}

function formatBytes(value: number | null): string {
  if (typeof value !== "number" || Number.isNaN(value)) return "-";
  if (value < 1024) return `${value} B`;
  const units = ["KB", "MB", "GB", "TB"];
  let amount = value / 1024;
  let unitIndex = 0;
  while (amount >= 1024 && unitIndex < units.length - 1) {
    amount /= 1024;
    unitIndex += 1;
  }
  return `${amount.toFixed(amount >= 10 ? 0 : 1)} ${units[unitIndex]}`;
}

function buildBreadcrumbs(path: string): BreadcrumbItem[] {
  const segments = path.split("/").filter(Boolean);
  if (!segments.length) {
    return [{ label: "root", path: "/" }];
  }
  return [
    { label: "root", path: "/" },
    ...segments.map((segment, index) => ({
      label: segment,
      path: `/${segments.slice(0, index + 1).join("/")}`,
    })),
  ];
}

type MutableFolderNode = {
  name: string;
  path: string;
  children: MutableFolderNode[];
};

function buildFolders(currentPath: string, entries: string[], details: EntryDetail[] = [], rootLabel?: string): FolderNode[] {
  const rootPath = currentPath.trim() || ".";
  const root: MutableFolderNode = {
    name: rootPath === "." ? (rootLabel || "workspace") : basename(rootPath) || "root",
    path: rootPath,
    children: [],
  };

  const folderMap = new Map<string, MutableFolderNode>();
  folderMap.set(root.path, root);

  const directoryPaths = details.length > 0 ? details.filter((entry) => entry.is_dir).map((entry) => entry.path) : entries;
  const seedPaths = directoryPaths.filter(Boolean);
  for (const itemPath of seedPaths) {
    const normalized = itemPath.replace(/\\/g, "/");
    const path = normalized || itemPath;
    if (!folderMap.has(path)) {
      const node: MutableFolderNode = { name: basename(path), path, children: [] };
      folderMap.set(path, node);
      if (!root.children.some((child) => child.path === path)) {
        root.children.push(node);
      }
    }
  }

  return [root];
}

export function FileBrowserPage() {
  const auth = useAuth();
  const {
    api,
    currentUser,
    defaultBrowsePath,
    availableProfiles,
    selectedProfile,
    setSelectedProfile,
  } = useFileMcpState();
  const [searchParams, setSearchParams] = useSearchParams();
  const browseRequestIdRef = React.useRef(0);

  // Honor ?profile= query parameter for deep-linking from Storage Profiles page
  React.useEffect(() => {
    const profileParam = searchParams.get("profile")?.trim();
    if (profileParam && profileParam !== selectedProfile) {
      const profileExists = availableProfiles.some((p) => p.name === profileParam);
      if (profileExists) {
        setSelectedProfile(profileParam);
      }
    }
  }, [searchParams, selectedProfile, setSelectedProfile, availableProfiles]);

  const [pathDraft, setPathDraft] = React.useState(searchParams.get("path") ?? defaultBrowsePath);
  const [entries, setEntries] = React.useState<string[]>([]);
  const [entryDetails, setEntryDetails] = React.useState<EntryDetail[]>([]);
  const [recursiveEntries, setRecursiveEntries] = React.useState<string[]>([]);
  const [fileText, setFileText] = React.useState("");
  const [newFileName, setNewFileName] = React.useState("example.txt");
  const [newFileText, setNewFileText] = React.useState("");
  const [newDirectory, setNewDirectory] = React.useState("new-folder");
  const [copyTarget, setCopyTarget] = React.useState("");
  const [moveTarget, setMoveTarget] = React.useState("");
  const [bulkMoveDestination, setBulkMoveDestination] = React.useState("");
  const [renameTarget, setRenameTarget] = React.useState("");
  const [status, setStatus] = React.useState("");
  const [activeFilePath, setActiveFilePath] = React.useState("");
  const [error, setError] = React.useState<string | null>(null);
  const [isLoading, setIsLoading] = React.useState(false);
  const [createDialogOpen, setCreateDialogOpen] = React.useState(false);
  const [deleteDialogPath, setDeleteDialogPath] = React.useState("");
  const [renameDialogOpen, setRenameDialogOpen] = React.useState(false);
  const [entryQuery, setEntryQuery] = React.useState("");
  const [entryPage, setEntryPage] = React.useState(1);
  const [entryPageSize, setEntryPageSize] = React.useState(10);
  const [viewMode, setViewMode] = React.useState<"list" | "grid">("list");

  const effectiveUser = currentUser ?? auth.user;
  const canReadCurrentProfile = canReadProfile(effectiveUser, selectedProfile);
  const canWriteCurrentProfile = canWriteProfile(effectiveUser, selectedProfile);

  const browse = React.useCallback(
    async (
      path: string,
      options?: {
        preserveSelection?: boolean;
        selectedFilePath?: string;
        selectedFileText?: string;
      }
    ) => {
      const target = path.trim() || defaultBrowsePath;
      const requestId = browseRequestIdRef.current + 1;
      browseRequestIdRef.current = requestId;
      setIsLoading(true);
      setError(null);

      try {
        const listed = await api.listDir(target, false);
        if (requestId !== browseRequestIdRef.current) {
          return;
        }
        setEntries(listed.entries);
        setEntryDetails(Array.isArray(listed.entry_details) ? listed.entry_details : []);
        setRecursiveEntries(listed.entries);
        setPathDraft(target);
        setBulkMoveDestination(target);
        if (!options?.preserveSelection) {
          setFileText("");
          setActiveFilePath("");
        } else if (options.selectedFilePath) {
          setActiveFilePath(options.selectedFilePath);
          if (typeof options.selectedFileText === "string") {
            setFileText(options.selectedFileText);
          }
        }
        setSearchParams({ path: target }, { replace: true });
      } catch (browseError) {
        if (requestId === browseRequestIdRef.current) {
          setError(browseError instanceof Error ? browseError.message : "Failed to browse directory.");
        }
      } finally {
        if (requestId === browseRequestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [api, defaultBrowsePath, setSearchParams]
  );

  const openPath = React.useCallback(
    async (path: string) => {
      browseRequestIdRef.current += 1;
      setError(null);
      setActiveFilePath(path);
      setCopyTarget(`${path}.copy`);
      setMoveTarget(`${path}.moved`);
      setRenameTarget(`${path}.renamed`);

      try {
        const text = await api.readFile(path);
        setFileText(text);
        setStatus("");
        return;
      } catch {
        // If not a file, try as directory.
      }

      try {
        const listed = await api.listDir(path, false);
        setEntries(listed.entries);
        setEntryDetails(Array.isArray(listed.entry_details) ? listed.entry_details : []);
        setRecursiveEntries(listed.entries);
        setPathDraft(path);
        setBulkMoveDestination(path);
        setActiveFilePath("");
        setFileText("");
        setSearchParams({ path }, { replace: true });
      } catch (openError) {
        setError(openError instanceof Error ? openError.message : "Failed to open path.");
      }
    },
    [api, setSearchParams]
  );

  const searchKey = searchParams.toString();
  const openedFileIndicator = activeFilePath || searchParams.get("file")?.trim() || "";

  React.useEffect(() => {
    const fromFile = searchParams.get("file")?.trim();
    const fromPath = searchParams.get("path")?.trim();

    if (fromFile) {
      if (fromFile === activeFilePath) return;
      void openPath(fromFile);
      return;
    }

    const targetPath = fromPath || defaultBrowsePath;
    if (targetPath === pathDraft && entries.length > 0) return;
    void browse(targetPath);
  }, [activeFilePath, browse, defaultBrowsePath, entries.length, openPath, pathDraft, searchKey]);

  const createDirectory = async () => {
    const dir = newDirectory.trim();
    if (!dir) return;

    const fullPath = joinPath(pathDraft, dir);
    try {
      await api.createDir(fullPath);
      await browse(pathDraft);
      setStatus(`Created directory: ${fullPath}`);
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create directory.");
    }
  };

  const createFile = async (): Promise<boolean> => {
    const filename = newFileName.trim();
    if (!filename) return false;

    const fullPath = joinPath(pathDraft, filename);
    try {
      await api.writeFile(fullPath, newFileText, true);
      setActiveFilePath(fullPath);
      setFileText(newFileText);
      setCopyTarget(`${fullPath}.copy`);
      setMoveTarget(`${fullPath}.moved`);
      setRenameTarget(`${fullPath}.renamed`);
      await browse(pathDraft, {
        preserveSelection: true,
        selectedFilePath: fullPath,
        selectedFileText: newFileText,
      });
      setStatus(`Created file: ${fullPath}`);
      return true;
    } catch (createError) {
      setError(createError instanceof Error ? createError.message : "Failed to create file.");
      return false;
    }
  };

  const saveFile = async () => {
    const target = activeFilePath;
    if (!target) return;

    try {
      await api.writeFile(target, fileText, true);
      await browse(pathDraft, {
        preserveSelection: true,
        selectedFilePath: target,
        selectedFileText: fileText,
      });
      setStatus(`Saved file: ${target}`);
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Failed to save file.");
    }
  };

  const deleteFilePath = async (path: string) => {
    if (!path) return;
    try {
      await api.deleteFile(path, true);
      if (activeFilePath === path) {
        setActiveFilePath("");
        setFileText("");
        setSearchParams({ path: pathDraft }, { replace: true });
      }
      await browse(pathDraft);
      setStatus(`Deleted file: ${path}`);
    } catch (deleteError) {
      setError(deleteError instanceof Error ? deleteError.message : "Failed to delete file.");
    }
  };

  const requestDeletePath = React.useCallback(
    (path: string) => {
      if (!canWriteCurrentProfile || !path) return;
      setDeleteDialogPath(path);
    },
    [canWriteCurrentProfile]
  );

  const copyFile = async () => {
    const source = activeFilePath;
    if (!source || !copyTarget.trim()) return;

    try {
      const target = copyTarget.trim();
      await api.copyFile(source, target, true);
      await browse(pathDraft, { preserveSelection: true });
      setStatus(`Copied file to: ${target}`);
    } catch (copyError) {
      setError(copyError instanceof Error ? copyError.message : "Failed to copy file.");
    }
  };

  const moveFile = async () => {
    const source = activeFilePath;
    if (!source || !moveTarget.trim()) return;

    try {
      const target = moveTarget.trim();
      await api.moveFile(source, target, true);
      setActiveFilePath(target);
      setCopyTarget(`${target}.copy`);
      setMoveTarget(`${target}.moved`);
      setRenameTarget(`${target}.renamed`);
      await browse(pathDraft, {
        preserveSelection: true,
        selectedFilePath: target,
        selectedFileText: fileText,
      });
      setStatus(`Moved file to: ${target}`);
    } catch (moveError) {
      setError(moveError instanceof Error ? moveError.message : "Failed to move file.");
    }
  };

  const uploadFiles = async (files: File[]) => {
    if (files.length === 0) return;
    try {
      for (const file of files) {
        const text = await file.text();
        const fullPath = joinPath(pathDraft, file.name);
        await api.writeFile(fullPath, text, true);
      }
      await browse(pathDraft);
      setStatus(`Uploaded ${files.length} file${files.length === 1 ? "" : "s"}.`);
    } catch (uploadError) {
      setError(uploadError instanceof Error ? uploadError.message : "Failed to upload file(s).");
    }
  };

  const downloadText = (path: string, text: string) => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = basename(path);
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const downloadPath = async (path: string) => {
    if (!path) return;
    try {
      const text = path === activeFilePath ? fileText : await api.readFile(path);
      downloadText(path, text);
      setStatus(`Downloaded file: ${path}`);
    } catch (downloadError) {
      setError(downloadError instanceof Error ? downloadError.message : "Failed to download file.");
    }
  };

  const renameSelectedPath = async (targetPath: string): Promise<boolean> => {
    const source = activeFilePath;
    if (!source || !targetPath.trim()) return false;
    const trimmedTarget = targetPath.trim();
    try {
      await api.renamePath(source, trimmedTarget, true);
      setActiveFilePath(trimmedTarget);
      setMoveTarget(trimmedTarget);
      setCopyTarget(`${trimmedTarget}.copy`);
      setRenameTarget(`${trimmedTarget}.renamed`);
      await browse(pathDraft, {
        preserveSelection: true,
        selectedFilePath: trimmedTarget,
        selectedFileText: fileText,
      });
      setStatus(`Renamed path to: ${trimmedTarget}`);
      return true;
    } catch (renameError) {
      setError(renameError instanceof Error ? renameError.message : "Failed to rename path.");
      return false;
    }
  };

  const entryDetailByPath = React.useMemo(() => {
    const byPath = new Map<string, EntryDetail>();
    for (const detail of entryDetails) {
      byPath.set(detail.path, detail);
    }
    return byPath;
  }, [entryDetails]);

  const entryRows: EntryRow[] = entries.map((path) => {
    const detail = entryDetailByPath.get(path);
    const name = basename(path);
    return {
      name,
      path,
      isDir: detail?.is_dir ?? false,
      size: detail?.size ?? null,
      modifiedAt: detail?.modified_at ?? null,
      createdAt: detail?.created_at ?? null,
      accessedAt: detail?.accessed_at ?? null,
      owner: detail?.owner ?? null,
      extension: extensionOf(name, detail?.is_dir ?? false),
    };
  });

  const entryColumns: DataColumn<EntryRow>[] = [
    {
      id: "icon",
      header: "",
      cell: (row) =>
        row.isDir ? (
          <FolderIcon aria-label="Directory" className="h-4 w-4 text-amber-600" />
        ) : (
          <FileIcon aria-label={`File ${row.extension}`} className="h-4 w-4 text-sky-700" />
        ),
      sortValue: (row) => (row.isDir ? "0" : `1-${row.extension}`),
    },
    {
      id: "name",
      header: "Name",
      cell: (row) => row.name,
      sortable: true,
      sortValue: (row) => row.name,
    },
    {
      id: "path",
      header: "Path",
      cell: (row) => <span className="font-mono text-xs break-all">{row.path}</span>,
      sortable: true,
      sortValue: (row) => row.path,
    },
    {
      id: "type",
      header: "Type",
      cell: (row) => (row.isDir ? "Directory" : "File"),
      sortable: true,
      sortValue: (row) => (row.isDir ? "directory" : "file"),
    },
    {
      id: "extension",
      header: "Extension",
      cell: (row) => row.extension,
      sortable: true,
      sortValue: (row) => row.extension,
    },
    {
      id: "size",
      header: "Size",
      cell: (row) => formatBytes(row.size),
      sortable: true,
      sortValue: (row) => row.size ?? -1,
    },
    {
      id: "modified",
      header: "Modified",
      cell: (row) => (row.modifiedAt ? <RelativeTime timestamp={row.modifiedAt} /> : "-"),
      sortable: true,
      sortValue: (row) => (row.modifiedAt ? new Date(row.modifiedAt).getTime() : 0),
    },
    {
      id: "accessed",
      header: "Accessed",
      cell: (row) => (row.accessedAt ? <RelativeTime timestamp={row.accessedAt} /> : "-"),
      sortable: true,
      sortValue: (row) => (row.accessedAt ? new Date(row.accessedAt).getTime() : 0),
    },
    {
      id: "created",
      header: "Created",
      cell: (row) => (row.createdAt ? <RelativeTime timestamp={row.createdAt} /> : "-"),
      sortable: true,
      sortValue: (row) => (row.createdAt ? new Date(row.createdAt).getTime() : 0),
    },
    {
      id: "owner",
      header: "Owner",
      cell: (row) => row.owner ?? "-",
      sortable: true,
      sortValue: (row) => row.owner ?? "",
    },
    {
      id: "action",
      header: "Action",
      cell: (row) => (
        <div className="flex gap-2">
          <Button size="sm" variant="secondary" onClick={() => void openPath(row.path)}>
            Open
          </Button>
          {canWriteCurrentProfile ? (
            <Button size="sm" variant="destructive" onClick={() => requestDeletePath(row.path)}>
              Delete
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  React.useEffect(() => {
    setEntryPage(1);
  }, [entryQuery]);

  const filteredEntryRows = React.useMemo(() => {
    const trimmed = entryQuery.trim().toLowerCase();
    if (!trimmed) return entryRows;
    return entryRows.filter((row) => `${row.name} ${row.path}`.toLowerCase().includes(trimmed));
  }, [entryQuery, entryRows]);

  const entryBulkActions = React.useMemo<BulkAction[]>(
    () => [
      { label: "Download selected", action: "download" },
      ...(canWriteCurrentProfile
        ? [
            { label: "Delete selected", action: "delete" },
            { label: "Move selected", action: "move" },
          ]
        : []),
    ],
    [canWriteCurrentProfile]
  );

  const onEntryBulkAction = React.useCallback(
    (action: string, selectedIds: string[]) => {
      const rows = filteredEntryRows.filter((row) => selectedIds.includes(row.path));
      if (action === "delete") {
        if (!canWriteCurrentProfile) {
          setError("Write access is required to delete files.");
          return;
        }
        void (async () => {
          for (const row of rows) {
            await deleteFilePath(row.path);
          }
        })();
        return;
      }
      if (action === "download") {
        void (async () => {
          for (const row of rows) {
            if (!row.isDir) {
              await downloadPath(row.path);
            }
          }
        })();
        return;
      }
      if (action === "move") {
        if (!canWriteCurrentProfile) {
          setError("Write access is required to move files.");
          return;
        }
        void (async () => {
          const destination = bulkMoveDestination.trim();
          if (!destination) {
            setError("Bulk move destination path is required.");
            return;
          }
          try {
            for (const row of rows) {
              const target = joinPath(destination, basename(row.path));
              await api.moveFile(row.path, target, true);
            }
            await browse(pathDraft);
            setStatus(`Moved ${rows.length} entr${rows.length === 1 ? "y" : "ies"} to: ${destination}`);
          } catch (moveError) {
            setError(moveError instanceof Error ? moveError.message : "Failed to move selected entries.");
          }
        })();
      }
    },
    [api, browse, bulkMoveDestination, canWriteCurrentProfile, deleteFilePath, downloadPath, filteredEntryRows, pathDraft]
  );

  const createDialogFields: EntityFieldDef[] = [
    { name: "newFileName", label: "New file name", type: "text", required: true },
    { name: "newFileText", label: "New file content", type: "text" },
  ];

  const renameDialogFields: EntityFieldDef[] = [
    { name: "sourcePath", label: "Source path", type: "text", readOnly: true },
    { name: "targetPath", label: "Target path", type: "text", required: true },
  ];

  const createDialogValues: Record<string, unknown> = {
    newFileName,
    newFileText,
  };
  const renameDialogValues: Record<string, unknown> = {
    sourcePath: activeFilePath,
    targetPath: renameTarget,
  };
  const createDialogMode: EntityFormMode = "add";
  const renameDialogMode: EntityFormMode = "edit";

  const browserFiles: FileItem[] = entryRows.map((row) => ({
    name: row.name,
    path: row.path,
  }));

  const breadcrumbs = buildBreadcrumbs(pathDraft);
  const selectedProfileMeta = availableProfiles.find((profile) => profile.name === selectedProfile);
  const profileRootLabel = selectedProfileMeta?.backend === "google-drive" || selectedProfileMeta?.backend === "google_drive"
    ? "Google Drive"
    : selectedProfileMeta?.backend === "s3"
      ? "S3"
      : selectedProfileMeta?.backend === "webdav"
        ? "WebDAV"
        : selectedProfileMeta?.backend === "ftp"
          ? "FTP"
          : "workspace";
  const folderTree = buildFolders(pathDraft, recursiveEntries, entryDetails, profileRootLabel);

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-center justify-between gap-2">
        <h1 className="text-2xl font-semibold">File Browser</h1>
        <div className="flex flex-wrap gap-2">
          {canWriteCurrentProfile ? (
            <>
              <Button
                variant="secondary"
                onClick={() => {
                  setCreateDialogOpen(true);
                }}
              >
                Add file
              </Button>
              <Button
                variant="secondary"
                disabled={!activeFilePath}
                onClick={() => {
                  setRenameTarget(activeFilePath ? `${activeFilePath}.renamed` : "");
                  setRenameDialogOpen(true);
                }}
              >
                Rename selected
              </Button>
            </>
          ) : null}
        </div>
      </header>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Location</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          {availableProfiles.length > 0 ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[12rem]">
                <label htmlFor="profile-select" className="text-sm font-medium">
                  Storage profile
                </label>
                <Select
                  id="profile-select"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm"
                  value={selectedProfile}
                  onChange={(event) => setSelectedProfile(event.target.value)}
                >
                  {availableProfiles.map((p) => (
                    <option key={p.name} value={p.name}>{p.name} ({p.backend})</option>
                  ))}
                </Select>
              </div>
              {selectedProfileMeta ? (
                <p className="text-xs text-muted-foreground">
                  Active root: <code>{selectedProfileMeta.roots[0] || defaultBrowsePath}</code>
                </p>
              ) : null}
              {!canReadCurrentProfile ? (
                <p role="alert" className="text-xs text-destructive">
                  The current session does not have read access to profile <code>{selectedProfile}</code>.
                </p>
              ) : null}
              {canReadCurrentProfile && !canWriteCurrentProfile ? (
                <p className="text-xs text-muted-foreground">
                  Read-only mode: upload, create, rename, move, copy, and delete actions are hidden for this profile.
                </p>
              ) : null}
            </div>
          ) : null}

          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[20rem] flex-1">
              <label htmlFor="browser-path" className="text-sm font-medium">
                Current path
              </label>
              <Input id="browser-path" value={pathDraft} onChange={(event) => setPathDraft(event.target.value)} />
            </div>
            <Button onClick={() => void browse(pathDraft)}>Browse path</Button>
            <Button variant="secondary" onClick={() => void browse(pathDraft)}>
              Refresh
            </Button>
          </div>

          {canWriteCurrentProfile ? (
            <div className="flex flex-wrap items-end gap-2">
              <div className="min-w-[16rem] flex-1">
                <label htmlFor="new-directory" className="text-sm font-medium">
                  Create directory
                </label>
                <Input
                  id="new-directory"
                  value={newDirectory}
                  onChange={(event) => setNewDirectory(event.target.value)}
                  placeholder="new-folder"
                />
              </div>
              <Button variant="secondary" onClick={() => void createDirectory()}>
                Create directory
              </Button>
            </div>
          ) : null}

          {isLoading ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status" aria-live="polite">
              <Spinner className="h-5 w-5" />
              Loading directory...
            </div>
          ) : null}
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
          {openedFileIndicator ? (
            <p className="text-sm text-foreground/80">
              <span>Opened file:</span> <span>{openedFileIndicator}</span>
            </p>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">File workspace</h2>
        </CardHeader>
        <CardContent className="space-y-4">
          {canWriteCurrentProfile ? (
            <FileDropZone
              onDrop={(files) => {
                void uploadFiles(files);
              }}
              accept=".txt,.md,.json,.yaml,.yml,.xml,.html,.csv,.log,.py,.ts,.tsx,.js,.jsx"
              label="Upload file"
              description={`Files are uploaded to ${pathDraft}.`}
              testId="file-mcp-file-drop-zone"
            />
          ) : null}

          <div
            aria-label="File path breadcrumbs"
            className="flex flex-wrap items-center gap-1 rounded-md border bg-muted/20 px-3 py-2 text-sm"
          >
            <span className="mr-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Path
            </span>
            {breadcrumbs.map((crumb, index) => (
              <React.Fragment key={crumb.path}>
                {index > 0 ? <span className="text-muted-foreground">/</span> : null}
                <Button
                  type="button"
                  className="text-primary hover:underline"
                  onClick={() => {
                    setPathDraft(crumb.path);
                    void browse(crumb.path);
                  }}
                >
                  {crumb.label}
                </Button>
              </React.Fragment>
            ))}
          </div>

          <div className="grid gap-4 xl:grid-cols-[18rem_minmax(0,1fr)]">
            <Card>
              <CardHeader>
                <h3 className="text-lg font-semibold">Folder Tree</h3>
              </CardHeader>
              <CardContent>
                <FolderTree
                  folders={folderTree}
                  selectedPath={pathDraft}
                  onSelect={(path) => {
                    setPathDraft(path);
                    void browse(path);
                  }}
                />
              </CardContent>
            </Card>
            <div className="space-y-4">
              <p className="text-xs text-muted-foreground">
                The shared file browser remains the main workspace surface for browsing, downloads, and quick deletes.
              </p>
              <FileBrowser
                folders={folderTree}
                files={browserFiles}
                currentPath={pathDraft}
                showBreadcrumb={false}
                loading={isLoading}
                errorMessage={error}
                statusMessage={status}
                readOnly={!canWriteCurrentProfile}
                selectedPath={activeFilePath}
                onNavigate={(path) => {
                  setPathDraft(path);
                  void browse(path);
                }}
                onOpen={(path) => {
                  void openPath(path);
                }}
                onDelete={canWriteCurrentProfile ? requestDeletePath : undefined}
                onDownload={(path) => {
                  void downloadPath(path);
                }}
                onCreateFolder={canWriteCurrentProfile ? () => {
                  void createDirectory();
                } : undefined}
                onRefresh={() => void browse(pathDraft)}
              />
            </div>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Bulk actions</h2>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-end">
            <div>
              <label htmlFor="bulk-move-destination" className="text-sm font-medium">
                Move selected destination path
              </label>
              <Input
                id="bulk-move-destination"
                value={bulkMoveDestination}
                onChange={(event) => setBulkMoveDestination(event.target.value)}
                aria-label="Move selected destination path"
                disabled={!canWriteCurrentProfile}
              />
            </div>
            <Button
              variant="secondary"
              onClick={() => setBulkMoveDestination(pathDraft)}
              disabled={!canWriteCurrentProfile}
            >
              Use current path
            </Button>
          </div>
        </CardContent>
      </Card>

      <SearchPanel
        title="Catalogue"
        description="Browse and search files and folders for the selected storage profile."
        filters={[]}
        query={entryQuery}
        onQueryChange={setEntryQuery}
        onSearch={(nextQuery) => setEntryQuery(nextQuery)}
        onClear={() => setEntryQuery("")}
        queryLabel="Search"
        queryAriaLabel="Search entries"
        placeholder="Search entries"
        loading={isLoading && entryRows.length === 0 && !entryQuery.trim()}
        loadingLabel="Loading entries"
        status={`${filteredEntryRows.length} catalogue entries visible`}
        resultsLabel="Catalogue entries"
        emptyMessage="No catalogue entries found."
        headerActions={
          <>
              <div className="flex rounded-md border p-1" aria-label="Entry view mode">
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === "list" ? "default" : "ghost"}
                  onClick={() => setViewMode("list")}
                  aria-pressed={viewMode === "list"}
                >
                  <List aria-hidden="true" className="mr-1 h-4 w-4" />
                  List
                </Button>
                <Button
                  type="button"
                  size="sm"
                  variant={viewMode === "grid" ? "default" : "ghost"}
                  onClick={() => setViewMode("grid")}
                  aria-pressed={viewMode === "grid"}
                >
                  <Grid3X3 aria-hidden="true" className="mr-1 h-4 w-4" />
                  Grid
                </Button>
              </div>
              <Button variant="secondary" onClick={() => void browse(pathDraft)}>Refresh</Button>
          </>
        }
        results={
          viewMode === "grid" ? (
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {filteredEntryRows.length ? (
                filteredEntryRows.map((row) => (
                  <button
                    type="button"
                    key={row.path}
                    className="rounded-lg border bg-card p-4 text-left shadow-sm transition hover:border-primary hover:shadow-md"
                    onClick={() => void openPath(row.path)}
                  >
                    <div className="flex items-start gap-3">
                      {row.isDir ? (
                        <FolderIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
                      ) : (
                        <FileIcon aria-hidden="true" className="mt-0.5 h-5 w-5 shrink-0 text-sky-700" />
                      )}
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="truncate font-medium">{row.name}</div>
                        <div className="text-xs text-muted-foreground">{row.isDir ? "Directory" : `${row.extension} file`}</div>
                        <div className="text-xs text-muted-foreground">Size: {formatBytes(row.size)}</div>
                        <div className="text-xs text-muted-foreground">Owner: {row.owner ?? "-"}</div>
                        <div className="truncate font-mono text-[11px] text-muted-foreground">{row.path}</div>
                      </div>
                    </div>
                  </button>
                ))
              ) : (
                <p className="text-sm text-muted-foreground">No entries for this path.</p>
              )}
            </div>
          ) : (
            <DataTable
              tableId="file-mcp-browser-entries"
              columns={entryColumns}
              rows={filteredEntryRows}
              totalRows={entryRows.length}
              getRowId={(row) => row.path}
              emptyMessage="No entries for this path."
              page={entryPage}
              onPageChange={setEntryPage}
              pageSize={entryPageSize}
              onPageSizeChange={setEntryPageSize}
              selectable={canReadCurrentProfile}
              bulkActions={entryBulkActions}
              onBulkAction={onEntryBulkAction}
              columnPickerEnabled={true}
            />
          )
        }
      />

      {canWriteCurrentProfile ? (
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Create file</h2>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label htmlFor="new-file-name" className="text-sm font-medium">
                  New file name
                </label>
                <Input
                  id="new-file-name"
                  value={newFileName}
                  onChange={(event) => setNewFileName(event.target.value)}
                  placeholder="example.txt"
                />
              </div>
            </div>

            <div>
              <label htmlFor="new-file-content" className="text-sm font-medium">
                New file content
              </label>
              <Textarea
                id="new-file-content"
                value={newFileText}
                onChange={(event) => setNewFileText(event.target.value)}
                rows={6}
              />
            </div>

            <Button onClick={() => void createFile()}>Create file</Button>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Selected file</h2>
        </CardHeader>
        <CardContent className="space-y-3">
          <div>
            <label htmlFor="selected-file-path" className="text-sm font-medium">
              Selected file path
            </label>
            <Input id="selected-file-path" value={activeFilePath} readOnly aria-label="Selected file path" />
          </div>

          <div>
            <label htmlFor="selected-file-editor" className="text-sm font-medium">
              Inline editor
            </label>
            <Textarea
              id="selected-file-editor"
              value={fileText}
              onChange={(event) => setFileText(event.target.value)}
              rows={10}
              aria-label="Inline editor"
              readOnly={!canWriteCurrentProfile}
            />
          </div>

          <DocumentViewer
            title="File preview"
            content={fileText || "No file selected."}
            downloadFilename={activeFilePath ? activeFilePath.split("/").pop() || "selected-file.txt" : undefined}
          />

          <div className="flex flex-wrap gap-2">
            {canWriteCurrentProfile ? (
              <Button onClick={() => void saveFile()} disabled={!activeFilePath}>
                Save file
              </Button>
            ) : null}
            <Button variant="secondary" onClick={() => void downloadPath(activeFilePath)} disabled={!activeFilePath}>
              Download
            </Button>
            {canWriteCurrentProfile ? (
              <>
                <Button
                  variant="secondary"
                  onClick={() => {
                    setRenameTarget(activeFilePath ? `${activeFilePath}.renamed` : "");
                    setRenameDialogOpen(true);
                  }}
                  disabled={!activeFilePath}
                >
                  Rename
                </Button>
                <Button variant="destructive" onClick={() => requestDeletePath(activeFilePath)} disabled={!activeFilePath}>
                  Delete file
                </Button>
              </>
            ) : null}
          </div>

          {canWriteCurrentProfile ? (
            <>
              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-end">
                <div>
                  <label htmlFor="copy-target" className="text-sm font-medium">
                    Copy destination path
                  </label>
                  <Input
                    id="copy-target"
                    value={copyTarget}
                    onChange={(event) => setCopyTarget(event.target.value)}
                    aria-label="Copy destination path"
                  />
                </div>
                <Button variant="secondary" onClick={() => void copyFile()} disabled={!activeFilePath || !copyTarget.trim()}>
                  Copy file
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-2 items-end">
                <div>
                  <label htmlFor="move-target" className="text-sm font-medium">
                    Move destination path
                  </label>
                  <Input
                    id="move-target"
                    value={moveTarget}
                    onChange={(event) => setMoveTarget(event.target.value)}
                    aria-label="Move destination path"
                  />
                </div>
                <Button variant="secondary" onClick={() => void moveFile()} disabled={!activeFilePath || !moveTarget.trim()}>
                  Move file
                </Button>
              </div>
            </>
          ) : null}
        </CardContent>
      </Card>

      <EntityDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        title="Add file"
        mode={createDialogMode}
        fields={createDialogFields}
        values={createDialogValues}
        onChange={(name, value) => {
          if (name === "newFileName") {
            setNewFileName(String(value ?? ""));
            return;
          }
          if (name === "newFileText") {
            setNewFileText(String(value ?? ""));
          }
        }}
        onSubmit={() => {
          void createFile().then((saved) => {
            if (saved) {
              setCreateDialogOpen(false);
            }
          });
        }}
        onCancel={() => setCreateDialogOpen(false)}
      />

      <EntityDialog
        open={Boolean(deleteDialogPath)}
        onOpenChange={(open) => {
          if (!open) {
            setDeleteDialogPath("");
          }
        }}
        title="Confirm delete"
        body={
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">
              Are you sure you want to delete <code>{basename(deleteDialogPath)}</code>?
            </p>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="destructive"
                onClick={() => {
                  const target = deleteDialogPath;
                  setDeleteDialogPath("");
                  void deleteFilePath(target);
                }}
              >
                Delete
              </Button>
              <Button variant="secondary" onClick={() => setDeleteDialogPath("")}>
                Cancel
              </Button>
            </div>
          </div>
        }
      />

      <EntityDialog
        open={renameDialogOpen}
        onOpenChange={setRenameDialogOpen}
        title="Rename path"
        mode={renameDialogMode}
        fields={renameDialogFields}
        values={renameDialogValues}
        onChange={(name, value) => {
          if (name === "targetPath") {
            setRenameTarget(String(value ?? ""));
          }
        }}
        onSubmit={() => {
          void renameSelectedPath(renameTarget).then((saved) => {
            if (saved) {
              setRenameDialogOpen(false);
            }
          });
        }}
        onCancel={() => setRenameDialogOpen(false)}
      />
    </div>
  );
}
