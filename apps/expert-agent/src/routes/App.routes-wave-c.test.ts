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

// W28E-1863 fix-wave-c — App route/nav contract. A source-level guard (paired
// with the per-page RTL render tests) that the orphaned /testing route is gone
// and the new Providers (EA-27) + Test Cases (EA-89) surfaces are routed AND
// navigable. Direct /testing now falls through the catch-all to "/".

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

// Read relative to the app cwd (vitest runs from apps/expert-agent), matching
// the imap-mcp route-contract test; avoids import.meta.url file-scheme issues
// under the forks pool.
const source = readFileSync("src/routes/App.tsx", "utf8");

describe("W28E-1863 fix-wave-c App routes/nav", () => {
  it("EA-121: removes the orphaned /testing route and TestingPage import", () => {
    expect(source).not.toContain("TestingPage");
    expect(source).not.toContain('path="/testing"');
    // Catch-all still routes unknown paths (incl. /testing) home.
    expect(source).toContain('path="*" element={<Navigate to="/" replace />}');
  });

  it("EA-27: routes and navigates the dedicated Providers surface", () => {
    expect(source).toContain('path="/providers" element={<ProvidersPage />}');
    expect(source).toContain("import { ProvidersPage }");
    expect(source).toContain("path: '/providers'");
  });

  it("EA-89: routes and navigates the dedicated Test Cases surface", () => {
    expect(source).toContain('path="/prompts/test-cases" element={<PromptTestCasesPage />}');
    expect(source).toContain("import { PromptTestCasesPage }");
    expect(source).toContain("path: '/prompts/test-cases'");
  });
});
