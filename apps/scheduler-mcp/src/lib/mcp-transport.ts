// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0
//
// W28K-1408 F-1408-5 — MCP console transport hardening helpers, extracted so the
// 10s timeout, the ≤10-frame SSE guard, and malformed-JSON recovery are unit
// testable independent of the React view.

export const SSE_TIMEOUT_MS = 10_000;
export const MAX_SSE_FRAMES = 10;

export type FetchTextResult = Readonly<{ ok: boolean; status: number; text: string }>;

// fetch + read body with an AbortController timeout. Throws on timeout
// (AbortError) or transport failure; callers convert that into a displayed error.
export async function fetchText(url: string, init: RequestInit, timeoutMs: number = SSE_TIMEOUT_MS): Promise<FetchTextResult> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const r = await fetch(url, { ...init, signal: controller.signal });
    const text = await r.text();
    return { ok: r.ok, status: r.status, text };
  } finally {
    clearTimeout(timer);
  }
}

// Parse an SSE-framed MCP envelope, returning the last data frame. Enforces the
// MAX_SSE_FRAMES guard and converts a malformed frame into a friendly error.
export function parseSse(raw: string): Record<string, unknown> {
  const envelopes: Record<string, unknown>[] = [];
  for (const line of raw.split(/\r?\n/)) {
    if (!line.startsWith("data:")) continue;
    const payload = line.slice(5).trim();
    if (!payload || payload === "[DONE]") continue;
    if (envelopes.length >= MAX_SSE_FRAMES) {
      throw new Error(`MCP response exceeded the ${MAX_SSE_FRAMES}-frame guard.`);
    }
    try {
      envelopes.push(JSON.parse(payload) as Record<string, unknown>);
    } catch {
      throw new Error("MCP response contained a malformed JSON SSE frame.");
    }
  }
  if (!envelopes.length) throw new Error("MCP response did not contain a JSON SSE frame.");
  return envelopes[envelopes.length - 1];
}

// Parse either a raw-JSON or SSE-framed MCP response with malformed-JSON recovery.
export function parseEnvelope(raw: string): Record<string, unknown> {
  const trimmed = raw.trim();
  if (trimmed.startsWith("data:") || trimmed.includes("\ndata:")) return parseSse(raw);
  if (!trimmed) throw new Error("MCP response was empty.");
  try {
    return JSON.parse(trimmed) as Record<string, unknown>;
  } catch {
    throw new Error("MCP response was not valid JSON.");
  }
}
