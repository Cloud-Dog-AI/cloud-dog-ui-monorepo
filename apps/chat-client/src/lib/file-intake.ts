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

// @cloud-dog/app-chat-client — Profile file-intake resolution and reference helpers.

import type { ChatProfileRecord, FileIntakeSettings } from "./types";

export function classifyReference(value: string): "url" | "path" {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed) || /^s3:\/\//i.test(trimmed) || /^ftp:\/\//i.test(trimmed)) {
    return "url";
  }
  return "path";
}

export function buildReferencePath(reference: string, index: number): string {
  const stamp = new Date().toISOString().replace(/[-:.TZ]/g, "");
  const filename = reference.split("/").filter(Boolean).pop() || `reference-${index + 1}`;
  const cleanedName = filename.replace(/[^A-Za-z0-9._-]+/g, "-").replace(/^-+|-+$/g, "") || `reference-${index + 1}`;
  return `uploads/${stamp}-ref-${index + 1}-${cleanedName}`;
}

export function resolveFileIntake(profiles: ChatProfileRecord[], selectedIndices: number[]): FileIntakeSettings {
  for (const profile of profiles) {
    const defaults = profile.session_defaults ?? {};
    const fileIntake = defaults.file_intake;
    if (fileIntake && typeof fileIntake === "object" && !Array.isArray(fileIntake)) {
      const bindings = Array.isArray(profile.mcp_bindings) ? profile.mcp_bindings : [];
      const bindingIndices = bindings
        .map((b) => Number((b as Record<string, unknown>).index ?? (b as Record<string, unknown>).server_index ?? -1))
        .filter((i) => Number.isInteger(i) && i >= 0);
      const hasOverlap = bindingIndices.length === 0 || bindingIndices.some((i) => selectedIndices.includes(i));
      if (hasOverlap) return fileIntake as FileIntakeSettings;
    }
  }
  return {};
}

export function isFileArtifactToolResult(data: Record<string, unknown>): string | null {
  const result = data.result;
  if (!result || typeof result !== "object" || Array.isArray(result)) return null;
  const resultObj = result as Record<string, unknown>;
  const path = String(resultObj.path ?? resultObj.file_path ?? resultObj.filename ?? "").trim();
  if (!path) return null;
  const hasContent = resultObj.content_base64 || resultObj.bytes_written != null || resultObj.ok;
  if (!hasContent) return null;
  return path;
}

export function deriveFileIntakeGating(fileIntake: FileIntakeSettings): {
  uploadsEnabled: boolean;
  byValueAllowed: boolean;
  byReferenceAllowed: boolean;
  artifactRenderingEnabled: boolean;
} {
  const uploadsEnabled = fileIntake.uploads_enabled !== false;
  const allowedModes = fileIntake.allowed_modes ?? ["by-value", "by-reference"];
  return {
    uploadsEnabled,
    byValueAllowed: allowedModes.includes("by-value"),
    byReferenceAllowed: allowedModes.includes("by-reference"),
    artifactRenderingEnabled: fileIntake.artifact_rendering_enabled !== false,
  };
}
