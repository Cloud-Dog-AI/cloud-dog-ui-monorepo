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

// @cloud-dog/ui — W28A-871 SavedQueryControls.

import * as React from "react";
import { Save, Trash2 } from "lucide-react";
import { Button } from "../components/button";
import { Input, Select } from "../components/input";
import { cn } from "../utils/cn";

export type SavedQueryOption = Readonly<{
  id: string;
  name: string;
  description?: string;
  shared?: boolean;
}>;

export type SavedQueryControlsProps = Readonly<{
  queries: readonly SavedQueryOption[];
  selectedId?: string;
  draftName: string;
  onDraftNameChange: (name: string) => void;
  onSelect: (query: SavedQueryOption | null) => void;
  onSave: () => void;
  onDelete?: (query: SavedQueryOption) => void;
  loading?: boolean;
  disabled?: boolean;
  className?: string;
}>;

export function SavedQueryControls({
  queries,
  selectedId = "",
  draftName,
  onDraftNameChange,
  onSelect,
  onSave,
  onDelete,
  loading = false,
  disabled = false,
  className,
}: SavedQueryControlsProps) {
  const selected = queries.find((query) => query.id === selectedId) ?? null;
  return (
    <div className={cn("flex flex-wrap items-end gap-2 rounded-md border border-border bg-card p-3", className)} data-component="SavedQueryControls">
      <label className="min-w-[220px] flex-1 space-y-1 text-sm">
        <span className="font-medium">Saved query</span>
        <Select
          aria-label="Saved query"
          disabled={disabled || loading}
          value={selectedId}
          onChange={(event) => onSelect(queries.find((query) => query.id === event.target.value) ?? null)}
        >
          <option value="">{loading ? "Loading saved queries..." : "Select saved query"}</option>
          {queries.map((query) => (
            <option key={query.id} value={query.id}>
              {query.name}{query.shared ? " (shared)" : ""}
            </option>
          ))}
        </Select>
      </label>
      <label className="min-w-[220px] flex-1 space-y-1 text-sm">
        <span className="font-medium">Query name</span>
        <Input
          aria-label="Query name"
          disabled={disabled || loading}
          placeholder="Name this query"
          value={draftName}
          onChange={(event) => onDraftNameChange(event.target.value)}
        />
      </label>
      <Button disabled={disabled || loading || !draftName.trim()} onClick={onSave} type="button">
        <Save className="h-4 w-4" />
        Save
      </Button>
      {onDelete ? (
        <Button disabled={disabled || loading || !selected} onClick={() => selected && onDelete(selected)} type="button" variant="destructive">
          <Trash2 className="h-4 w-4" />
          Delete
        </Button>
      ) : null}
    </div>
  );
}
