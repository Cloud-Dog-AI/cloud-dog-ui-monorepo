// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0

/* @vitest-environment jsdom */

import "@testing-library/jest-dom/vitest";
import * as React from "react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@cloud-dog/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@cloud-dog/ui")>();
  return {
    ...actual,
    ApiDocsPanel: (props: {
      openapiUrl: string;
      links?: Array<{ label: string; href: string }>;
      mcpTools?: Array<{ name: string }>;
      a2aSkills?: Array<{ name: string }>;
    }) => (
      <section aria-label="API documentation panel">
        <a href={props.openapiUrl}>OpenAPI JSON</a>
        {props.links?.map((link) => (
          <a key={link.href} href={link.href}>{link.label}</a>
        ))}
        {props.mcpTools?.map((tool) => <span key={`tool-${tool.name}`}>{tool.name}</span>)}
        {props.a2aSkills?.map((skill) => <span key={`skill-${skill.name}`}>{skill.name}</span>)}
      </section>
    ),
  };
});

import { FindingsPage } from "./FindingsPage";
import { WaiversPage } from "./WaiversPage";
import { ReportFilesPage } from "./ReportFilesPage";
import { AuditPage, AUDIT_EVENT_TYPES } from "./AuditPage";
import { JobsPage } from "./JobsPage";
import { SettingsPage } from "./SettingsPage";
import { AdminSettingsPage } from "./AdminSettingsPage";
import { ApiDocsPage } from "./ApiDocsPage";

const state = vi.hoisted(() => ({
  api: {} as Record<string, unknown>,
}));

vi.mock("../state/AppState", () => ({
  useSbomState: () => ({
    api: state.api,
    appVersion: "test",
    tenant: "tenant-default",
    selectedScanId: null,
    setSelectedScanId: vi.fn(),
  }),
}));

function mount(node: React.ReactNode, path = "/") {
  return render(<MemoryRouter initialEntries={[path]}>{node}</MemoryRouter>);
}

function list<T>(items: T[]) {
  return { items, total: items.length, limit: 200 };
}

