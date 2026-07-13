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

// @cloud-dog/app-chat-client — Research chat-action request builder (W28F-948).
//
// Builds the content posted to the streaming chat endpoint, which the
// chat-client backend routes to the expert-agent `research-expert` sub-expert.
// Carries the multimodal image artefact-ref and the `synthesise_in` output
// language so the synthesis is (re-)rendered in the selected language.

import type { OutputLanguage } from "@cloud-dog/ui";

export const RESEARCH_TIMEOUT_MS = 180_000;

export type ResearchRequestOptions = Readonly<{
  query: string;
  /** file-mcp artefact-ref / image URL produced by an upload, if any. */
  imageUrl?: string | null;
  /** Output synthesis language (`synthesise_in`). */
  language: OutputLanguage;
}>;

/**
 * Build the directive content for a research chat-action. The directive is
 * deterministic and machine-parseable so the backend research-expert can route
 * the query, image, and synthesise_in language without ambiguity.
 */
export function buildResearchContent(opts: ResearchRequestOptions): string {
  const lines = [`/research ${opts.query.trim()}`.trim(), "", `synthesise_in: ${opts.language}`];
  if (opts.imageUrl) {
    lines.push(`image_url: ${opts.imageUrl}`);
  }
  return lines.join("\n");
}

/** Stable upload path for a research image attachment. */
export function buildResearchImagePath(file: File): string {
  const cleaned = (file.name || "image").replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || "image";
  // Deterministic, collision-resistant within a session: kind prefix + size.
  return `research-uploads/${file.size}-${cleaned}`;
}
