// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0
//
// W28K-1408 F-1408-5 — MCP console transport-hardening unit coverage:
// 10s AbortController timeout, ≤10-frame SSE guard, malformed-JSON recovery.

import { afterEach, describe, expect, it, vi } from "vitest";
import { MAX_SSE_FRAMES, fetchText, parseEnvelope, parseSse } from "../mcp-transport";

afterEach(() => { vi.restoreAllMocks(); });

describe("parseEnvelope / parseSse", () => {
  it("parses a raw JSON envelope", () => {
    expect(parseEnvelope('{"result":{"ok":true}}')).toEqual({ result: { ok: true } });
  });

  it("returns the last SSE data frame", () => {
    const raw = 'data: {"n":1}\ndata: {"n":2}\ndata: [DONE]\n';
    expect(parseSse(raw)).toEqual({ n: 2 });
  });

  it("throws a friendly error on malformed raw JSON", () => {
    expect(() => parseEnvelope("not json")).toThrow(/not valid JSON/i);
  });

  it("throws a friendly error on an empty body", () => {
    expect(() => parseEnvelope("   ")).toThrow(/empty/i);
  });

  it("throws on a malformed SSE frame", () => {
    expect(() => parseSse("data: {bad json}\n")).toThrow(/malformed JSON SSE frame/i);
  });

  it("throws when no SSE data frame is present", () => {
    expect(() => parseSse("event: ping\n")).toThrow(/did not contain a JSON SSE frame/i);
  });

  it("enforces the MAX_SSE_FRAMES guard", () => {
    const frames = Array.from({ length: MAX_SSE_FRAMES + 1 }, (_, i) => `data: {"n":${i}}`).join("\n");
    expect(() => parseSse(frames)).toThrow(new RegExp(`exceeded the ${MAX_SSE_FRAMES}-frame guard`));
  });
});

describe("fetchText timeout (AbortController)", () => {
  it("aborts the fetch after the timeout and surfaces AbortError", async () => {
    // Mock fetch to reject only when the abort signal fires (never resolves otherwise).
    vi.stubGlobal("fetch", (_url: string, init: RequestInit) =>
      new Promise((_resolve, reject) => {
        const signal = init.signal as AbortSignal;
        signal.addEventListener("abort", () => {
          const err = new Error("aborted");
          (err as Error & { name: string }).name = "AbortError";
          reject(err);
        });
      }),
    );
    await expect(fetchText("http://x/mcp", { method: "POST" }, 20)).rejects.toMatchObject({ name: "AbortError" });
  });

  it("returns {ok,status,text} on a normal response", async () => {
    vi.stubGlobal("fetch", async () => ({ ok: true, status: 200, text: async () => '{"result":1}' }));
    const r = await fetchText("http://x/mcp", { method: "POST" }, 1000);
    expect(r).toEqual({ ok: true, status: 200, text: '{"result":1}' });
  });
});
