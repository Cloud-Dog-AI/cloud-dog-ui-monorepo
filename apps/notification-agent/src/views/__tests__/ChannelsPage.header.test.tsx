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

// @vitest-environment jsdom
//
// W28E-1863 / fix-wave-b (NA-C-19): the Channels card sub-header (h2) must read
// exactly "Channel" (spec), NOT the old "Channel directory". Renders the real
// ChannelsPage against a mocked AppState data path (api.listChannels -> []).

import * as React from "react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// Stub the notification-agent AppState boundary: ChannelsPage calls
// api.listChannels() on mount; everything else is unused for the header render.
const api = {
  listChannels: vi.fn().mockResolvedValue([]),
  createChannel: vi.fn(),
  updateChannel: vi.fn(),
  deleteChannel: vi.fn(),
  enableChannel: vi.fn(),
  disableChannel: vi.fn(),
  testChannel: vi.fn(),
};
vi.mock("../../state/AppState", () => ({
  useNotificationAgentState: () => ({
    api,
    latestFailure: null,
    captureFailure: vi.fn((e: unknown) => String(e)),
    clearFailure: vi.fn(),
  }),
}));

import { ChannelsPage } from "../ChannelsPage";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

describe("W28E-1863 NA-C-19 — Channels card sub-header", () => {
  it("renders the card sub-header h2 as exactly 'Channel'", async () => {
    render(
      <MemoryRouter>
        <ChannelsPage />
      </MemoryRouter>,
    );

    // The page mounts and loads channels; wait for the data path to settle.
    await waitFor(() => expect(api.listChannels).toHaveBeenCalled());

    const h2 = screen.getByRole("heading", { level: 2, name: "Channel" });
    expect(h2).toBeTruthy();
    expect(h2.textContent).toBe("Channel");
  });

  it("no longer renders the old 'Channel directory' heading", () => {
    render(
      <MemoryRouter>
        <ChannelsPage />
      </MemoryRouter>,
    );

    expect(
      screen.queryByRole("heading", { name: "Channel directory" }),
    ).toBeNull();
    expect(screen.queryByText("Channel directory")).toBeNull();
  });
});
