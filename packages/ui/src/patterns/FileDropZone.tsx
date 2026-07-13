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

// @cloud-dog/ui — FileDropZone pattern (drag-and-drop file upload area).

import * as React from "react";
import { cn } from "../utils/cn";

export type FileDropZoneProps = Readonly<{
  onDrop: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  label?: string;
  description?: React.ReactNode;
  dropLabel?: string;
  browseLabel?: string;
  disabledDescription?: string;
  inputLabel?: string;
  testId?: string;
  className?: string;
}>;

export function FileDropZone(props: FileDropZoneProps) {
  const [over, setOver] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  const inputId = React.useId();
  const describedById = React.useId();
  const label = props.label ?? "Upload files";
  const dropLabel = props.dropLabel ?? "Drop files here";
  const browseLabel = props.browseLabel ?? "Drag and drop files, or click to browse";
  const activeDescription = "Release to upload selected files.";
  const disabledDescription = props.disabledDescription ?? "File upload is disabled.";
  const description = props.disabled ? disabledDescription : props.description;

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    if (!props.disabled) setOver(true);
  };

  const handleDragLeave = () => setOver(false);

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setOver(false);
    if (props.disabled) return;
    const files = Array.from(e.dataTransfer.files);
    if (files.length > 0) props.onDrop(files);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (files.length > 0) props.onDrop(files);
    if (inputRef.current) inputRef.current.value = "";
  };

  return (
    <>
      <div
        role="button"
        tabIndex={props.disabled ? -1 : 0}
        aria-label={`${label} — ${browseLabel}`}
        aria-controls={inputId}
        aria-disabled={props.disabled}
        aria-describedby={description ? describedById : undefined}
        data-testid={props.testId ?? "file-drop-zone"}
        data-state={props.disabled ? "disabled" : over ? "drag-over" : "idle"}
        className={cn(
          "flex min-h-32 flex-col items-center justify-center gap-2 rounded-md border-2 border-dashed p-6 text-center transition-colors sm:p-8",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
          over && !props.disabled ? "border-primary bg-primary/5" : "border-input",
          props.disabled ? "cursor-not-allowed opacity-50" : "cursor-pointer hover:border-primary/50",
          props.className,
        )}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        onClick={() => !props.disabled && inputRef.current?.click()}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            if (!props.disabled) inputRef.current?.click();
          }
        }}
      >
        <span className="text-sm font-medium text-foreground">
          {over ? dropLabel : label}
        </span>
        <span className="text-sm text-muted-foreground">{over ? activeDescription : browseLabel}</span>
        {description ? (
          <span id={describedById} className="text-xs text-muted-foreground">
            {description}
          </span>
        ) : null}
      </div>
      <input
        id={inputId}
        ref={inputRef}
        type="file"
        className="sr-only"
        accept={props.accept}
        multiple={props.multiple ?? true}
        disabled={props.disabled}
        aria-label={props.inputLabel ?? "Select files to upload"}
        onChange={handleChange}
        tabIndex={-1}
      />
    </>
  );
}
