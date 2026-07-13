// @vitest-environment jsdom
// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0
//
// W28E-1863/fix-wave-b (db-mcp): regression tests for the surgical UI defects.
//   DM-AD-04 — README tab must render the real README (not the
//              "README content is not available" fallback) and the page must
//              mount exactly ONE ApiDocsPanel (no colliding "api-docs" testId).
//   DM-AD-01 — the single api-tab ApiDocsPanel + external links / tool / skill
//              lists remain wired.
//   Label    — sidebar nav label aligns to the canonical "Audit & Log" heading.

import { readFileSync } from "node:fs";
import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, test, vi } from "vitest";

declare global {
  // eslint-disable-next-line no-var
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}
globalThis.IS_REACT_ACT_ENVIRONMENT = true;

// Mock runtime config + app state so the page renders without a live backend.
vi.mock("@cloud-dog/config", () => ({
  useConfig: () => ({
    API_BASE_URL: "http://127.0.0.1:8787/api",
    A2A_BASE_URL: "http://127.0.0.1:8787/weba2a",
    API_KEY_HEADER: "X-API-Key",
  }),
}));

vi.mock("../state/AppState", () => ({
  useDbMcpState: () => ({ apiKey: "" }),
}));

// Stub the heavy ApiDocsPanel (SwaggerUI/redoc) so the render test isolates the
// README-tab behaviour under a real DocumentViewer + react-markdown. The stub
// records its props so we can assert the api-tab panel is still wired.
const apiDocsPanelProps: Array<Record<string, unknown>> = [];
vi.mock("@cloud-dog/ui", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@cloud-dog/ui")>();
  return {
    ...actual,
    ApiDocsPanel: (props: Record<string, unknown>) => {
      apiDocsPanelProps.push(props);
      return React.createElement("div", { "data-testid": "stub-api-docs-panel" }, "api-docs-panel");
    },
  };
});

import { ApiDocsPage } from "./ApiDocsPage";

let root: Root;
let container: HTMLElement;

beforeEach(() => {
  apiDocsPanelProps.length = 0;
  // Deterministic empty responses for the page's useEffect fetches.
  vi.stubGlobal(
    "fetch",
    vi.fn(async () =>
      new Response(JSON.stringify({ tools: [], skills: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ),
  );
  container = document.createElement("div");
  document.body.appendChild(container);
  root = createRoot(container);
});

afterEach(() => {
  act(() => root.unmount());
  container.remove();
  vi.unstubAllGlobals();
});

async function renderPage() {
  await act(async () => {
    root.render(
      React.createElement(MemoryRouter, null, React.createElement(ApiDocsPage)),
    );
  });
  // flush the page's async useEffect (fetch) microtasks
  await act(async () => {
    await Promise.resolve();
  });
}

function clickTab(name: RegExp) {
  const trigger = Array.from(container.querySelectorAll<HTMLButtonElement>('[role="tab"]')).find(
    (b) => name.test((b.textContent ?? "").trim()),
  );
  if (!trigger) throw new Error(`tab not found: ${name}`);
  return trigger;
}

describe("DM-AD-04 — README tab renders the real README (render test)", () => {
  it("shows the README markdown and NOT the not-available fallback", async () => {
    await renderPage();

    // Activate the outer README tab.
    const readmeTab = clickTab(/^README$/i);
    await act(async () => {
      readmeTab.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });

    const text = container.textContent ?? "";
    // Real README content is present...
    expect(text).toContain("Database discovery, governance and MCP tooling");
    expect(text).toContain("db-mcp-server");
    // ...and the fallback string is NOT rendered anywhere.
    expect(text).not.toContain("README content is not available");
  });

  it("mounts exactly ONE ApiDocsPanel (no colliding api-docs testId)", async () => {
    await renderPage();
    // Only the api-tab panel exists; the README tab uses DocumentViewer, not a
    // second ApiDocsPanel. The stub is mounted at most once across the page.
    const stubs = container.querySelectorAll('[data-testid="stub-api-docs-panel"]');
    expect(stubs.length).toBeLessThanOrEqual(1);
    // The api tab is the default, so exactly one panel is rendered there.
    expect(stubs.length).toBe(1);
  });
});

describe("DM-AD-01 — api-tab panel + external links / tool + skill lists wired", () => {
  it("passes the OpenAPI url and external links to the single ApiDocsPanel", async () => {
    await renderPage();
    // The stub records once per render; the page re-renders when the fetch
    // resolves, so the array may hold >1 entry for the SAME single panel. The
    // DOM-level single-instance guarantee is asserted separately (DM-AD-04).
    expect(apiDocsPanelProps.length).toBeGreaterThanOrEqual(1);
    const props = apiDocsPanelProps[apiDocsPanelProps.length - 1];
    expect(props.openapiUrl).toBe("/api/openapi.json");
    const links = (props.links ?? []) as Array<{ label: string; href: string }>;
    const labels = links.map((l) => l.label);
    // External Swagger link + MCP/A2A discovery links remain.
    expect(labels).toContain("Swagger UI");
    expect(links.find((l) => l.label === "Swagger UI")?.href).toBe("/api/docs");
    expect(labels).toContain("MCP tools");
    expect(labels).toContain("A2A health");
  });

  it("renders the MCP tools and A2A skills reference tabs", async () => {
    await renderPage();
    const tabLabels = Array.from(container.querySelectorAll('[role="tab"]')).map((t) =>
      (t.textContent ?? "").trim(),
    );
    expect(tabLabels.some((t) => /API Reference/i.test(t))).toBe(true);
    expect(tabLabels.some((t) => /MCP Tools/i.test(t))).toBe(true);
    expect(tabLabels.some((t) => /A2A Reference/i.test(t))).toBe(true);
    expect(tabLabels.some((t) => /^README$/i.test(t))).toBe(true);
  });
});

describe("source guarantees (structural, defence-in-depth)", () => {
  const apiDocsSrc = readFileSync("src/views/ApiDocsPage.tsx", "utf8");
  const appSrc = readFileSync("src/routes/App.tsx", "utf8");
  const auditSrc = readFileSync("src/views/AuditPage.tsx", "utf8");

  test("DM-AD-04: exactly one <ApiDocsPanel and README tab uses DocumentViewer", () => {
    const panelCount = (apiDocsSrc.match(/<ApiDocsPanel/g) ?? []).length;
    expect(panelCount).toBe(1);
    expect(apiDocsSrc).toContain("<DocumentViewer");
    // README tab body must not re-introduce a nested panel with readmeContent.
    expect(apiDocsSrc).not.toContain("readmeContent=");
  });

  test("Label: nav label is the canonical 'Audit & Log' (no bare 'Audit Log')", () => {
    expect(appSrc).toContain('label: "Audit & Log"');
    expect(appSrc).not.toContain('label: "Audit Log"');
    // Canonical heading unchanged on the page.
    expect(auditSrc).toContain(">Audit & Log<");
  });
});
