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

// @cloud-dog/ui — ImagePreview (W28F-948): inline image with caption pop-over.

import * as React from "react";
import { cn } from "../utils/cn";

export type ImagePreviewProps = Readonly<{
  /** Image source URL or artefact-ref data URL. */
  src: string;
  /**
   * Accessible alternative text. Required for a11y; defaults to the caption
   * when omitted so the image is never unlabelled (WSC-015).
   */
  alt?: string;
  /** Optional caption shown in a toggleable pop-over below the image. */
  caption?: string;
  /** Max rendered height (CSS length). Defaults to a thread-friendly cap. */
  maxHeight?: string;
  /** Optional click handler (e.g. open full-size). */
  onActivate?: () => void;
  dataTestId?: string;
  className?: string;
}>;

/**
 * Inline image preview for the conversation thread. The caption is rendered in
 * a disclosure pop-over toggled by an accessible button (aria-expanded), so the
 * thread stays compact while the caption remains keyboard-reachable.
 */
export function ImagePreview(props: ImagePreviewProps) {
  const { src, caption, maxHeight = "20rem", onActivate, dataTestId = "mm-image-preview", className } = props;
  const alt = props.alt ?? caption ?? "Image preview";
  const [open, setOpen] = React.useState(false);
  const captionId = React.useId();

  return (
    <figure
      data-testid={dataTestId}
      className={cn("inline-flex max-w-full flex-col gap-1 rounded-md border border-input bg-card p-1", className)}
    >
      <img
        src={src}
        alt={alt}
        loading="lazy"
        style={{ maxHeight }}
        onClick={onActivate}
        onKeyDown={(e) => {
          if (onActivate && (e.key === "Enter" || e.key === " ")) {
            e.preventDefault();
            onActivate();
          }
        }}
        role={onActivate ? "button" : undefined}
        tabIndex={onActivate ? 0 : undefined}
        className={cn(
          "max-w-full rounded object-contain",
          onActivate && "cursor-zoom-in focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        )}
      />
      {caption ? (
        <>
          <button
            type="button"
            aria-expanded={open}
            aria-controls={captionId}
            onClick={() => setOpen((v) => !v)}
            data-testid={`${dataTestId}-caption-toggle`}
            className={cn(
              "self-start rounded px-2 py-0.5 text-xs font-medium text-muted-foreground",
              "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            )}
          >
            {open ? "Hide caption" : "Caption"}
          </button>
          {open ? (
            <figcaption
              id={captionId}
              data-testid={`${dataTestId}-caption`}
              className="rounded bg-muted px-2 py-1 text-xs text-foreground"
            >
              {caption}
            </figcaption>
          ) : null}
        </>
      ) : null}
    </figure>
  );
}
