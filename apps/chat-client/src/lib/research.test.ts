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

import { describe, expect, it } from "vitest";
import { buildResearchContent, buildResearchImagePath } from "./research";

describe("buildResearchContent", () => {
  it("embeds the query and the synthesise_in language", () => {
    const c = buildResearchContent({ query: "  NATO air policing  ", language: "fr" });
    expect(c).toContain("/research NATO air policing");
    expect(c).toContain("synthesise_in: fr");
    expect(c).not.toContain("image_url:");
  });

  it("includes an image_url directive when an artefact-ref is supplied", () => {
    const c = buildResearchContent({ query: "what is this", imageUrl: "research-uploads/123-pic.png", language: "en" });
    expect(c).toContain("image_url: research-uploads/123-pic.png");
    expect(c).toContain("synthesise_in: en");
  });
});

describe("buildResearchImagePath", () => {
  it("produces a deterministic, sanitised path", () => {
    const file = new File([new Uint8Array(12)], "My Photo (1).PNG", { type: "image/png" });
    const path = buildResearchImagePath(file);
    expect(path).toBe("research-uploads/12-My-Photo-1-.PNG");
  });

  it("falls back to a default name", () => {
    const file = new File([new Uint8Array(3)], "", { type: "image/png" });
    expect(buildResearchImagePath(file)).toBe("research-uploads/3-image");
  });
});
