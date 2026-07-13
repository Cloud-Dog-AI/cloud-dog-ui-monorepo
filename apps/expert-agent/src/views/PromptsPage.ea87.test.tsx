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
// EA-87 (W28E-1863 fix-wave-c): the prompt workbench must wire channel +
// knowledge + outcomes context into POST /prompts/generate (and /test-cases),
// not just {title, details, expert_id}. This is a POST-LOGIN RENDER test (RTL
// mounts the real page with AppState + authz mocked), then drives the workbench
// and asserts the request payload carries the new context (file-mcp lesson: a
// route/API rendering, not just a string check).

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

type GenContext = { expertId?: number; contextType?: string; expectedOutcomes?: string; availableTools?: string[] };

// vi.hoisted so the (hoisted) vi.mock factory and the test body share ONE stable
// set of references. The real AppStateProvider hands out useCallback-stable
// captureFailure/clearFailure; a fresh object/fn per render would change the
// page's refresh() useCallback identity and loop its load effect.
const mocks = vi.hoisted(() => {
  const generatePrompt = vi.fn(async (_prompt: string, _context?: GenContext) => ({ prompt: "generated", expert_id: 7 }));
  const generatePromptTestCases = vi.fn(async (_prompt: string, _context?: GenContext) => [{ name: "TC1", objective: "obj" }]);
  const setPromptTestCases = vi.fn();
  const api = {
    listPromptTemplates: vi.fn(async () => [{ id: 1, name: "Base", content: "hello", version: 1 }]),
    listExperts: vi.fn(async () => [{ id: 7, name: "Researcher", title: "Analyst", prompt_template: null }]),
    listChannels: vi.fn(async () => [{ id: 3, name: "Support", context_type: "technical", expected_outcomes: "resolve tickets" }]),
    listKnowledge: vi.fn(async () => [{ id: 42, title: "Runbook", knowledge_type: "doc" }]),
    listPromptExperts: vi.fn(async () => []),
    generatePrompt,
    generatePromptTestCases,
  };
  const appState = {
    api,
    latestFailure: null,
    captureFailure: (e: unknown) => String(e),
    clearFailure: vi.fn(),
    promptTestCases: null,
    setPromptTestCases,
  };
  return { generatePrompt, generatePromptTestCases, setPromptTestCases, appState };
});
const { generatePrompt, generatePromptTestCases, setPromptTestCases } = mocks;

vi.mock("../state/AppState", () => ({ useExpertAgentState: () => mocks.appState }));

// Admin so the workbench + create controls render.
vi.mock("../lib/authz", () => ({ useAuthz: () => ({ isAdmin: true, roleSet: new Set(["admin"]), permissionSet: new Set(["*"]), userId: 1 }) }));

import { PromptsPage } from "./PromptsPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <PromptsPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  generatePrompt.mockClear();
  generatePromptTestCases.mockClear();
  setPromptTestCases.mockClear();
});

describe("EA-87 prompt generation context wiring", () => {
  it("renders the workbench with expert + channel + outcomes + knowledge selectors post-login", async () => {
    renderPage();
    // Post-login render: the workbench and every context control are present.
    expect(await screen.findByTestId("prompt-workbench")).toBeInTheDocument();
    expect(screen.getByTestId("expert-context-dropdown")).toBeInTheDocument();
    // Channels/knowledge load async — wait for them.
    expect(await screen.findByTestId("channel-context-dropdown")).toBeInTheDocument();
    expect(screen.getByTestId("outcomes-context-input")).toBeInTheDocument();
    expect(await screen.findByTestId("knowledge-context-dropdown")).toBeInTheDocument();
  });

  it("sends channel + knowledge + outcomes context to generatePrompt", async () => {
    renderPage();
    await screen.findByTestId("channel-context-dropdown");

    fireEvent.change(screen.getByTestId("expert-context-dropdown"), { target: { value: "7" } });
    fireEvent.change(screen.getByTestId("channel-context-dropdown"), { target: { value: "3" } });
    fireEvent.change(screen.getByTestId("outcomes-context-input"), { target: { value: "concise answers" } });
    // Tick the knowledge entry (checkbox, id 42 -> "Runbook").
    fireEvent.click(screen.getByTestId("knowledge-context-option-42"));

    fireEvent.click(screen.getByTestId("generate-prompt-btn"));

    await waitFor(() => expect(generatePrompt).toHaveBeenCalledTimes(1));
    const [, context] = generatePrompt.mock.calls[0];
    expect(context).toMatchObject({
      expertId: 7,
      contextType: "technical",
      expectedOutcomes: "concise answers",
      availableTools: ["Runbook"],
    });
  });

  it("routes generated test cases into shared state (EA-89) instead of rendering inline", async () => {
    renderPage();
    await screen.findByTestId("channel-context-dropdown");
    fireEvent.change(screen.getByTestId("channel-context-dropdown"), { target: { value: "3" } });

    fireEvent.click(screen.getByTestId("generate-test-cases-btn"));
    await waitFor(() => expect(generatePromptTestCases).toHaveBeenCalledTimes(1));

    // Context threaded to the test-case generator too.
    const [, tcContext] = generatePromptTestCases.mock.calls[0];
    expect(tcContext).toMatchObject({ contextType: "technical" });

    // Cases are published to shared state (dedicated page), not rendered inline here.
    await waitFor(() => expect(setPromptTestCases).toHaveBeenCalled());
    const batch = setPromptTestCases.mock.calls.at(-1)?.[0];
    expect(batch.cases).toHaveLength(1);
    // A cross-link to the dedicated surface is present.
    expect(screen.getByTestId("test-cases-page-link")).toHaveAttribute("href", "/prompts/test-cases");
  });
});
