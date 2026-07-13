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

// @cloud-dog/ui — FileBrowser pattern (responsive file browser / artefact browser).

import * as React from "react";
import {
  AlertTriangle,
  Download,
  File as FileIcon,
  Folder,
  FolderPlus,
  RefreshCw,
  Trash2,
  Upload,
} from "lucide-react";
import { cn } from "../utils/cn";
import { Button } from "../components/button/Button";
import { ConfirmDialog } from "../components/dialog/ConfirmDialog";
import { Spinner } from "../components/feedback/Spinner";
import { FolderTree } from "./FolderTree";
import type { FolderNode } from "./FolderTree";

export type FileItemKind = "file" | "directory" | "artifact";

export type FileItem = Readonly<{
  name: string;
  path: string;
  size?: string;
  modified?: string;
  kind?: FileItemKind;
  contentType?: string;
  status?: string;
  disabled?: boolean;
  testId?: string;
}>;

export type FileBrowserFileAction = Readonly<{
  id: string;
  label: string;
  onClick: (file: FileItem) => void;
  destructive?: boolean;
  disabled?: boolean | ((file: FileItem) => boolean);
}>;

export type FileBrowserDeleteConfirmation = Readonly<{
  enabled?: boolean;
  title?: string;
  description?: string;
  confirmLabel?: string;
}>;

export type FileBrowserProps = Readonly<{
  folders: FolderNode[];
  files: FileItem[];
  currentPath: string;
  showBreadcrumb?: boolean;
  onNavigate: (path: string) => void;
  onOpen?: (path: string) => void;
  onUpload?: () => void;
  onDelete?: (path: string) => void;
  onDownload?: (path: string) => void;
  onCreateFolder?: () => void;
  onRefresh?: () => void;
  getFileActions?: (file: FileItem) => readonly FileBrowserFileAction[];
  className?: string;
  ariaLabel?: string;
  rootLabel?: string;
  filesLabel?: string;
  emptyMessage?: string;
  loading?: boolean;
  loadingMessage?: string;
  errorMessage?: string | null;
  statusMessage?: string | null;
  disabled?: boolean;
  readOnly?: boolean;
  selectedPath?: string;
  deleteConfirmation?: FileBrowserDeleteConfirmation;
  testId?: string;
}>;

function pathSegments(path: string): string[] {
  return path.split("/").filter(Boolean);
}

function fileKind(file: FileItem): FileItemKind {
  if (file.kind) return file.kind;
  return file.path.endsWith("/") ? "directory" : "file";
}

function actionDisabled(action: FileBrowserFileAction, file: FileItem): boolean {
  return typeof action.disabled === "function" ? action.disabled(file) : action.disabled ?? false;
}

