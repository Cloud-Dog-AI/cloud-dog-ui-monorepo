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

// @cloud-dog/app-chat-client — Multimodal result mapping + research SSE fold (W28F-948).
//
// Transport-agnostic: the same mappers turn a backend SearchHit media payload,
// an expert-agent SSE research event, or a file-mcp artefact ref into the
// @cloud-dog/ui multimodal render model. No bespoke media library — the heavy
// lifting (decode, fetch, storage) stays server-side per PS-94 FT-07.

import type {
  AssetReference,
  ConvergenceCluster,
  ConvergenceEvent,
  ConvergenceSource,
  EntityGraphEvent,
  MediaTranscript,
  OutputLanguage,
  TranscriptCue,
  Waveform,
} from "@cloud-dog/ui";
import { isInlineDataUrl, tryNormaliseAssetReference } from "@cloud-dog/ui";

export type MediaKind = "image" | "video" | "audio" | "pdf";

/** A single renderable media result extracted from a research hit. */
export type MediaResult = Readonly<{
  id: string;
  kind: MediaKind;
  /** Direct media URL or artefact-ref to render/stream. */
  src: string;
  title?: string;
  caption?: string;
  mimeType?: string;
  transcript?: MediaTranscript | null;
  waveform?: Waveform | null;
  /** First-N pre-rendered PDF page image URLs, when the backend supplies them. */
  pageImages?: ReadonlyArray<string>;
  /** Storage path for an authenticated download via the file-mcp proxy. */
  downloadPath?: string;
  /** file-mcp server index for download routing, when known. */
  serverIndex?: number | null;
}>;

function asObject(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
}

function str(value: unknown): string | undefined {
  if (value == null) return undefined;
  const s = String(value).trim();
  return s.length > 0 ? s : undefined;
}

function referenceFromHit(hit: Record<string, unknown>): AssetReference | null {
  return tryNormaliseAssetReference({
    storage_path: hit.storage_path ?? hit.storagePath ?? hit.path,
    url: hit.asset_url ?? hit.assetUrl ?? hit.media_url ?? hit.image_url ?? hit.url ?? hit.src ?? hit.download_url,
    content_type: hit.content_type ?? hit.contentType ?? hit.mime_type ?? hit.mimeType,
    size_bytes: hit.size_bytes ?? hit.sizeBytes,
    expires_at: hit.expires_at ?? hit.expiresAt ?? hit.url_expires_at ?? hit.urlExpiresAt,
    storage_backend: hit.storage_backend ?? hit.storageBackend,
  });
}

/** Map a MIME type to a renderable media kind, or null when not multimodal. */
export function mediaKindFromMime(mime: string | undefined): MediaKind | null {
  if (!mime) return null;
  const m = mime.toLowerCase();
  if (m.startsWith("image/")) return "image";
  if (m.startsWith("video/")) return "video";
  if (m.startsWith("audio/")) return "audio";
  if (m === "application/pdf") return "pdf";
  return null;
}

/** Map a media kind hint string (backend `media_type`) to a render kind. */
export function mediaKindFromHint(hint: string | undefined): MediaKind | null {
  if (!hint) return null;
  const h = hint.toLowerCase();
  if (h === "image" || h === "img" || h === "photo") return "image";
  if (h === "video") return "video";
  if (h === "audio" || h === "podcast") return "audio";
  if (h === "pdf" || h === "document") return "pdf";
  return null;
}

function toTranscript(value: unknown): MediaTranscript | null {
  const obj = asObject(value);
  const rawCues = Array.isArray(obj.cues) ? obj.cues : Array.isArray(value) ? (value as unknown[]) : [];
  const cues: TranscriptCue[] = rawCues
    .map((c) => {
      const co = asObject(c);
      const start = Number(co.start ?? co.offset ?? co.time ?? NaN);
      const text = str(co.text ?? co.content);
      if (!Number.isFinite(start) || !text) return null;
      return { start, end: co.end != null ? Number(co.end) : undefined, text, speaker: str(co.speaker) } as TranscriptCue;
    })
    .filter((c): c is TranscriptCue => c !== null);
  const text = str(obj.text ?? (typeof value === "string" ? value : undefined));
  if (cues.length === 0 && !text) return null;
  return { cues, text, language: str(obj.language) };
}

function toWaveform(value: unknown): Waveform | null {
  const peaks = Array.isArray(value)
    ? value
    : Array.isArray(asObject(value).peaks)
      ? (asObject(value).peaks as unknown[])
      : null;
  if (!peaks) return null;
  const nums = peaks.map((p) => Number(p)).filter((n) => Number.isFinite(n));
  return nums.length > 0 ? { peaks: nums } : null;
}

/**
 * Extract a renderable MediaResult from an arbitrary backend hit/result object.
 * Returns null when the payload carries no recognised multimodal media.
 */
export function mediaResultFromHit(hit: unknown, idHint?: string): MediaResult | null {
  const o = asObject(hit);
  const mimeType = str(o.mime_type ?? o.mimeType ?? o.content_type);
  const kind = mediaKindFromHint(str(o.media_type ?? o.mediaType)) ?? mediaKindFromMime(mimeType);
  const reference = referenceFromHit(o);
  const src = reference?.url;
  if (!kind || !src) return null;
  if (isInlineDataUrl(src)) return null;

  const id = idHint ?? str(o.id ?? o.hit_id) ?? src;
  const title = str(o.title ?? o.name);
  const caption = str(o.caption ?? o.description ?? o.snippet);
  const transcript = toTranscript(o.media_transcript ?? o.transcript);
  const waveform = toWaveform(o.waveform);
  const pageImages = Array.isArray(o.page_images)
    ? (o.page_images as unknown[]).map((p) => str(p)).filter((p): p is string => !!p)
    : undefined;

  return {
    id,
    kind,
    src,
    title,
    caption,
    mimeType,
    transcript,
    waveform,
    pageImages: pageImages && pageImages.length > 0 ? pageImages : undefined,
    downloadPath: reference.storage_path,
    serverIndex: o.server_index != null ? Number(o.server_index) : null,
  };
}

