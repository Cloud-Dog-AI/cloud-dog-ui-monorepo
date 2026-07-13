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

// @cloud-dog/ui — AudioPlayer (W28F-948): waveform + STT excerpt + play control.

import * as React from "react";
import { cn } from "../utils/cn";
import type { MediaTranscript, Waveform } from "./types";

export type AudioPlayerProps = Readonly<{
  /** Audio source URL. */
  src: string;
  /** Accessible title for the player. */
  title?: string;
  /** Pre-computed waveform peaks for a lightweight static visualisation. */
  waveform?: Waveform | null;
  /** Optional transcript; the `text` (STT excerpt) is shown beneath the player. */
  transcript?: MediaTranscript | null;
  dataTestId?: string;
  className?: string;
}>;

/** Render the waveform as accessible decorative bars (aria-hidden). */
function WaveformBars(props: { peaks: ReadonlyArray<number>; testId: string }) {
  const peaks = props.peaks.length > 0 ? props.peaks : [];
  return (
    <div
      aria-hidden="true"
      data-testid={props.testId}
      className="flex h-10 items-center gap-px overflow-hidden"
    >
      {peaks.map((p, i) => {
        const h = Math.max(2, Math.min(100, Math.round(p * 100)));
        return <span key={i} style={{ height: `${h}%` }} className="w-0.5 shrink-0 rounded-sm bg-primary/70" />;
      })}
    </div>
  );
}

/**
 * Audio result rendered inline: native `<audio>` play control, an optional
 * waveform visualisation, and the STT excerpt text from the transcript.
 */
export function AudioPlayer(props: AudioPlayerProps) {
  const { src, title = "Audio result", waveform, transcript, dataTestId = "mm-audio-player", className } = props;
  const excerpt = transcript?.text;

  return (
    <div
      data-testid={dataTestId}
      className={cn("flex max-w-full flex-col gap-2 rounded-md border border-input bg-card p-2", className)}
    >
      {waveform && waveform.peaks.length > 0 ? (
        <WaveformBars peaks={waveform.peaks} testId={`${dataTestId}-waveform`} />
      ) : null}
      <audio
        src={src}
        controls
        preload="metadata"
        aria-label={title}
        data-testid={`${dataTestId}-audio`}
        className="w-full"
      />
      {excerpt ? (
        <p
          data-testid={`${dataTestId}-excerpt`}
          className="rounded bg-muted px-2 py-1 text-xs text-foreground"
        >
          <span className="mr-1 font-semibold text-muted-foreground">Transcript:</span>
          {excerpt}
        </p>
      ) : null}
    </div>
  );
}
