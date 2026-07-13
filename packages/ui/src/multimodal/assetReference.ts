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

// @cloud-dog/ui — Reference-only asset helpers for storage/url media contracts.

export type AssetReference = Readonly<{
  storage_path?: string;
  url?: string;
  content_type?: string;
  size_bytes?: number;
  expires_at?: string;
  storage_backend?: string;
  metadata?: Readonly<Record<string, unknown>>;
}>;

export type NormaliseAssetReferenceOptions = Readonly<{
  allowDataUrl?: boolean;
}>;

const KNOWN_KEYS = new Set([
  "storage_path",
  "storagePath",
  "url",
  "asset_url",
  "assetUrl",
  "content_type",
  "contentType",
  "mime_type",
  "mimeType",
  "size_bytes",
  "sizeBytes",
  "expires_at",
  "expiresAt",
  "url_expires_at",
  "urlExpiresAt",
  "storage_backend",
  "storageBackend",
  "metadata",
]);

function asRecord(value: unknown): Record<string, unknown> {
  if (value && typeof value === "object" && !Array.isArray(value)) {
    return value as Record<string, unknown>;
  }
  throw new TypeError("asset reference must be an object");
}

function stringValue(value: unknown): string | undefined {
  if (value == null) return undefined;
  const text = String(value).trim();
  return text.length > 0 ? text : undefined;
}

function numberValue(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return undefined;
  if (numeric < 0) throw new Error("size_bytes must be >= 0");
  return numeric;
}

function metadataValue(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? { ...(value as Record<string, unknown>) }
    : {};
}

function trimReference(reference: AssetReference): AssetReference {
  const storagePath = stringValue(reference.storage_path);
  const url = stringValue(reference.url);
  if (!storagePath && !url) {
    throw new Error("AssetReference requires storage_path or url");
  }
  return {
    ...(storagePath ? { storage_path: storagePath } : {}),
    ...(url ? { url } : {}),
    ...(reference.content_type ? { content_type: reference.content_type } : {}),
    ...(reference.size_bytes != null ? { size_bytes: reference.size_bytes } : {}),
    ...(reference.expires_at ? { expires_at: reference.expires_at } : {}),
    ...(reference.storage_backend ? { storage_backend: reference.storage_backend } : {}),
    ...(reference.metadata && Object.keys(reference.metadata).length > 0 ? { metadata: reference.metadata } : {}),
  };
}

export function isInlineDataUrl(value: string | undefined): boolean {
  return /^data:/i.test((value ?? "").trim());
}

export function buildStoragePathReference(
  storagePath: string,
  metadata: Readonly<Record<string, unknown>> = {},
): AssetReference {
  return normaliseAssetReference({ storage_path: storagePath, ...metadata });
}

export function buildUrlReference(
  url: string,
  metadata: Readonly<Record<string, unknown>> = {},
  options: NormaliseAssetReferenceOptions = {},
): AssetReference {
  return normaliseAssetReference({ url, ...metadata }, options);
}

export function normaliseAssetReference(
  value: unknown,
  options: NormaliseAssetReferenceOptions = {},
): AssetReference {
  const raw = asRecord(value);
  const storagePath = stringValue(raw.storage_path ?? raw.storagePath);
  const url = stringValue(raw.url ?? raw.asset_url ?? raw.assetUrl);
  const sizeBytes = numberValue(raw.size_bytes ?? raw.sizeBytes);
  const metadata = metadataValue(raw.metadata);

  for (const [key, item] of Object.entries(raw)) {
    if (!KNOWN_KEYS.has(key) && item !== undefined) {
      metadata[key] = item;
    }
  }

  const reference = trimReference({
    ...(storagePath ? { storage_path: storagePath } : {}),
    ...(url ? { url } : {}),
    ...(stringValue(raw.content_type ?? raw.contentType ?? raw.mime_type ?? raw.mimeType)
      ? { content_type: stringValue(raw.content_type ?? raw.contentType ?? raw.mime_type ?? raw.mimeType) }
      : {}),
    ...(sizeBytes != null ? { size_bytes: sizeBytes } : {}),
    ...(stringValue(raw.expires_at ?? raw.expiresAt ?? raw.url_expires_at ?? raw.urlExpiresAt)
      ? { expires_at: stringValue(raw.expires_at ?? raw.expiresAt ?? raw.url_expires_at ?? raw.urlExpiresAt) }
      : {}),
    ...(stringValue(raw.storage_backend ?? raw.storageBackend)
      ? { storage_backend: stringValue(raw.storage_backend ?? raw.storageBackend) }
      : {}),
    ...(Object.keys(metadata).length > 0 ? { metadata } : {}),
  });

  if (reference.url && isInlineDataUrl(reference.url) && !options.allowDataUrl) {
    throw new Error("data: URLs are inline payloads, not asset references");
  }
  return reference;
}

export function tryNormaliseAssetReference(
  value: unknown,
  options: NormaliseAssetReferenceOptions = {},
): AssetReference | null {
  try {
    return normaliseAssetReference(value, options);
  } catch {
    return null;
  }
}
