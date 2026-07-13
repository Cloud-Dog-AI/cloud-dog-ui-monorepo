// @vitest-environment jsdom
//
// W28E-1863 fix-wave-b (imap) — post-login RENDER assertion for the changed
// ProfilesPage (StorageProfilesPage). Mirrors datatable-posture.test.tsx harness.
//
// Proves (file-mcp §6.94 live-render lesson, applied locally):
//   - the page RENDERS post-auth without throwing (my TSX is valid at runtime,
//     not merely typecheck-clean),
//   - #7  Description field: the "Description" column header + row value render,
//   - C-b Raw configuration (advanced) is inside a COLLAPSED <details> (no `open`).

import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { ProfilesPage } from "../StorageProfilesPage";

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

vi.mock("@cloud-dog/auth", () => ({
  useAuth: () => ({ isAuthenticated: true, user: { roles: ["admin"], displayName: "Admin" } }),
}));

vi.mock("@cloud-dog/config", () => ({
  useConfig: () => ({ API_BASE_URL: "http://127.0.0.1:8787", AUTH_MODE: "cookie" }),
}));

const okMeta = { status: 200, requestId: "r", correlationId: "c", timestamp: "2026-07-07T10:00:00Z" };

function result<T>(data: T) {
  return { ok: true, data, errorCode: "", errorMessage: "", meta: okMeta, raw: data };
}

const PROFILE_RAW = {
  provider: "imap_generic",
  description: "Cloud-Dog operations alerts mailbox",
  imap: { host: "mail.example.com", port: 993, security: "ssl" },
  sync: { folder_policy: { include_globs: ["INBOX"] } },
};

function setMockState() {
  const api = {
    listProfiles: vi.fn(async () => result(["operations"])),
    getProfile: vi.fn(async () => result(PROFILE_RAW)),
    callTool: vi.fn(async () => result({ status: "ok" })),
  };
  mockState = { api, role: "admin", apiKey: "unit-api-key" };
  return api;
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

async function waitForText(container: HTMLElement, pattern: string): Promise<void> {
  for (let attempt = 0; attempt < 50; attempt += 1) {
    if ((container.textContent || "").includes(pattern)) return;
    await act(async () => {
      await new Promise((resolve) => setTimeout(resolve, 10));
    });
  }
}

beforeEach(() => {
  setMockState();
});

afterEach(() => {
  act(() => {
    roots.forEach((root) => root.unmount());
  });
  roots = [];
  containers.forEach((container) => container.remove());
  containers = [];
  vi.clearAllMocks();
});

describe("W28E-1863 fix-wave-b — ProfilesPage post-login render", () => {
  test("renders post-auth with the Description column and the channel row", async () => {
    const container = await renderUi(
      <MemoryRouter initialEntries={["/profiles"]}>
        <ProfilesPage />
      </MemoryRouter>,
    );
    await waitForText(container, "operations");
    // #7 Description column header renders.
    expect(container.textContent).toContain("Description");
    // The channel row and its description value render.
    expect(container.textContent).toContain("operations");
    expect(container.textContent).toContain("Cloud-Dog operations alerts mailbox");
  });

  test("channel detail's Raw configuration (advanced) is a COLLAPSED <details>", async () => {
    const container = await renderUi(
      <MemoryRouter initialEntries={["/profiles"]}>
        <ProfilesPage />
      </MemoryRouter>,
    );
    await waitForText(container, "operations");

    // Open the channel detail sheet by clicking the row's Channel-ID button
    // (aria-label "View channel <id>", which calls setSelectedProfile(row)).
    const viewButton = container.querySelector<HTMLButtonElement>(
      'button[aria-label="View channel operations"]',
    );
    expect(viewButton).not.toBeNull();
    await act(async () => {
      viewButton!.click();
    });
    await waitForText(document.body as HTMLElement, "Raw configuration (advanced)");

    // C-b: the advanced raw config lives in a <details> that is NOT open on render.
    const details = Array.from(document.body.querySelectorAll("details")).filter((d) =>
      /Raw configuration \(advanced\)/.test(d.textContent || ""),
    );
    expect(details.length).toBe(1);
    expect(details[0].hasAttribute("open")).toBe(false);
    // It is a <details>/<summary>, not a bare expanded section.
    expect(details[0].querySelector("summary")?.textContent).toContain("Raw configuration (advanced)");
  });
});
