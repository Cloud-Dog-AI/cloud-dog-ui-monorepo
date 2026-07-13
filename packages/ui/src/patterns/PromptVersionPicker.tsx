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

// @cloud-dog/ui — PromptVersionPicker pattern (version selector + pin toggle).
//
// Presentation-only: the host owns the version list and the selected/pinned
// identifiers and reacts to onSelect / onPinToggle.

import * as React from "react";
import { cn } from "../utils/cn";
import { Button } from "../components/button/Button";
import { Combobox } from "../components/input/Combobox";
import type { ComboboxOption } from "../components/input/Combobox";

/** A single addressable version of a prompt template. */
export type PromptVersion = Readonly<{
  /** Stable identifier (e.g. a revision id or semantic tag). */
  id: string;
  /** Human-readable label (e.g. "v3" or "2026-06-01 — adds few-shot"). */
  label: string;
  /** Optional ISO timestamp shown alongside the label. */
  createdAt?: string;
  /** Optional author / committer. */
  author?: string;
}>;

export type PromptVersionPickerProps = Readonly<{
  /** Available versions, newest-first is conventional but not required. */
  versions: PromptVersion[];
  /** Id of the version currently being viewed. */
  selectedVersion?: string;
  /** Id of the pinned (default/production) version, if any. */
  pinnedVersion?: string;
  /** Fired when the user selects a different version. */
  onSelect: (versionId: string) => void;
  /** Fired when the user toggles the pin on the selected version. */
  onPinToggle: (versionId: string) => void;
  /** Disable all controls (e.g. read-only surface). */
  disabled?: boolean;
  className?: string;
}>;

/**
 * Version selector for a prompt template with a "pin" toggle. Reuses the shared
 * Combobox for searchable selection so large version histories stay navigable.
 */
export function PromptVersionPicker(props: PromptVersionPickerProps) {
  const {
    versions,
    selectedVersion,
    pinnedVersion,
    onSelect,
    onPinToggle,
    disabled = false,
    className,
  } = props;

  const options: ComboboxOption[] = React.useMemo(
    () =>
      versions.map((v) => ({
        value: v.id,
        label: v.id === pinnedVersion ? `${v.label} (pinned)` : v.label,
      })),
    [versions, pinnedVersion],
  );

  const selected = React.useMemo(
    () => versions.find((v) => v.id === selectedVersion),
    [versions, selectedVersion],
  );

  const isPinned = !!selectedVersion && selectedVersion === pinnedVersion;
  const canPin = !!selectedVersion && !disabled;

  return (
    <div
      className={cn("flex flex-col gap-2 sm:flex-row sm:items-end", className)}
      data-testid="prompt-version-picker"
    >
      <div className="min-w-0 flex-1 space-y-1">
        <span className="text-xs font-medium text-muted-foreground" id="prompt-version-label">
          Version
        </span>
        <Combobox
          aria-label="Version"
          options={options}
          value={selectedVersion ?? ""}
          onChange={onSelect}
          disabled={disabled}
          placeholder="Select a version"
          emptyMessage="No versions available."
        />
        {selected ? (
          <p className="text-xs text-muted-foreground" data-testid="prompt-version-meta">
            {[selected.author, selected.createdAt].filter(Boolean).join(" · ")}
          </p>
        ) : null}
      </div>

      <Button
        type="button"
        variant={isPinned ? "default" : "secondary"}
        size="sm"
        disabled={!canPin}
        aria-pressed={isPinned}
        data-testid="prompt-version-pin-toggle"
        onClick={() => {
          if (selectedVersion) onPinToggle(selectedVersion);
        }}
      >
        {isPinned ? "Pinned" : "Pin"}
      </Button>
    </div>
  );
}
