// @vitest-environment jsdom

import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DiagnosticsAuditPage } from "../AuditLogPage";
import { McpToolsPage } from "../McpToolsPage";
import { SearchRetrievePage } from "../SearchPage";

type MockState = Record<string, unknown>;

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

let mockState: MockState;
let roots: Root[] = [];
let containers: HTMLElement[] = [];

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

vi.mock("../../state/AppState", () => ({
  useImapMcpState: () => mockState,
}));

const okMeta = {
  status: 200,
  requestId: "req-1",
  correlationId: "corr-1",
  timestamp: "2026-05-10T10:00:00Z",
};

const traceEvent = {
  scope: "mcp" as const,
  action: "tool:mail_search",
  ok: true,
  errorCode: "",
  errorMessage: "",
  status: 200,
  requestId: "req-trace",
  correlationId: "corr-trace",
  timestamp: "2026-05-10T10:00:00Z",
};

function result<T>(data: T) {
  return {
    ok: true,
    data,
    errorCode: "",
    errorMessage: "",
    meta: okMeta,
    raw: data,
  };
}

function createApi(overrides: Record<string, unknown> = {}) {
  return {
    listMcpTools: vi.fn(async () =>
      result([
        { name: "mail_search", description: "Search mail", input_schema: {} },
      ])
    ),
    callMcpTool: vi.fn(async () => result({ answer: "ok" })),
    callTool: vi.fn(async () => result({ status: "ok" })),
    listServerLogs: vi.fn(async () =>
      result([
        {
          id: "log-1",
          source: "audit",
          timestamp: "2026-05-10T10:00:00Z",
          eventType: "tool",
          action: "mail_search",
          outcome: "success",
          severity: "info",
          traceId: "trace-1",
          requestId: "req-log",
          actorType: "user",
          actorId: "admin",
          actorRoles: ["admin"],
          actorIp: "127.0.0.1",
          actorUserAgent: "vitest",
          targetType: "tool",
          targetId: "mail_search",
          targetName: "mail_search",
          correlationId: "corr-log",
          service: "imap-mcp",
          serviceInstance: "unit",
          logger: "audit",
          message: "mail search completed",
          details: { profile_id: "operations" },
          raw: { event: "tool" },
        },
      ])
    ),
    getStatus: vi.fn(async () =>
      result({ status: "ok", uptime: 10, memory_mb: 64, cpu_percent: 3, active_connections: 1 })
    ),
    listUsers: vi.fn(async () =>
      result([
        {
          userId: "user-1",
          username: "operator",
          email: "operator@example.com",
          displayName: "Operator",
          roles: ["viewer"],
        },
      ])
    ),
    listGroups: vi.fn(async () =>
      result([
        {
          groupId: "group-1",
          name: "Operators",
          description: "Ops",
          roles: ["admin"],
          members: ["user-1"],
        },
      ])
    ),
    listApiKeys: vi.fn(async () =>
      result([
        {
          apiKeyId: "key-1",
          ownerUserId: "user-1",
          description: "Unit key",
          scopes: ["profiles:read"],
          status: "active",
          rawKey: "",
        },
      ])
    ),
    listA2ATools: vi.fn(async () =>
      result([
        { name: "mail_search", description: "Search mail", input_schema: {} },
      ])
    ),
    createUser: vi.fn(),
    createGroup: vi.fn(),
    addGroupMember: vi.fn(),
    createApiKey: vi.fn(),
    getRbacPolicies: vi.fn(async () => result({ roles: ["admin"] })),
    getHealth: vi.fn(async () => result({ status: "ok" })),
    ...overrides,
  };
}

function setMockState(apiOverrides: Record<string, unknown> = {}, stateOverrides: Record<string, unknown> = {}) {
  mockState = {
    api: createApi(apiOverrides),
    mcpBaseUrl: "http://127.0.0.1:8072",
    traces: [traceEvent],
    ...stateOverrides,
  };
}

async function renderUi(element: React.ReactElement): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  roots.push(root);
  containers.push(container);
  await act(async () => {
    root.render(element);
  });
  return container;
}

async function waitForText(container: HTMLElement, pattern: RegExp | string): Promise<void> {
  const matcher = typeof pattern === "string" ? (value: string) => value.includes(pattern) : (value: string) => pattern.test(value);
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if (matcher(container.textContent || "")) return;
    await act(async () => {
      await new Promise((resolve) => window.setTimeout(resolve, 20));
    });
  }
  throw new Error(`Timed out waiting for text: ${String(pattern)}`);
}