export function FileBrowser(props: FileBrowserProps) {
  const {
    ariaLabel = "File browser",
    rootLabel = "root",
    filesLabel = "Files",
    emptyMessage = "No files for this path.",
    loadingMessage = "Loading files...",
    deleteConfirmation,
  } = props;
  const segments = pathSegments(props.currentPath);
  const isDisabled = props.disabled || props.loading;
  const [pendingDelete, setPendingDelete] = React.useState<FileItem | null>(null);

  const requestDelete = React.useCallback(
    (file: FileItem) => {
      if (!props.onDelete || props.readOnly || file.disabled) return;
      if (deleteConfirmation?.enabled) {
        setPendingDelete(file);
        return;
      }
      props.onDelete(file.path);
    },
    [deleteConfirmation?.enabled, props],
  );

  const confirmDelete = React.useCallback(() => {
    const target = pendingDelete;
    if (!target || !props.onDelete) return;
    setPendingDelete(null);
    props.onDelete(target.path);
  }, [pendingDelete, props]);

  return (
    <section
      role="region"
      aria-label={ariaLabel}
      aria-busy={props.loading || undefined}
      data-testid={props.testId ?? "file-browser"}
      className={cn("overflow-hidden rounded-md border bg-background", props.className)}
    >
      <div className="grid min-h-[18rem] grid-cols-1 md:grid-cols-[16rem_minmax(0,1fr)]">
        <aside className="min-w-0 border-b p-2 md:border-b-0 md:border-r" aria-label="Folder panel">
          {props.folders.length > 0 ? (
            <FolderTree
              folders={props.folders}
              selectedPath={props.currentPath}
              onSelect={(path) => {
                if (!isDisabled) props.onNavigate(path);
              }}
              className="max-h-64 md:max-h-[32rem]"
            />
          ) : (
            <p className="px-2 py-3 text-sm text-muted-foreground">No folders.</p>
          )}
        </aside>

        <div className="min-w-0">
          {props.showBreadcrumb !== false ? (
            <nav
              className="flex min-h-11 flex-wrap items-center gap-1 border-b px-3 py-2 text-sm"
              aria-label="File path breadcrumbs"
            >
              <button
                type="button"
                className="rounded-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:text-muted-foreground"
                disabled={isDisabled}
                onClick={() => props.onNavigate("/")}
              >
                {rootLabel}
              </button>
              {segments.map((segment, index) => {
                const path = "/" + segments.slice(0, index + 1).join("/");
                return (
                  <React.Fragment key={path}>
                    <span className="text-muted-foreground">/</span>
                    <button
                      type="button"
                      className="rounded-sm text-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:pointer-events-none disabled:text-muted-foreground"
                      disabled={isDisabled}
                      onClick={() => props.onNavigate(path)}
                    >
                      {segment}
                    </button>
                  </React.Fragment>
                );
              })}
            </nav>
          ) : null}

          <div className="flex min-h-12 flex-wrap items-center justify-between gap-2 border-b px-3 py-2">
            <div className="min-w-0 text-sm">
              <span className="font-medium">{props.currentPath || rootLabel}</span>
              {props.statusMessage ? (
                <span className="ml-2 text-muted-foreground">{props.statusMessage}</span>
              ) : null}
              {props.readOnly ? (
                <span className="ml-2 text-muted-foreground">Read-only</span>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {props.onUpload ? (
                <Button variant="secondary" size="sm" disabled={isDisabled || props.readOnly} onClick={props.onUpload}>
                  <Upload aria-hidden="true" className="h-4 w-4" />
                  Upload
                </Button>
              ) : null}
              {props.onCreateFolder ? (
                <Button variant="secondary" size="sm" disabled={isDisabled || props.readOnly} onClick={props.onCreateFolder}>
                  <FolderPlus aria-hidden="true" className="h-4 w-4" />
                  New folder
                </Button>
              ) : null}
              {props.onRefresh ? (
                <Button variant="secondary" size="sm" disabled={isDisabled} onClick={props.onRefresh}>
                  <RefreshCw aria-hidden="true" className="h-4 w-4" />
                  Refresh
                </Button>
              ) : null}
            </div>
          </div>

          {props.errorMessage ? (
            <div className="flex items-start gap-2 border-b px-3 py-3 text-sm text-destructive" role="alert">
              <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0" />
              <span>{props.errorMessage}</span>
            </div>
          ) : null}

          {props.loading ? (
            <div className="flex min-h-32 items-center justify-center gap-2 px-3 py-8 text-sm text-muted-foreground" role="status" aria-live="polite">
              <Spinner className="h-4 w-4" />
              {loadingMessage}
            </div>
          ) : (
            <ul className="divide-y" aria-label={filesLabel}>
              {props.files.length === 0 ? (
                <li className="px-3 py-6 text-sm text-muted-foreground">{emptyMessage}</li>
              ) : (
                props.files.map((file) => {
                  const kind = fileKind(file);
                  const selected = props.selectedPath === file.path;
                  const extraActions = props.getFileActions?.(file) ?? [];
                  return (
                    <li
                      key={file.path}
                      data-testid={file.testId}
                      className={cn(
                        "flex min-h-14 flex-col gap-2 px-3 py-2 text-sm sm:flex-row sm:items-center",
                        selected ? "bg-primary/5" : "",
                      )}
                    >
                      <button
                        type="button"
                        className="flex min-w-0 flex-1 items-center gap-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-default"
                        disabled={file.disabled || isDisabled || !props.onOpen}
                        onClick={() => props.onOpen?.(file.path)}
                      >
                        {kind === "directory" ? (
                          <Folder aria-hidden="true" className="h-4 w-4 shrink-0 text-amber-600" />
                        ) : (
                          <FileIcon aria-hidden="true" className="h-4 w-4 shrink-0 text-sky-700" />
                        )}
                        <span className="min-w-0">
                          <span className="block truncate font-medium" title={file.path}>
                            {file.name}
                          </span>
                          <span className="block truncate text-xs text-muted-foreground">
                            {file.path}
                          </span>
                        </span>
                      </button>

                      <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground sm:justify-end">
                        {file.contentType ? <span>{file.contentType}</span> : null}
                        {file.size ? <span>{file.size}</span> : null}
                        {file.modified ? <span>{file.modified}</span> : null}
                        {file.status ? <span>{file.status}</span> : null}
                      </div>

                      <div className="flex flex-wrap items-center gap-1 sm:justify-end">
                        {props.onDownload ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            disabled={file.disabled || isDisabled}
                            onClick={() => props.onDownload?.(file.path)}
                          >
                            <Download aria-hidden="true" className="h-4 w-4" />
                            Download
                          </Button>
                        ) : null}
                        {props.onDelete && !props.readOnly ? (
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-destructive hover:text-destructive"
                            disabled={file.disabled || isDisabled}
                            onClick={() => requestDelete(file)}
                          >
                            <Trash2 aria-hidden="true" className="h-4 w-4" />
                            Delete
                          </Button>
                        ) : null}
                        {extraActions.map((action) => (
                          <Button
                            key={action.id}
                            variant="ghost"
                            size="sm"
                            className={action.destructive ? "text-destructive hover:text-destructive" : undefined}
                            disabled={file.disabled || isDisabled || actionDisabled(action, file)}
                            onClick={() => action.onClick(file)}
                          >
                            {action.label}
                          </Button>
                        ))}
                      </div>
                    </li>
                  );
                })
              )}
            </ul>
          )}
        </div>
      </div>

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={deleteConfirmation?.title ?? "Delete file"}
        description={deleteConfirmation?.description ?? "Permanently delete this file from storage."}
        targetName={pendingDelete?.path}
        confirmLabel={deleteConfirmation?.confirmLabel ?? "Delete file"}
        confirmVariant="destructive"
        onConfirm={confirmDelete}
      />
    </section>
  );
}
