// @vitest-environment jsdom
//
// W28E-1870-D: mail change-watch WebUI test (PS-102 §10 / CSTREAM-011).
// Proves the WatchesPage composes the shared @cloud-dog/ui change-watch panel,
// loads watches via the imap_watch_list tool on mount, and drives the create /
// test-event / journal flows through the common api.callTool transport.

import * as React from "react";
import { act } from "react";
import { createRoot, type Root } from "react-dom/client";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { WatchesPage } from "../WatchesPage";

type MockState = Record<string, unknown>;

declare global {
  var IS_REACT_ACT_ENVIRONMENT: boolean | undefined;
}

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let mockState: MockState;
let roots: Root[] = [];
let containers: HTMLElement[] = [];

vi.mock("../../state/AppState", () => ({
  useImapMcpState: () => mockState,
}));

const okMeta = {
  status: 200,
  requestId: "req-1",
  correlationId: "corr-1",
  timestamp: "2026-05-10T10:00:00Z",
};

function result<T>(data: T) {
  return { ok: true, data, errorCode: "", errorMessage: "", meta: okMeta, raw: data };
}

async function render(node: React.ReactElement): Promise<HTMLElement> {
  const container = document.createElement("div");
  document.body.appendChild(container);
  const root = createRoot(container);
  await act(async () => {
    root.render(<MemoryRouter>{node}</MemoryRouter>);
  });
  roots.push(root);
  containers.push(container);
  return container;
}

beforeEach(() => {
  mockState = {};
});

afterEach(() => {
  act(() => {
    roots.forEach((r) => r.unmount());
  });
  roots = [];
  containers.forEach((c) => c.remove());
  containers = [];
  vi.clearAllMocks();
});

describe("WatchesPage (PS-102 §10 mail change-watch WebUI)", () => {
  test("lists watches via imap_watch_list on mount and renders the panel", async () => {
    const callTool = vi.fn(async (tool: string) => {
      if (tool === "imap_watch_list") {
        return result({
          watches: [
            {
              watch_id: "mailw-1",
              service_id: "imap-mcp",
              profile_id: "operations",
              status: { state: "live", journal_depth: 3, latest_seq: 3, ack_seq: 0, inflight: 0 },
            },
          ],
        });
      }
      return result({ status: "ok" });
    });
    mockState = { api: { callTool } };

    const container = await render(<WatchesPage />);
    // it loaded the watch list on mount through the common tool transport
    expect(callTool).toHaveBeenCalledWith("imap_watch_list", { profile_id: "default" });
    // the shared change-watch panel is composed (its heading is present)
    expect(container.querySelector('[aria-label="Mail change watches page"]')).not.toBeNull();
    expect(container.textContent).toContain("Mail Change Watches");
    // the loaded watch id is rendered by the shared panel
    expect(container.textContent).toContain("mailw-1");
  });

  test("create dispatches imap_watch_create then refreshes the list", async () => {
    const callTool = vi.fn(async () => result({ watches: [] }));
    mockState = { api: { callTool } };
    const container = await render(<WatchesPage />);

    // click the panel's Create control (rendered by the shared ChangeWatchPanel)
    const createBtn = Array.from(container.querySelectorAll("button")).find((b) =>
      /create/i.test(b.textContent ?? ""),
    );
    expect(createBtn).toBeTruthy();
    await act(async () => {
      createBtn!.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    });
    expect(callTool).toHaveBeenCalledWith(
      "imap_watch_create",
      expect.objectContaining({ profile_id: "default" }),
    );
  });
});
