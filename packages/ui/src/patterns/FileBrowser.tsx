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

// @cloud-dog/ui — FileBrowser pattern (two-panel file browser).

import * as React from "react";
import { cn } from "../utils/cn";
import { Button } from "../components/button/Button";
import { FolderTree } from "./FolderTree";
import type { FolderNode } from "./FolderTree";

export type FileItem = Readonly<{
  name: string;
  path: string;
  size?: string;
  modified?: string;
}>;

export type FileBrowserProps = Readonly<{
  folders: FolderNode[];
  files: FileItem[];
  currentPath: string;
  showBreadcrumb?: boolean;
  onNavigate: (path: string) => void;
  onUpload?: () => void;
  onDelete?: (path: string) => void;
  onDownload?: (path: string) => void;
  onCreateFolder?: () => void;
  className?: string;
}>;

export function FileBrowser(props: FileBrowserProps) {
  const segments = props.currentPath.split("/").filter(Boolean);

  return (
    <div className={cn("flex rounded-md border bg-background", props.className)}>
      {/* Left panel: folder tree */}
      <div className="w-56 shrink-0 border-r p-2">
        <FolderTree
          folders={props.folders}
          selectedPath={props.currentPath}
          onSelect={props.onNavigate}
        />
      </div>

      {/* Right panel: file list */}
      <div className="flex-1 min-w-0">
        {/* Breadcrumb */}
        {props.showBreadcrumb !== false ? (
          <div className="flex items-center gap-1 border-b px-3 py-2 text-sm">
            <button
              type="button"
              className="text-primary hover:underline"
              onClick={() => props.onNavigate("/")}
            >
              root
            </button>
            {segments.map((seg, i) => {
              const path = "/" + segments.slice(0, i + 1).join("/");
              return (
                <React.Fragment key={path}>
                  <span className="text-muted-foreground">/</span>
                  <button
                    type="button"
                    className="text-primary hover:underline"
                    onClick={() => props.onNavigate(path)}
                  >
                    {seg}
                  </button>
                </React.Fragment>
              );
            })}
          </div>
        ) : null}

        {/* Toolbar */}
        <div className="flex items-center gap-2 border-b px-3 py-2">
          {props.onUpload ? (
            <Button variant="secondary" size="sm" onClick={props.onUpload}>Upload</Button>
          ) : null}
          {props.onCreateFolder ? (
            <Button variant="secondary" size="sm" onClick={props.onCreateFolder}>New folder</Button>
          ) : null}
        </div>

        {/* File list */}
        <ul className="divide-y" aria-label="Files">
          {props.files.length === 0 ? (
            <li className="px-3 py-4 text-sm text-muted-foreground">No files.</li>
          ) : (
            props.files.map((file) => (
              <li key={file.path} className="flex items-center gap-3 px-3 py-2 text-sm">
                <span className="flex-1 truncate">{file.name}</span>
                {file.size ? <span className="text-xs text-muted-foreground">{file.size}</span> : null}
                {props.onDownload ? (
                  <Button variant="ghost" size="sm" onClick={() => props.onDownload!(file.path)}>
                    Download
                  </Button>
                ) : null}
                {props.onDelete ? (
                  <Button variant="ghost" size="sm" onClick={() => props.onDelete!(file.path)}>
                    Delete
                  </Button>
                ) : null}
              </li>
            ))
          )}
        </ul>
      </div>
    </div>
  );
}
