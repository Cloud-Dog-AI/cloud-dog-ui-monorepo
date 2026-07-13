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

// @cloud-dog/ui — DragDropUpload (W28F-948): multimodal upload zone.
//
// Composes the shared FileDropZone primitive (no fork) and adds upload-specific
// behaviour: a default multimodal `accept`, single-file `onUpload` semantics,
// client-side max-size feedback (the authoritative quota/size gate is enforced
// server-side at the chat-client edge per PS-94 FT-06 / CSR-025), and inline
// status/error display.

import * as React from "react";
import { cn } from "../utils/cn";
import { FileDropZone } from "../patterns/FileDropZone";
import { formatBytes } from "../utils/formatRelativeTime";

export const DEFAULT_MULTIMODAL_ACCEPT = "image/*,video/*,audio/*,application/pdf";

export type DragDropUploadProps = Readonly<{
  /** Called with the accepted file once it passes client-side validation. */
  onUpload: (file: File) => void;
  /** Comma-separated accept list. Defaults to image/video/audio/pdf. */
  accept?: string;
  /** Client-side advisory max size in bytes; oversize files are rejected with a message. */
  maxSizeBytes?: number;
  /** Disable the zone (e.g. while an upload is in flight). */
  disabled?: boolean;
  /** Inline label rendered above the drop zone. */
  label?: string;
  dataTestId?: string;
  className?: string;
}>;

/** True when the file's MIME type matches a comma-separated accept list. */
export function fileMatchesAccept(file: File, accept: string): boolean {
  const patterns = accept.split(",").map((s) => s.trim()).filter(Boolean);
  if (patterns.length === 0) return true;
  const type = file.type || "";
  return patterns.some((p) => {
    if (p.endsWith("/*")) return type.startsWith(p.slice(0, -1));
    return type === p;
  });
}

export function DragDropUpload(props: DragDropUploadProps) {
  const {
    onUpload,
    accept = DEFAULT_MULTIMODAL_ACCEPT,
    maxSizeBytes,
    disabled,
    label = "Attach image, video, audio, or PDF",
    dataTestId = "mm-dragdrop-upload",
    className,
  } = props;
  const [error, setError] = React.useState<string | null>(null);
  const errorId = React.useId();

  const handleDrop = React.useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file) return;
      if (!fileMatchesAccept(file, accept)) {
        setError(`Unsupported file type: ${file.type || "unknown"}.`);
        return;
      }
      if (maxSizeBytes != null && file.size > maxSizeBytes) {
        setError(`File is too large (${formatBytes(file.size)}). Maximum is ${formatBytes(maxSizeBytes)}.`);
        return;
      }
      setError(null);
      onUpload(file);
    },
    [accept, maxSizeBytes, onUpload],
  );

  return (
    <div data-testid={dataTestId} className={cn("flex flex-col gap-1", className)}>
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <FileDropZone
        accept={accept}
        disabled={disabled}
        onDrop={handleDrop}
        className={error ? "border-destructive" : undefined}
      />
      {maxSizeBytes != null ? (
        <span className="text-[11px] text-muted-foreground">Max {formatBytes(maxSizeBytes)} per file.</span>
      ) : null}
      {error ? (
        <p id={errorId} role="alert" data-testid={`${dataTestId}-error`} className="text-xs text-destructive">
          {error}
        </p>
      ) : null}
    </div>
  );
}
