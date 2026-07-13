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

import { describe, expect, it } from "vitest";
import {
  foldResearchEvent,
  initialResearchState,
  mediaKindFromHint,
  mediaKindFromMime,
  mediaResultFromHit,
} from "./media";

describe("mediaKindFromMime / mediaKindFromHint", () => {
  it("classifies MIME types", () => {
    expect(mediaKindFromMime("image/png")).toBe("image");
    expect(mediaKindFromMime("video/mp4")).toBe("video");
    expect(mediaKindFromMime("audio/mpeg")).toBe("audio");
    expect(mediaKindFromMime("application/pdf")).toBe("pdf");
    expect(mediaKindFromMime("text/plain")).toBeNull();
    expect(mediaKindFromMime(undefined)).toBeNull();
  });
  it("classifies backend hints", () => {
    expect(mediaKindFromHint("podcast")).toBe("audio");
    expect(mediaKindFromHint("document")).toBe("pdf");
    expect(mediaKindFromHint("photo")).toBe("image");
    expect(mediaKindFromHint("unknown")).toBeNull();
  });
});

describe("mediaResultFromHit", () => {
  it("extracts a video hit with transcript cues", () => {
    const hit = {
      id: "yt1",
      media_type: "video",
      media_url: "https://v/clip.mp4",
      title: "Clip",
      media_transcript: { cues: [{ start: 0, text: "Hello" }, { start: 65, text: "World", speaker: "Host" }] },
    };
    const media = mediaResultFromHit(hit);
    expect(media?.kind).toBe("video");
    expect(media?.src).toBe("https://v/clip.mp4");
    expect(media?.transcript?.cues).toHaveLength(2);
    expect(media?.transcript?.cues[1].start).toBe(65);
  });

  it("extracts an image hit via MIME when no media_type hint", () => {
    const media = mediaResultFromHit({ url: "https://i/p.png", mime_type: "image/png", caption: "a cat" });
    expect(media?.kind).toBe("image");
    expect(media?.caption).toBe("a cat");
  });

  it("normalises URL asset references and storage paths via @cloud-dog/ui", () => {
    const media = mediaResultFromHit({
      media_type: "image",
      asset_url: "https://storage.example/renders/map.png",
      storage_path: "/renders/map.png",
      content_type: "image/png",
    });
    expect(media?.src).toBe("https://storage.example/renders/map.png");
    expect(media?.downloadPath).toBe("/renders/map.png");
    expect(media?.mimeType).toBe("image/png");
  });

  it("does not pass inline data URLs through as media references", () => {
    expect(
      mediaResultFromHit({
        media_type: "image",
        url: "data:image/png;base64,AAAA",
        mime_type: "image/png",
      }),
    ).toBeNull();
  });

  it("returns null for a non-media hit", () => {
    expect(mediaResultFromHit({ title: "text only", url: "https://x" })).toBeNull();
    expect(mediaResultFromHit({})).toBeNull();
  });
});

describe("foldResearchEvent", () => {
  it("accumulates entity nodes/edges, deduping nodes", () => {
    let s = initialResearchState("en");
    s = foldResearchEvent(s, { type: "entity_node", id: "a", label: "Anthropic", entity_type: "org" });
    s = foldResearchEvent(s, { type: "entity_node", id: "b", label: "Claude" });
    s = foldResearchEvent(s, { type: "entity_edge", source: "a", target: "b", relation: "makes" });
    expect(s.entityEvents).toHaveLength(3);
    const nodeEvents = s.entityEvents.filter((e) => e.kind === "node");
    expect(nodeEvents).toHaveLength(2);
  });

  it("accumulates convergence clusters and sources", () => {
    let s = initialResearchState("en");
    s = foldResearchEvent(s, { type: "convergence_cluster", cluster: { id: "c1", claim: "X happened", sources: [{ id: "s1", title: "Reuters", url: "https://r" }] } });
    s = foldResearchEvent(s, { type: "convergence_source", cluster_id: "c1", source: { id: "s2", title: "AP", backend: "gdelt" } });
    expect(s.convergenceEvents).toHaveLength(2);
  });

  it("captures media results, sources, job ids, and terminal states", () => {
    let s = initialResearchState("fr");
    s = foldResearchEvent(s, { type: "media", media: { media_type: "image", url: "https://i.png", mime_type: "image/png" } });
    expect(s.media).toHaveLength(1);
    s = foldResearchEvent(s, { type: "sources", sources: [{ id: "x", title: "Doc", url: "https://d" }] });
    expect(s.sources).toHaveLength(1);
    s = foldResearchEvent(s, { type: "job", job_id: "job-7" });
    expect(s.jobId).toBe("job-7");
    s = foldResearchEvent(s, { type: "done" });
    expect(s.status).toBe("done");
  });

  it("records errors", () => {
    const s = foldResearchEvent(initialResearchState("en"), { type: "error", message: "boom" });
    expect(s.status).toBe("error");
    expect(s.error).toBe("boom");
  });

  it("ignores unknown event types without throwing", () => {
    const s0 = initialResearchState("en");
    const s1 = foldResearchEvent(s0, { type: "heartbeat" });
    expect(s1).toEqual(s0);
  });
});
