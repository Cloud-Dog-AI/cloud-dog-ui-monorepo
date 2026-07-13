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

// @cloud-dog/ui — FileArtifactCard pattern (compact file artifact display).

import * as React from "react";
import { cn } from "../utils/cn";
import { Button } from "../components/button/Button";

/* ------------------------------------------------------------------ */
/*  Public types                                                      */
/* ------------------------------------------------------------------ */

/** Preview payload — either an image URL or a text snippet. */
export type FileArtifactPreview =
  | Readonly<{ kind: "image"; src: string; alt: string }>
  | Readonly<{ kind: "text"; content: string }>;

/** A single action button rendered in the card footer. */
export type FileArtifactAction = Readonly<{
  label: string;
  onClick: () => void;
  variant?: "default" | "primary" | "destructive" | "outline" | "secondary" | "ghost" | "link";
  loading?: boolean;
}>;

export type FileArtifactCardProps = Readonly<{
  /** Full path of the artifact (displayed as secondary text). */
  path: string;
  /** Human-readable title (typically the file name). */
  title: string;
  /** Semantic kind badge. */
  kind?: "attachment" | "upload" | "download" | "reference";
  /** File size in bytes — rendered as human-readable. */
  byteSize?: number;
  /** Short status label (e.g. "Pending", "Uploaded"). */
  statusLabel?: string;
  /** Longer description text. */
  description?: string;
  /** Optional inline preview (image or text). */
  preview?: FileArtifactPreview | null;
  /** Action buttons rendered in the card footer. */
  actions?: FileArtifactAction[];
  className?: string;
}>;

/* ------------------------------------------------------------------ */
/*  Helpers                                                           */
/* ------------------------------------------------------------------ */

const UNITS = ["B", "KB", "MB", "GB", "TB"] as const;

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 B";
  const exponent = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), UNITS.length - 1);
  const value = bytes / 1024 ** exponent;
  return `${value < 10 && exponent > 0 ? value.toFixed(1) : Math.round(value)} ${UNITS[exponent]}`;
}

const KIND_STYLES: Record<string, string> = {
  attachment: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  upload: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  download: "bg-amber-100 text-amber-800 dark:bg-amber-900 dark:text-amber-200",
  reference: "bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-200",
};

/* ------------------------------------------------------------------ */
/*  Component                                                         */
/* ------------------------------------------------------------------ */

export function FileArtifactCard(props: FileArtifactCardProps) {
  const {
    path,
    title,
    kind,
    byteSize,
    statusLabel,
    description,
    preview,
    actions,
    className,
  } = props;

  return (
    <section
      className={cn(
        "rounded-md border bg-background text-sm",
        className
      )}
    >
      {/* Header row: title + badges */}
      <div className="flex flex-wrap items-center gap-2 px-3 py-2 border-b">
        <span className="font-semibold truncate flex-1 min-w-0" title={path}>
          {title}
        </span>

        {kind ? (
          <span
            className={cn(
              "rounded-full px-2 py-0.5 text-xs font-medium",
              KIND_STYLES[kind] ?? KIND_STYLES.reference
            )}
          >
            {kind}
          </span>
        ) : null}

        {statusLabel ? (
          // WCAG 2 AA (1.4.3): text-muted-foreground (#64748b) on bg-muted (#f1f5f9) is
          // only 4.34:1 (< 4.5:1). Use the darker secondary-foreground token so the status
          // badge meets the AA minimum contrast ratio while staying on the muted chip.
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-secondary-foreground">
            {statusLabel}
          </span>
        ) : null}

        {byteSize != null ? (
          <span className="text-xs text-muted-foreground">
            {formatBytes(byteSize)}
          </span>
        ) : null}
      </div>

      {/* Path + description */}
      {(description || path !== title) ? (
        <div className="px-3 py-2 space-y-1">
          {path !== title ? (
            <p className="text-xs text-muted-foreground truncate" title={path}>
              {path}
            </p>
          ) : null}
          {description ? (
            <p className="text-xs text-muted-foreground">{description}</p>
          ) : null}
        </div>
      ) : null}

      {/* Inline preview */}
      {preview?.kind === "image" ? (
        <div className="px-3 pb-2">
          <img
            src={preview.src}
            alt={preview.alt}
            className="max-h-48 rounded border object-contain"
          />
        </div>
      ) : null}

      {preview?.kind === "text" ? (
        <pre className="mx-3 mb-2 max-h-48 overflow-auto rounded bg-muted/20 p-2 text-xs font-mono">
          {preview.content}
        </pre>
      ) : null}

      {/* Actions */}
      {actions && actions.length > 0 ? (
        <div className="flex flex-wrap gap-2 px-3 py-2 border-t">
          {actions.map((action) => (
            <Button
              key={action.label}
              variant={action.variant ?? "secondary"}
              size="sm"
              loading={action.loading}
              disabled={action.loading}
              onClick={action.onClick}
            >
              {action.label}
            </Button>
          ))}
        </div>
      ) : null}
    </section>
  );
}
