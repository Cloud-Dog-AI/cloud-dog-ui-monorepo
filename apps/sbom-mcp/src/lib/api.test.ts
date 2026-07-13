// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0

/* @vitest-environment jsdom */

import { beforeEach, describe, expect, it, vi } from "vitest";
import { buildApi, countOpenApiOperations, retryScanRequestFromJob } from "./api";
import type { JobResponse } from "./types";

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function requestPath(input: RequestInfo | URL): string {
  const url = new URL(String(input));
  return `${url.pathname}${url.search}`;
}

function requestHeaders(init: RequestInit | undefined): Headers {
  return init?.headers instanceof Headers ? init.headers : new Headers(init?.headers);
}

describe("buildApi", () => {
  beforeEach(() => {
    vi.stubGlobal("fetch", vi.fn(async () => jsonResponse({ items: [], total: 0, limit: 100 })));
  });

  it("uses @cloud-dog/api-client with request/correlation IDs and cookie credentials", async () => {
    const api = buildApi("/v1");
    await api.listJobs();
    const call = vi.mocked(fetch).mock.calls[0];
    expect(requestPath(call[0])).toBe("/v1/jobs?limit=100");
    expect(call[1]?.credentials).toBe("include");
    const headers = requestHeaders(call[1]);
    expect(headers.get("X-Request-Id")).toMatch(/[0-9a-f-]{8}/);
    expect(headers.get("Accept")).toBe("application/json");
  });

  it("exposes waiver create, update, and revoke shapes", async () => {
    const api = buildApi("/v1");
    await api.createWaiver({
      cve_or_finding_id: "CVE-2026-0001",
      scope: "global",
      expiry: "2026-07-01T00:00:00.000Z",
      reason: "accepted risk",
    });
    await api.updateWaiver("w-1", { reason: "updated" });
    await api.revokeWaiver("w-1");

    expect(vi.mocked(fetch).mock.calls.map((call) => [requestPath(call[0]), call[1]?.method ?? "GET"])).toEqual([
      ["/v1/waivers", "POST"],
      ["/v1/waivers/w-1", "PATCH"],
      ["/v1/waivers/w-1", "DELETE"],
    ]);
  });

  it("uses global and per-scan findings endpoints", async () => {
    const api = buildApi("/v1");
    await api.listFindings({ limit: 25 });
    await api.listFindings({ scanId: "scan-1", limit: 25 });
    expect(vi.mocked(fetch).mock.calls.map((call) => requestPath(call[0]))).toEqual([
      "/v1/findings?limit=25",
      "/v1/scans/scan-1/findings?limit=25",
    ]);
  });

  it("exposes jobs, scan status, audit, settings, storage profiles, and run-now endpoints", async () => {
    const api = buildApi("/v1");
    await api.getJob("job-1");
    await api.getScanStatus("scan-1");
    await api.listAudit();
    await api.getSettings();
    await api.updateSettings({ retention_days: 30 });
    await api.listStorageProfiles();
    await api.runScheduledNow("sched-1");

    expect(vi.mocked(fetch).mock.calls.map((call) => [requestPath(call[0]), call[1]?.method ?? "GET"])).toEqual([
      ["/v1/jobs/job-1", "GET"],
      ["/v1/scans/scan-1/status", "GET"],
      ["/v1/audit?limit=100", "GET"],
      ["/v1/settings", "GET"],
      ["/v1/settings", "PUT"],
      ["/v1/storage-profiles", "GET"],
      ["/v1/scheduled-scans/sched-1/run-now", "POST"],
    ]);
  });

  it("aggregates report files from real scan result file indexes", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (url: RequestInfo | URL) => {
        if (requestPath(url) === "/v1/scans?limit=100") {
          return jsonResponse({
            items: [{ scan_id: "scan-1" }],
            total: 1,
            limit: 100,
          });
        }
        return jsonResponse({
          scan_id: "scan-1",
          job_id: "scan-1",
          boundary: "pypi",
          target_type: "package",
          target: "demo",
          status: "completed_pass",
          verdict: "PASS",
          exit_code: 0,
          files: [{ name: "manifest.json", classification: "public", required: true, available: true }],
        });
      })
    );
    const api = buildApi("/v1");
    const files = await api.listReportFiles();
    expect(files.items).toHaveLength(1);
    expect(files.items[0]).toMatchObject({
      scan_id: "scan-1",
      name: "manifest.json",
      uri: "/v1/scans/scan-1/files/manifest.json",
    });
  });

  it("calls MCP and A2A surfaces through the shared client", async () => {
    const api = buildApi("/v1");
    await api.mcpTools();
    const mcp = await api.mcpCall("get_service_capabilities", {});
    await api.a2aAgentCard();
    const a2a = await api.a2aSkillCall("list_scans", { limit: 1 });

    expect(vi.mocked(fetch).mock.calls.map((call) => [requestPath(call[0]), call[1]?.method ?? "GET"])).toEqual([
      ["/mcp/tools/list", "POST"],
      ["/mcp/tools/call", "POST"],
      ["/.well-known/agent-card", "GET"],
      ["/a2a/skills/call", "POST"],
    ]);
    expect(mcp.correlationId).toMatch(/[0-9a-f-]{8}/);
    expect(a2a.requestId).toMatch(/[0-9a-f-]{8}/);
  });

  it("builds retry scan payloads from job payloads", async () => {
    const job: JobResponse = {
      job_id: "job-1",
      job_type: "sbom_scan",
      status: "failed",
      payload: {
        scan_id: "old-scan",
        boundary: "github",
        target_type: "container_image",
        target: "ghcr.io/cloud-dog/demo:1",
        storage_profile: "file",
      },
      created_at: "2026-06-29T00:00:00Z",
      updated_at: "2026-06-29T00:00:00Z",
      attempt: 2,
    };
    expect(retryScanRequestFromJob(job)).toMatchObject({
      boundary: "github",
      target_type: "container_image",
      target: "ghcr.io/cloud-dog/demo:1",
      storage_profile: "file",
      caller_metadata: { retry_of_job_id: "job-1" },
    });
  });

  it("counts OpenAPI operations across path methods", () => {
    expect(countOpenApiOperations({
      paths: {
        "/v1/scans": { get: {}, post: {}, parameters: [] },
        "/v1/scans/{scan_id}": { get: {}, delete: {} },
      },
    })).toBe(4);
  });
});