describe("W28L-1532 completed views", () => {
  afterEach(() => {
    cleanup();
  });

  beforeEach(() => {
    vi.restoreAllMocks();
    state.api = {
      listFindings: vi.fn(async () => list([
        {
          scan_id: "scan-1",
          source_tool: "grype",
          finding_key: "grype:CVE-2026-0001",
          package_name: "demo-lib",
          package_version: "1.0.0",
          vulnerability_id: "CVE-2026-0001",
          severity: "high",
          finding_status: "open",
        },
      ])),
      listWaivers: vi.fn(async () => list([
        {
          waiver_id: "waiver-1",
          tenant_id: "tenant-default",
          cve_or_finding_id: "CVE-2026-0001",
          scope: "global",
          scope_value: null,
          expiry: "2026-07-01T00:00:00Z",
          granted_by: "admin",
          reason: "accepted risk",
          status: "active",
        },
      ])),
      createWaiver: vi.fn(async (body) => ({ waiver_id: "waiver-2", tenant_id: "tenant-default", granted_by: "admin", status: "active", ...body })),
      updateWaiver: vi.fn(async (_id, body) => ({
        waiver_id: "waiver-1",
        tenant_id: "tenant-default",
        cve_or_finding_id: "CVE-2026-0001",
        scope: "global",
        scope_value: null,
        expiry: body.expiry,
        granted_by: "admin",
        reason: body.reason,
        status: "active",
      })),
      revokeWaiver: vi.fn(async () => ({
        waiver_id: "waiver-1",
        tenant_id: "tenant-default",
        cve_or_finding_id: "CVE-2026-0001",
        scope: "global",
        scope_value: null,
        expiry: "2026-07-01T00:00:00Z",
        granted_by: "admin",
        reason: "accepted risk",
        status: "revoked",
      })),
      listReportFiles: vi.fn(async () => list([
        {
          scan_id: "scan-1",
          job_id: "scan-1",
          boundary: "pypi",
          target_type: "package",
          target: "demo-lib",
          status: "completed_pass",
          verdict: "PASS",
          name: "manifest.json",
          classification: "public",
          required: true,
          available: true,
          sha256: "abc123",
          size_bytes: 123,
          uri: "/v1/scans/scan-1/files/manifest.json",
        },
      ])),
      scanFileUrl: vi.fn((scanId, name) => `/v1/scans/${scanId}/files/${name}`),
      listAudit: vi.fn(async () => list([
        {
          seq: 1,
          event_id: "evt-1",
          event_type: "waiver_created",
          caller_id: "admin",
          tenant_id: "tenant-default",
          event_result: "success",
          event_time: "2026-06-15T12:00:00Z",
          scan_id: "scan-1",
          job_id: "scan-1",
          metadata_json: { roles: ["sbom.admin"], api_key: "*** REDACTED secret ***" },
        },
      ])),
      listJobs: vi.fn(async () => list([
        {
          job_id: "job-1",
          job_type: "sbom_scan",
          status: "queued",
          tenant_id: "tenant-default",
          user_id: "admin",
          payload: { scan_id: "scan-1" },
          created_at: "2026-06-15T12:00:00Z",
          updated_at: "2026-06-15T12:01:00Z",
          attempt: 1,
        },
      ])),
      cancelScan: vi.fn(async () => ({ scan_id: "scan-1", job_id: "job-1", status: "cancel_requested" })),
      retryJob: vi.fn(async () => ({ scan_id: "scan-2", job_id: "scan-2", status: "queued" })),
      getSettings: vi.fn(async () => ({
        settings: {
          retention_days: 90,
          storage: { access_key: "*** REDACTED secret ***" },
        },
      })),
      updateSettings: vi.fn(async (settings) => ({ settings })),
      listStorageProfiles: vi.fn(async () => ({
        items: [{ name: "file", backend: "file", default: true, config: { root: "/data", token: "*** REDACTED secret ***" } }],
      })),
      getOpenApi: vi.fn(async () => ({
        openapi: "3.1.0",
        paths: {
          "/v1/scans": { get: {}, post: {} },
        },
      })),
      mcpTools: vi.fn(async () => ({
        tools: [{ name: "submit_scan", description: "Submit scan", input_schema: {} }],
      })),
      a2aAgentCard: vi.fn(async () => ({
        skills: [{ id: "submit_scan", description: "Submit scan" }],
      })),
    };
  });

  it("renders FindingsPage with global and per-scan table data", async () => {
    mount(
      <Routes>
        <Route path="/scans/:scanId/findings" element={<FindingsPage />} />
      </Routes>,
      "/scans/scan-1/findings"
    );
    expect(await screen.findByRole("heading", { name: "Findings" })).toBeVisible();
    expect(await screen.findByText("CVE-2026-0001")).toBeVisible();
    expect(state.api.listFindings).toHaveBeenCalledWith({ scanId: "scan-1", limit: 200 });
  });

  it("renders WaiversPage and creates a waiver", async () => {
    mount(<WaiversPage />);
    expect(await screen.findByText("accepted risk")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: "Create Waiver" }));
    fireEvent.change(screen.getByLabelText("Finding or CVE"), { target: { value: "CVE-2026-0002" } });
    fireEvent.change(screen.getByLabelText("Reason"), { target: { value: "temporary exception" } });
    fireEvent.click(screen.getByRole("button", { name: "Create" }));
    await waitFor(() => expect(state.api.createWaiver).toHaveBeenCalled());
  });

  it("renders ReportFilesPage with download links", async () => {
    mount(<ReportFilesPage />);
    expect(await screen.findByRole("heading", { name: "Report Files" })).toBeVisible();
    expect(await screen.findAllByText("manifest.json")).toHaveLength(2);
    expect(screen.getByTestId("sbom-report-files-disabled-drop-zone")).toHaveAttribute("aria-disabled", "true");
    expect(screen.getByTestId("sbom-report-files-file-browser")).toBeVisible();
    expect(screen.getByTestId("download-scan-1-manifest.json")).toHaveAttribute("href", "/v1/scans/scan-1/files/manifest.json");
  });

  it("renders AuditPage with the 19-event filter", async () => {
    expect(AUDIT_EVENT_TYPES).toHaveLength(19);
    mount(<AuditPage />);
    expect(await screen.findByText("waiver_created")).toBeVisible();
    fireEvent.change(screen.getByLabelText("Filter audit event type"), { target: { value: "waiver_created" } });
    expect(screen.getAllByText("scan-1").length).toBeGreaterThan(0);
  });

  it("renders JobsPage and sends cancel through the scan endpoint", async () => {
    mount(<JobsPage />);
    expect(await screen.findByText("job-1")).toBeVisible();
    fireEvent.click(screen.getByRole("button", { name: /Cancel/ }));
    await waitFor(() => expect(state.api.cancelScan).toHaveBeenCalledWith("scan-1"));
  });

  it("renders SettingsPage with <redacted> and no backend mask sentinel", async () => {
    mount(<SettingsPage />);
    expect(await screen.findAllByText("<redacted>")).not.toHaveLength(0);
    expect(screen.queryByText("*** REDACTED secret ***")).not.toBeInTheDocument();
  });

  it("renders AdminSettingsPage and saves settings", async () => {
    mount(<AdminSettingsPage />);
    const editor = await screen.findByLabelText("Settings JSON");
    expect((editor as HTMLTextAreaElement).value).toContain("<redacted>");
    fireEvent.change(editor, { target: { value: JSON.stringify({ retention_days: 30 }, null, 2) } });
    fireEvent.click(screen.getByRole("button", { name: /Save Settings/ }));
    await waitFor(() => expect(state.api.updateSettings).toHaveBeenCalledWith({ retention_days: 30 }));
  });

  it("renders ApiDocsPage with live Swagger, MCP, and A2A docs", async () => {
    mount(<ApiDocsPage />);
    expect(await screen.findByRole("heading", { name: "API Docs" })).toBeVisible();
    const openApiLinks = await screen.findAllByText("OpenAPI JSON");
    expect(openApiLinks.some((link) => link.getAttribute("href") === "/openapi.json")).toBe(true);
    expect(await screen.findAllByText("submit_scan")).not.toHaveLength(0);
  });
});
