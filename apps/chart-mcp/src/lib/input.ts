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

// Pure helpers for the Recommendations sandbox (unit-tested — W28F-918 §6).

import type { Recommendation } from "./types";

/**
 * Normalise sandbox input into a chart-mcp request body. JSON array/object input
 * is sent as `{ data: { rows } }`; anything else is treated as CSV text.
 */
export function buildInputBody(raw: string): Record<string, unknown> {
  const text = raw.trim();
  if (!text) throw new Error("Provide CSV or JSON data first.");
  if (text.startsWith("[") || text.startsWith("{")) {
    const parsed = JSON.parse(text) as unknown;
    if (Array.isArray(parsed)) return { data: { rows: parsed } };
    if (parsed && typeof parsed === "object") {
      const obj = parsed as Record<string, unknown>;
      if (Array.isArray(obj.rows)) return { data: { rows: obj.rows } };
      return { data: { rows: [obj] } };
    }
  }
  return { csv: text };
}

/** Build a minimal ChartSpec body from a recommendation. */
export function specFromRecommendation(rec: Recommendation): Record<string, unknown> {
  return {
    chart_type: rec.chart_type ?? "bar",
    x: rec.x ?? null,
    y: rec.y ?? null,
    title: "Sandbox preview",
    output_formats: ["svg"],
  };
}

/** Extract a previewable image data-URI from a render result, if present. */
export function svgDataUri(result: Record<string, unknown>): string | null {
  const assets = result.assets;
  if (!Array.isArray(assets)) return null;
  for (const asset of assets) {
    const a = asset as Record<string, unknown>;
    if (typeof a.base64_data === "string" && String(a.format ?? "").toLowerCase() === "svg") {
      return `data:image/svg+xml;base64,${a.base64_data}`;
    }
  }
  const first = assets[0] as Record<string, unknown> | undefined;
  if (first && typeof first.base64_data === "string") {
    return `data:${String(first.content_type ?? "application/octet-stream")};base64,${first.base64_data}`;
  }
  return null;
}
