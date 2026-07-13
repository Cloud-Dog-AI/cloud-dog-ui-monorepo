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

// @cloud-dog/ui — Multimodal shared types (W28F-948).
//
// These types model the multimodal search/research payloads rendered inline in
// the chat-client conversation thread and (later, W28F-949) the search-mcp WebUI.
// They are deliberately transport-agnostic: the same shapes describe an MCP
// SearchHit media field, an expert-agent SSE event, and a file-mcp artefact ref.

/** A single transcript cue: a time-anchored text segment of a media asset. */
export type TranscriptCue = Readonly<{
  /** Start offset in seconds from the media origin. */
  start: number;
  /** Optional end offset in seconds. */
  end?: number;
  /** The spoken/recognised text for this cue. */
  text: string;
  /** Optional speaker label. */
  speaker?: string;
}>;

/** A media transcript: ordered cues plus an optional plain-text rendering. */
export type MediaTranscript = Readonly<{
  cues: ReadonlyArray<TranscriptCue>;
  /** Optional full plain-text transcript (STT excerpt or full text). */
  text?: string;
  /** BCP-47 language tag of the transcript, when known. */
  language?: string;
}>;

/** Pre-computed waveform peaks (0..1) for audio rendering without decoding. */
export type Waveform = Readonly<{
  /** Normalised amplitude peaks in [0, 1], left-to-right. */
  peaks: ReadonlyArray<number>;
}>;

/**
 * A live entity-graph event streamed from a research run. Each event mutates an
 * accumulating graph: a node or an edge appears as the run converges.
 */
export type EntityGraphEvent =
  | Readonly<{ kind: "node"; id: string; label: string; type: string; meta?: Record<string, unknown> }>
  | Readonly<{ kind: "edge"; source: string; target: string; type: string; label?: string }>;

/** A convergence cluster: a claim corroborated by N independent sources. */
export type ConvergenceCluster = Readonly<{
  id: string;
  /** The corroborated claim or topic. */
  claim: string;
  /** Independent sources that support the claim. */
  sources: ReadonlyArray<ConvergenceSource>;
  /** Optional convergence score in [0, 1]. */
  score?: number;
}>;

export type ConvergenceSource = Readonly<{
  id: string;
  title: string;
  url?: string;
  /** Backend/provider that produced this source (e.g. "gdelt", "hn"). */
  backend?: string;
}>;

/** A live convergence event: a new cluster appears or an existing one grows. */
export type ConvergenceEvent =
  | Readonly<{ kind: "cluster"; cluster: ConvergenceCluster }>
  | Readonly<{ kind: "source"; clusterId: string; source: ConvergenceSource }>;

/** Canonical output-synthesis languages (matches expert-agent `synthesise_in`). */
export type OutputLanguage = "en" | "de" | "fr" | "pl" | "ja" | "ar" | "ru" | "zh";

export const OUTPUT_LANGUAGE_LABELS: Readonly<Record<OutputLanguage, string>> = {
  en: "English",
  de: "Deutsch",
  fr: "Français",
  pl: "Polski",
  ja: "日本語",
  ar: "العربية",
  ru: "Русский",
  zh: "中文",
};

/** Languages that render right-to-left — used to set `dir` on synthesised output. */
export const RTL_LANGUAGES: ReadonlySet<OutputLanguage> = new Set<OutputLanguage>(["ar"]);

/** Format a second offset as `m:ss` for transcript jump-to-time controls. */
export function formatTimecode(seconds: number): string {
  const safe = Number.isFinite(seconds) && seconds > 0 ? Math.floor(seconds) : 0;
  const m = Math.floor(safe / 60);
  const s = safe % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}