async function clickButton(container: HTMLElement, label: RegExp): Promise<void> {
  const button = Array.from(container.querySelectorAll("button")).find((candidate) => label.test(candidate.textContent || ""));
  if (!button) throw new Error(`Button not found: ${label}`);
  await act(async () => {
    button.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
}

async function fillInput(input: HTMLInputElement, value: string): Promise<void> {
  const valueSetter = Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, "value")?.set;
  await act(async () => {
    valueSetter?.call(input, value);
    input.dispatchEvent(new Event("input", { bubbles: true }));
  });
}

function columnHeaders(container: HTMLElement): string[] {
  return Array.from(container.querySelectorAll("th")).map((header) => header.textContent?.trim() || "");
}

async function cleanupDom(): Promise<void> {
  await act(async () => {
    for (const root of roots) {
      root.unmount();
    }
  });
  for (const container of containers) {
    container.remove();
  }
  roots = [];
  containers = [];
}

afterEach(async () => {
  await cleanupDom();
  vi.clearAllMocks();
});

beforeEach(() => {
  window.localStorage.clear();
  Object.defineProperty(window, "innerWidth", { configurable: true, value: 390 });
});

describe("IMAP DataTable posture", () => {
  test("MCP legacy controls render DataTable headers, rows, empty state, and mobile table semantics", async () => {
    setMockState();
    const container = await renderUi(<McpToolsPage />);

    await waitForText(container, /mail_search/);
    expect(columnHeaders(container)).toContain("Tool");
    expect(columnHeaders(container)).toContain("Description");
    expect(container.querySelectorAll("table").length).toBeGreaterThan(0);
    expect(container.textContent).toContain("Search mail");

    await cleanupDom();

    setMockState({ listMcpTools: vi.fn(async () => result([])) });
    const emptyContainer = await renderUi(<McpToolsPage />);
    await waitForText(emptyContainer, "No MCP tools loaded.");
    expect(emptyContainer.querySelectorAll("table").length).toBeGreaterThan(0);
  });

  test("audit page renders trace DataTable with headers, row data", async () => {
    setMockState();
    const container = await renderUi(<DiagnosticsAuditPage />);

    await waitForText(container, /tool:mail_search/);
    expect(columnHeaders(container)).toContain("Action");
    expect(columnHeaders(container)).toContain("Request ID");
    expect(container.textContent).toContain("req-trace");
  });

  test("search results render filter state, message rows, and attachment metadata/download affordances", async () => {
    const callTool = vi.fn(async (toolName: string) => {
      if (toolName === "mail_search") {
        return result({
          messages: [
            {
              uid: "42",
              subject: "Quarterly report",
              from: "ops@example.com",
              received_at: "2026-05-10T09:30:00Z",
              folder: "INBOX",
              relevance_score: 0.98,
              preview: "Operational report preview",
            },
          ],
        });
      }
      if (toolName === "mail_list_attachments") {
        return result({
          attachments: [
            {
              part_id: "2",
              filename: "report.pdf",
              content_type: "application/pdf",
              size_bytes: 1024,
            },
          ],
        });
      }
      if (toolName === "mail_download_attachment") {
        return result({
          filename: "report.pdf",
          content_type: "application/pdf",
          content_encoding: "base64",
          size_bytes: 1024,
        });
      }
      return result({});
    });
    setMockState({ callTool });
    const container = await renderUi(<SearchRetrievePage />);

    expect(container.textContent).toContain("Search & Retrieve");
    expect(container.textContent).toContain("No messages returned for this query.");
    expect(container.textContent).toContain("No attachments listed.");

    const queryInput = container.querySelector("#cloud-dog-search-panel-query");
    if (!(queryInput instanceof HTMLInputElement)) {
      throw new Error("Search query input not found");
    }
    await fillInput(queryInput, "report");
    await clickButton(container, /^Search$/);

    await waitForText(container, /Quarterly report/);
    expect(columnHeaders(container)).toContain("Subject");
    expect(columnHeaders(container)).toContain("From");
    expect(columnHeaders(container)).toContain("Mailbox");
    expect(columnHeaders(container)).toContain("Relevance");
    expect(container.textContent).toContain("ops@example.com");
    expect(container.textContent).toContain("Found 1 messages.");
    expect(container.textContent).toContain("channel=operations");
    expect(container.textContent).toContain("folder=INBOX");
    expect(container.textContent).toContain("mode=cache");
    expect(container.textContent).toContain("query=report");

    await clickButton(container, /^Select$/);
    expect(container.textContent).toContain("Selected Message");
    expect(container.textContent).toContain("Operational report preview");

    await clickButton(container, /^List Attachments$/);
    await waitForText(container, /report\.pdf/);
    expect(columnHeaders(container)).toContain("Part");
    expect(columnHeaders(container)).toContain("Filename");
    expect(columnHeaders(container)).toContain("Type");
    expect(columnHeaders(container)).toContain("Size");
    expect(container.textContent).toContain("application/pdf");
    expect(container.textContent).toContain("1024");
    expect(container.textContent).toContain("Found 1 attachments for UID 42.");

    await clickButton(container, /^Download First Attachment$/);
    await waitForText(container, /Downloaded attachment part 2 for UID 42/);
    expect(container.textContent).toContain("Download Result");
    expect(container.textContent).toContain("content_encoding");
  });
});
