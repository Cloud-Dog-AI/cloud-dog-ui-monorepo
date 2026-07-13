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

// @cloud-dog/app-chat-client — Inline multimodal result renderer (W28F-948).
//
// Maps a MediaResult to the matching @cloud-dog/ui multimodal component and
// surfaces a download control. Used both by the conversation thread (D2) and
// the research console (D3).

import * as React from "react";
import {
  AudioPlayer,
  Button,
  ImagePreview,
  PDFViewer,
  VideoPlayer,
} from "@cloud-dog/ui";
import type { MediaResult } from "../lib/media";

export type MediaInlineProps = Readonly<{
  media: MediaResult;
  /** Authenticated download via the file-mcp proxy (used when downloadPath set). */
  onDownload?: (media: MediaResult) => void;
  downloading?: boolean;
}>;

export function MediaInline(props: MediaInlineProps) {
  const { media, onDownload, downloading } = props;
  const canProxyDownload = !!media.downloadPath && !!onDownload;

  const body = (() => {
    switch (media.kind) {
      case "image":
        return <ImagePreview src={media.src} alt={media.title ?? media.caption} caption={media.caption} />;
      case "video":
        return (
          <VideoPlayer
            src={media.src}
            title={media.title ?? "Video result"}
            transcript={media.transcript ?? null}
          />
        );
      case "audio":
        return (
          <AudioPlayer
            src={media.src}
            title={media.title ?? "Audio result"}
            waveform={media.waveform ?? null}
            transcript={media.transcript ?? null}
          />
        );
      case "pdf":
        return <PDFViewer src={media.src} pages={3} title={media.title ?? "PDF result"} pageImages={media.pageImages} />;
      default:
        return null;
    }
  })();

  return (
    <div data-testid={`media-inline-${media.kind}`} className="flex flex-col items-start gap-1">
      {media.title ? <span className="text-xs font-medium text-foreground">{media.title}</span> : null}
      {body}
      {canProxyDownload ? (
        <Button
          size="sm"
          variant="outline"
          disabled={downloading}
          onClick={() => onDownload!(media)}
          data-testid={`media-inline-${media.kind}-download`}
        >
          {downloading ? "Downloading…" : "Download"}
        </Button>
      ) : (
        <a
          href={media.src}
          download
          data-testid={`media-inline-${media.kind}-download`}
          className="rounded px-1 text-xs font-medium text-primary underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          Download
        </a>
      )}
    </div>
  );
}

export function MediaResultList(props: {
  items: ReadonlyArray<MediaResult>;
  onDownload?: (media: MediaResult) => void;
  downloadingId?: string | null;
}) {
  if (props.items.length === 0) return null;
  return (
    <div data-testid="media-result-list" className="flex flex-col gap-3">
      {props.items.map((m) => (
        <MediaInline key={m.id} media={m} onDownload={props.onDownload} downloading={props.downloadingId === m.id} />
      ))}
    </div>
  );
}