/* ------------------------------------------------------------------ */
/*  Progressive research SSE fold                                      */
/* ------------------------------------------------------------------ */

export type ResearchStatus = "idle" | "running" | "done" | "error";

export type ResearchState = Readonly<{
  status: ResearchStatus;
  /** Accumulating synthesis text. */
  text: string;
  /** The language the synthesis is rendered in (drives `dir`/labels). */
  language: OutputLanguage;
  entityEvents: ReadonlyArray<EntityGraphEvent>;
  convergenceEvents: ReadonlyArray<ConvergenceEvent>;
  media: ReadonlyArray<MediaResult>;
  sources: ReadonlyArray<ConvergenceSource>;
  jobId?: string;
  error?: string;
}>;

export function initialResearchState(language: OutputLanguage): ResearchState {
  return { status: "idle", text: "", language, entityEvents: [], convergenceEvents: [], media: [], sources: [] };
}

function eventType(event: unknown): string {
  return String(asObject(event).type ?? "").toLowerCase();
}

/**
 * Fold one SSE research event into the accumulating research state. Tolerant of
 * backend naming variants so a small contract drift does not blank the UI.
 */
export function foldResearchEvent(state: ResearchState, event: unknown): ResearchState {
  const o = asObject(event);
  const type = eventType(event);

  // Entity-graph growth.
  if (type === "entity_node" || type === "entity" || type === "graph_node") {
    const id = str(o.id ?? o.entity_id);
    const label = str(o.label ?? o.name) ?? id;
    if (id && label) {
      const ev: EntityGraphEvent = { kind: "node", id, label, type: str(o.entity_type ?? o.node_type) ?? "entity", meta: asObject(o.meta) };
      return { ...state, entityEvents: [...state.entityEvents, ev] };
    }
    return state;
  }
  if (type === "entity_edge" || type === "graph_edge" || type === "relation") {
    const source = str(o.source ?? o.from);
    const target = str(o.target ?? o.to);
    if (source && target) {
      const ev: EntityGraphEvent = { kind: "edge", source, target, type: str(o.edge_type ?? o.relation) ?? "related", label: str(o.label) };
      return { ...state, entityEvents: [...state.entityEvents, ev] };
    }
    return state;
  }

  // Convergence cluster growth.
  if (type === "convergence_cluster" || type === "cluster") {
    const cluster = asObject(o.cluster ?? o);
    const id = str(cluster.id ?? cluster.cluster_id);
    const claim = str(cluster.claim ?? cluster.topic ?? cluster.title);
    if (id && claim) {
      const rawSources = Array.isArray(cluster.sources) ? cluster.sources : [];
      const sources: ConvergenceSource[] = rawSources
        .map((s) => {
          const so = asObject(s);
          const sid = str(so.id ?? so.url ?? so.title);
          const title = str(so.title ?? so.name) ?? sid;
          if (!sid || !title) return null;
          return { id: sid, title, url: str(so.url), backend: str(so.backend ?? so.provider) } as ConvergenceSource;
        })
        .filter((s): s is ConvergenceSource => s !== null);
      const ce: ConvergenceEvent = { kind: "cluster", cluster: { id, claim, sources, score: cluster.score != null ? Number(cluster.score) : undefined } as ConvergenceCluster };
      return { ...state, convergenceEvents: [...state.convergenceEvents, ce] };
    }
    return state;
  }
  if (type === "convergence_source") {
    const clusterId = str(o.cluster_id ?? o.clusterId);
    const so = asObject(o.source ?? o);
    const sid = str(so.id ?? so.url ?? so.title);
    const title = str(so.title ?? so.name) ?? sid;
    if (clusterId && sid && title) {
      const ce: ConvergenceEvent = { kind: "source", clusterId, source: { id: sid, title, url: str(so.url), backend: str(so.backend ?? so.provider) } };
      return { ...state, convergenceEvents: [...state.convergenceEvents, ce] };
    }
    return state;
  }

  // Media result.
  if (type === "media" || type === "hit" || type === "result") {
    const media = mediaResultFromHit(o.media ?? o.hit ?? o.result ?? o);
    if (media) return { ...state, media: [...state.media, media] };
    return state;
  }

  // Sources / citations list.
  if (type === "sources" || type === "citations") {
    const list = Array.isArray(o.sources ?? o.citations) ? ((o.sources ?? o.citations) as unknown[]) : [];
    const sources = list
      .map((s) => {
        const so = asObject(s);
        const id = str(so.id ?? so.url ?? so.title);
        const title = str(so.title ?? so.name) ?? id;
        if (!id || !title) return null;
        return { id, title, url: str(so.url), backend: str(so.backend ?? so.provider) } as ConvergenceSource;
      })
      .filter((s): s is ConvergenceSource => s !== null);
    return { ...state, sources: [...state.sources, ...sources] };
  }

  if (type === "job" || type === "accepted") {
    return { ...state, jobId: str(o.job_id ?? o.jobId) ?? state.jobId };
  }

  if (type === "error") {
    return { ...state, status: "error", error: str(o.message ?? o.error) ?? "Research failed." };
  }

  if (type === "done" || type === "complete") {
    return { ...state, status: "done" };
  }

  return state;
}
