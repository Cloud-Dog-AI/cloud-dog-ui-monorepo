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
import type { ChatProfileRecord } from "./types";
import {
  classifyReference,
  buildReferencePath,
  resolveFileIntake,
  isFileArtifactToolResult,
  deriveFileIntakeGating,
} from "./file-intake";

// ---------------------------------------------------------------------------
// Profile file-intake rendering (resolveFileIntake + deriveFileIntakeGating)
// ---------------------------------------------------------------------------

describe("resolveFileIntake", () => {
  const makeProfile = (
    overrides: Partial<ChatProfileRecord> & { file_intake?: Record<string, unknown> }
  ): ChatProfileRecord => ({
    id: 1,
    profile_id: "p-1",
    name: "test",
    description: "",
    mcp_bindings: [],
    session_defaults: overrides.file_intake
      ? { file_intake: overrides.file_intake }
      : {},
    access_control: {},
    created_at: "",
    updated_at: "",
    ...overrides,
  });

  it("returns empty settings when no profiles have file_intake", () => {
    const profiles = [makeProfile({})];
    expect(resolveFileIntake(profiles, [0])).toEqual({});
  });

  it("returns file_intake from first matching profile (no bindings = always match)", () => {
    const intake = { uploads_enabled: true, allowed_modes: ["by-value"] };
    const profiles = [makeProfile({ file_intake: intake })];
    const result = resolveFileIntake(profiles, [0]);
    expect(result).toEqual(intake);
  });

  it("matches profile when binding indices overlap with selected indices", () => {
    const intake = { uploads_enabled: false };
    const profiles = [
      makeProfile({
        file_intake: intake,
        mcp_bindings: [{ index: 2, name: "file-mcp" }],
      }),
    ];
    expect(resolveFileIntake(profiles, [1, 2, 3])).toEqual(intake);
  });

  it("skips profile when binding indices do not overlap", () => {
    const intake = { uploads_enabled: true };
    const profiles = [
      makeProfile({
        file_intake: intake,
        mcp_bindings: [{ index: 5 }],
      }),
    ];
    expect(resolveFileIntake(profiles, [0, 1])).toEqual({});
  });
});

describe("deriveFileIntakeGating", () => {
  it("defaults all modes enabled when file_intake is empty", () => {
    const gating = deriveFileIntakeGating({});
    expect(gating.uploadsEnabled).toBe(true);
    expect(gating.byValueAllowed).toBe(true);
    expect(gating.byReferenceAllowed).toBe(true);
    expect(gating.artifactRenderingEnabled).toBe(true);
  });

  it("disables uploads when uploads_enabled is false", () => {
    const gating = deriveFileIntakeGating({ uploads_enabled: false });
    expect(gating.uploadsEnabled).toBe(false);
  });

  it("restricts to by-value only when allowed_modes excludes by-reference", () => {
    const gating = deriveFileIntakeGating({ allowed_modes: ["by-value"] });
    expect(gating.byValueAllowed).toBe(true);
    expect(gating.byReferenceAllowed).toBe(false);
  });

  it("restricts to by-reference only", () => {
    const gating = deriveFileIntakeGating({ allowed_modes: ["by-reference"] });
    expect(gating.byValueAllowed).toBe(false);
    expect(gating.byReferenceAllowed).toBe(true);
  });

  it("disables artifact rendering when explicitly false", () => {
    const gating = deriveFileIntakeGating({ artifact_rendering_enabled: false });
    expect(gating.artifactRenderingEnabled).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Reference upload UI gating (classifyReference + buildReferencePath)
// ---------------------------------------------------------------------------

describe("classifyReference", () => {
  it("classifies https URL as url", () => {
    expect(classifyReference("https://example.com/report.pdf")).toBe("url");
  });

  it("classifies http URL as url", () => {
    expect(classifyReference("http://internal.host/data.csv")).toBe("url");
  });

  it("classifies s3 URI as url", () => {
    expect(classifyReference("s3://bucket/key.json")).toBe("url");
  });

  it("classifies ftp URI as url", () => {
    expect(classifyReference("ftp://server/file.txt")).toBe("url");
  });

  it("classifies absolute path as path", () => {
    expect(classifyReference("/data/reports/summary.md")).toBe("path");
  });

  it("classifies relative path as path", () => {
    expect(classifyReference("uploads/report.md")).toBe("path");
  });

  it("trims whitespace before classifying", () => {
    expect(classifyReference("  https://x.com/f  ")).toBe("url");
    expect(classifyReference("  /file.txt  ")).toBe("path");
  });
});

describe("buildReferencePath", () => {
  it("produces a path under uploads/ with a timestamp prefix", () => {
    const result = buildReferencePath("https://example.com/report.pdf", 0);
    expect(result).toMatch(/^uploads\/\d+-ref-1-report\.pdf$/);
  });

  it("sanitises special characters from the filename segment", () => {
    const result = buildReferencePath("https://example.com/my report (v2).pdf", 1);
    expect(result).toMatch(/^uploads\/\d+-ref-2-my-report-v2-\.pdf$/);
  });

  it("uses domain segment when trailing slash leaves no filename", () => {
    const result = buildReferencePath("https://example.com/", 0);
    expect(result).toMatch(/^uploads\/\d+-ref-1-example\.com$/);
  });
});

// ---------------------------------------------------------------------------
// File artifact tool result detection
// ---------------------------------------------------------------------------

describe("isFileArtifactToolResult", () => {
  it("returns path when result has path and bytes_written", () => {
    expect(
      isFileArtifactToolResult({
        result: { path: "/data/output.md", bytes_written: 1024 },
      })
    ).toBe("/data/output.md");
  });

  it("returns path when result has filename and ok", () => {
    expect(
      isFileArtifactToolResult({
        result: { filename: "report.pdf", ok: true },
      })
    ).toBe("report.pdf");
  });

  it("returns path when result has file_path and content_base64", () => {
    expect(
      isFileArtifactToolResult({
        result: { file_path: "/out/data.csv", content_base64: "abc==" },
      })
    ).toBe("/out/data.csv");
  });

  it("returns null when result has path but no content indicator", () => {
    expect(
      isFileArtifactToolResult({
        result: { path: "/data/x.txt" },
      })
    ).toBeNull();
  });

  it("returns null when result is not an object", () => {
    expect(isFileArtifactToolResult({ result: "string" })).toBeNull();
    expect(isFileArtifactToolResult({})).toBeNull();
  });
});
