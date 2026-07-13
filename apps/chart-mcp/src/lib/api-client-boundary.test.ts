// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0.

import { describe, expect, it } from "vitest";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { ROUTE_ROLE_VISIBILITY, userIsAuthorised } from "../routes/role-visibility";

const HERE = dirname(fileURLToPath(import.meta.url));
const SRC_ROOT = resolve(HERE, "..");

function sourceFiles(root: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(root)) {
    const full = join(root, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...sourceFiles(full));
    } else if (/\.(tsx?|jsx?)$/.test(entry)) {
      out.push(full);
    }
  }
  return out;
}

describe("ChartApi boundary", () => {
  it("keeps view and route code on @cloud-dog/api-client instead of raw fetch", () => {
    const checked = [
      ...sourceFiles(join(SRC_ROOT, "views")),
      join(SRC_ROOT, "routes", "App.tsx"),
    ];
    const offenders = checked
      .filter((file) => /\bfetch\s*\(/.test(readFileSync(file, "utf8")))
      .map((file) => file.replace(`${SRC_ROOT}/`, ""));
    expect(offenders).toEqual([]);
  });
});

describe("RBAC route visibility matrix", () => {
  it("covers the nine W28E-1834A workflow/policy routes", () => {
    const paths = ROUTE_ROLE_VISIBILITY.map((row) => row.path);
    expect(paths).toEqual(expect.arrayContaining([
      "/data-input",
      "/data-preview",
      "/field-mapping",
      "/chartspec-editor",
      "/style-selector",
      "/locale-selector",
      "/render-preview",
      "/lifecycle-cache",
      "/licence-status",
    ]));
  });

  it("covers W28G-1039C diagram/document/clipart Stream C routes", () => {
    const paths = ROUTE_ROLE_VISIBILITY.map((row) => row.path);
    expect(paths).toEqual(expect.arrayContaining([
      "/diagram-panel",
      "/document-panel",
      "/clipart-theming",
    ]));
  });

  it("separates viewer read pages from operator render-authoring pages", () => {
    const byPath = new Map(ROUTE_ROLE_VISIBILITY.map((row) => [row.path, row.allowedRoles]));
    expect(userIsAuthorised(["chart.viewer"], byPath.get("/data-preview") ?? [])).toBe(true);
    expect(userIsAuthorised(["chart.viewer"], byPath.get("/style-selector") ?? [])).toBe(true);
    expect(userIsAuthorised(["chart.viewer"], byPath.get("/render-preview") ?? [])).toBe(false);
    expect(userIsAuthorised(["chart.viewer"], byPath.get("/diagram-panel") ?? [])).toBe(false);
    expect(userIsAuthorised(["chart.operator"], byPath.get("/diagram-panel") ?? [])).toBe(true);
    expect(userIsAuthorised(["chart.operator"], byPath.get("/document-panel") ?? [])).toBe(true);
    expect(userIsAuthorised(["chart.operator"], byPath.get("/clipart-theming") ?? [])).toBe(true);
    expect(userIsAuthorised(["chart.operator"], byPath.get("/render-preview") ?? [])).toBe(true);
    expect(userIsAuthorised(["chart.asset_admin"], byPath.get("/lifecycle-cache") ?? [])).toBe(true);
    expect(userIsAuthorised(["chart.auditor"], byPath.get("/licence-status") ?? [])).toBe(true);
  });
});
