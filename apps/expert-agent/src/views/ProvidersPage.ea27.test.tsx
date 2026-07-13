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
// EA-27 (W28E-1863 fix-wave-c): dedicated Providers surface. POST-LOGIN RENDER
// test — mounts the page (AppState mocked) and asserts providers render and that
// selecting a provider fetches + renders its models via the existing
// GET /providers/{id}/models endpoint.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

// vi.hoisted keeps ONE stable appState (with stable captureFailure/clearFailure)
// shared by the hoisted mock factory and the test body — the real
// AppStateProvider hands out useCallback-stable refs, so unstable refs here would
// change the page's refresh()/loadModels() identity and loop their load effects.
const mocks = vi.hoisted(() => {
  const listProviders = vi.fn(async () => [
    { id: "ollama", name: "Ollama", type: "ollama", base_url: "http://ollama:11434", is_primary: true },
    { id: "openai", name: "OpenAI", type: "openai", base_url: "https://api.openai.com" },
  ]);
  const listProviderModels = vi.fn(async (providerId: string) =>
    providerId === "ollama"
      ? [{ id: "llama3:8b", name: "Llama 3 (8B)", family: "llama", parameter_size: "8B" }]
      : [{ id: "gpt-4o-2024", name: "GPT-4o", family: "gpt" }],
  );
  const appState = {
    api: { listProviders, listProviderModels },
    latestFailure: null,
    captureFailure: (e: unknown) => String(e),
    clearFailure: vi.fn(),
    promptTestCases: null,
    setPromptTestCases: vi.fn(),
  };
  return { listProviders, listProviderModels, appState };
});
const { listProviders, listProviderModels } = mocks;

vi.mock("../state/AppState", () => ({ useExpertAgentState: () => mocks.appState }));

import { ProvidersPage } from "./ProvidersPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <ProvidersPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  listProviders.mockClear();
  listProviderModels.mockClear();
});

describe("EA-27 Providers page", () => {
  it("renders the providers list post-login and auto-loads the primary provider's models", async () => {
    renderPage();
    // Providers rendered in the inventory table (name cell is a link/text; the
    // provider name also appears as a <select> option, hence scope to the table).
    const providerTable = (await screen.findAllByRole("table"))[0];
    expect(await within(providerTable).findByText("Ollama")).toBeInTheDocument();
    expect(within(providerTable).getByText("OpenAI")).toBeInTheDocument();
    expect(screen.getByTestId("provider-models-panel")).toBeInTheDocument();
    // Primary provider (ollama) models auto-fetched + rendered.
    await waitFor(() => expect(listProviderModels).toHaveBeenCalledWith("ollama"));
    expect(await screen.findByText("Llama 3 (8B)")).toBeInTheDocument();
  });

  it("fetches models from a selected provider", async () => {
    renderPage();
    await screen.findAllByRole("table");
    await waitFor(() => expect(listProviderModels).toHaveBeenCalledWith("ollama"));
    fireEvent.change(screen.getByTestId("provider-model-select"), { target: { value: "openai" } });
    await waitFor(() => expect(listProviderModels).toHaveBeenCalledWith("openai"));
    expect(await screen.findByText("GPT-4o")).toBeInTheDocument();
  });
});
