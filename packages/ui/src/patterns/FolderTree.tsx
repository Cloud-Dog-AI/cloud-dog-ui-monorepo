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

// @cloud-dog/ui — FolderTree pattern (expandable folder hierarchy).

import * as React from "react";
import { cn } from "../utils/cn";

export type FolderNode = Readonly<{
  name: string;
  path: string;
  children?: FolderNode[];
}>;

export type FolderTreeProps = Readonly<{
  folders: FolderNode[];
  selectedPath?: string;
  onSelect: (path: string) => void;
  className?: string;
}>;

function FolderItem(props: {
  node: FolderNode;
  selectedPath?: string;
  onSelect: (path: string) => void;
  depth: number;
}) {
  const [expanded, setExpanded] = React.useState(false);
  const hasChildren = (props.node.children ?? []).length > 0;
  const isSelected = props.selectedPath === props.node.path;

  return (
    <li role="treeitem" aria-expanded={hasChildren ? expanded : undefined}>
      <button
        type="button"
        className={cn(
          "flex w-full items-center gap-1 rounded-md px-2 py-1 text-sm text-left",
          "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          isSelected ? "bg-primary/10 font-medium" : "",
        )}
        style={{ paddingLeft: `${props.depth * 12 + 8}px` }}
        onClick={() => {
          props.onSelect(props.node.path);
          if (hasChildren) setExpanded((v) => !v);
        }}
      >
        <span className="shrink-0 text-xs" aria-hidden>
          {hasChildren ? (expanded ? "v" : ">") : " "}
        </span>
        <span className="truncate">{props.node.name}</span>
      </button>
      {expanded && hasChildren ? (
        <ul role="group">
          {(props.node.children ?? []).map((child) => (
            <FolderItem
              key={child.path}
              node={child}
              selectedPath={props.selectedPath}
              onSelect={props.onSelect}
              depth={props.depth + 1}
            />
          ))}
        </ul>
      ) : null}
    </li>
  );
}

export function FolderTree(props: FolderTreeProps) {
  return (
    <nav className={cn("overflow-auto", props.className)} aria-label="Folder tree">
      <ul role="tree">
        {props.folders.map((node) => (
          <FolderItem
            key={node.path}
            node={node}
            selectedPath={props.selectedPath}
            onSelect={props.onSelect}
            depth={0}
          />
        ))}
      </ul>
    </nav>
  );
}
