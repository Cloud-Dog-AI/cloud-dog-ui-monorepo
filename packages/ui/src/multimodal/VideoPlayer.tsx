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

// @cloud-dog/ui — VideoPlayer (W28F-948): embedded player + transcript jump-to-time.

import * as React from "react";
import { cn } from "../utils/cn";
import { formatTimecode } from "./types";
import type { MediaTranscript } from "./types";

export type VideoPlayerProps = Readonly<{
  /** Video source URL (e.g. a YouTube-embed-equivalent direct media URL). */
  src: string;
  /** Optional poster image. */
  poster?: string;
  /** Accessible title for the player. */
  title?: string;
  /** Optional transcript rendered in a jump-to-time sidebar. */
  transcript?: MediaTranscript | null;
  /**
   * Called when the viewer jumps to a transcript time. Receives the offset in
   * seconds. The component also seeks its own `<video>` element.
   */
  jumpToTime?: (seconds: number) => void;
  dataTestId?: string;
  className?: string;
}>;

/**
 * Video result rendered inline in the conversation thread. When a transcript is
 * supplied, each cue is a button that seeks the embedded `<video>` to that
 * offset and notifies `jumpToTime`, satisfying the §9.4.6 "jump-to-time" gate.
 */
export function VideoPlayer(props: VideoPlayerProps) {
  const { src, poster, title = "Video result", transcript, jumpToTime, dataTestId = "mm-video-player", className } = props;
  const videoRef = React.useRef<HTMLVideoElement>(null);

  const seekTo = React.useCallback(
    (seconds: number) => {
      const el = videoRef.current;
      if (el) {
        try {
          el.currentTime = seconds;
          void el.play?.();
        } catch {
          // jsdom / unsupported media — still notify the consumer below.
        }
      }
      jumpToTime?.(seconds);
    },
    [jumpToTime],
  );

  const cues = transcript?.cues ?? [];

  return (
    <div
      data-testid={dataTestId}
      className={cn("flex max-w-full flex-col gap-3 rounded-md border border-input bg-card p-2 sm:flex-row", className)}
    >
      <video
        ref={videoRef}
        src={src}
        poster={poster}
        controls
        preload="metadata"
        aria-label={title}
        data-testid={`${dataTestId}-video`}
        className="max-h-80 w-full rounded bg-black sm:w-2/3"
      />
      {cues.length > 0 ? (
        <div className="flex w-full flex-col sm:w-1/3">
          <h4 className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transcript</h4>
          <ul
            data-testid={`${dataTestId}-transcript`}
            className="flex max-h-72 flex-col gap-0.5 overflow-y-auto pr-1"
            aria-label={`${title} transcript`}
          >
            {cues.map((cue, i) => (
              <li key={`${cue.start}-${i}`}>
                <button
                  type="button"
                  onClick={() => seekTo(cue.start)}
                  data-testid={`${dataTestId}-cue-${i}`}
                  aria-label={`Jump to ${formatTimecode(cue.start)}${cue.speaker ? `, ${cue.speaker}` : ""}`}
                  className={cn(
                    "flex w-full gap-2 rounded px-1.5 py-1 text-left text-xs",
                    "hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  )}
                >
                  <span className="shrink-0 font-mono text-primary">{formatTimecode(cue.start)}</span>
                  <span className="text-foreground">{cue.text}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}
