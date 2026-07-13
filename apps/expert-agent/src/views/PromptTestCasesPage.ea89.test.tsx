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
// EA-89 (W28E-1863 fix-wave-c): dedicated generated-test-cases surface. POST-LOGIN
// RENDER test — with a populated shared batch the cases render on the page; with
// an empty batch the page renders an empty-state that links back to /prompts.

import { afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const state = {
  api: { generatePromptTestCases: vi.fn(async () => []) },
  latestFailure: null as string | null,
  captureFailure: (e: unknown) => String(e),
  clearFailure: vi.fn(),
  promptTestCases: null as null | {
    cases: Array<{ name?: string; objective?: string; category?: string; input?: string }>;
    prompt: string;
    expertLabel?: string;
    generatedAt: string;
  },
  setPromptTestCases: vi.fn(),
};

vi.mock("../state/AppState", () => ({ useExpertAgentState: () => state }));

import { PromptTestCasesPage } from "./PromptTestCasesPage";

function renderPage() {
  return render(
    <MemoryRouter>
      <PromptTestCasesPage />
    </MemoryRouter>,
  );
}

afterEach(() => {
  cleanup();
  state.promptTestCases = null;
});

describe("EA-89 dedicated test-cases page", () => {
  it("renders an empty-state with a link back to /prompts when no cases exist", () => {
    state.promptTestCases = null;
    renderPage();
    expect(screen.getByTestId("test-cases-empty")).toBeInTheDocument();
    expect(screen.getByTestId("prompts-page-link")).toHaveAttribute("href", "/prompts");
  });

  it("renders the generated test cases from shared state", () => {
    state.promptTestCases = {
      cases: [
        { name: "Edge case", objective: "handle empty input", category: "robustness", input: "''" },
        { name: "Happy path", objective: "answer a normal query" },
      ],
      prompt: "You are an expert assistant.",
      expertLabel: "Researcher",
      generatedAt: new Date().toISOString(),
    };
    renderPage();
    expect(screen.getByTestId("test-cases-source")).toBeInTheDocument();
    expect(screen.getByText("Edge case")).toBeInTheDocument();
    expect(screen.getByText("handle empty input")).toBeInTheDocument();
    expect(screen.getByText("Happy path")).toBeInTheDocument();
    expect(screen.getByText(/Researcher/)).toBeInTheDocument();
  });
});
