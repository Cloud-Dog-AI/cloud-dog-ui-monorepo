// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0

import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(new URL("./App.tsx", import.meta.url), "utf8");

function expectRoute(path: string) {
  expect(source).toContain(`path="${path}"`);
}

describe("W28E-1836 shell/auth/login contract", () => {
  it("wires the shared shell, auth, login, timeout, and footer components", () => {
    expect(source).toContain("AuthProvider");
    expect(source).toContain("LoginPage");
    expect(source).toContain("SessionTimeoutProvider");
    expect(source).toContain("ShellLayout");
    expect(source).toContain("ServiceStatusBar");
    expect(source).toContain("CopyrightFooter");
  });

  it("keeps canonical /login while redirecting authenticated users to the app home", () => {
    expect(source).toContain("!auth.isAuthenticated");
    expectRoute("/login");
    expect(source).toContain('<Navigate to="/" replace />');
  });

  it("preserves sbom-mcp service routes while adopting the common shell family", () => {
    [
      "/scans",
      "/scans/new",
      "/scans/:scanId",
      "/scheduled-scans",
      "/findings",
      "/scans/:scanId/findings",
      "/waivers",
      "/report-files",
      "/audit-log",
      "/admin/users",
      "/admin/groups",
      "/admin/api-keys",
      "/admin/roles",
      "/admin/rbac",
      "/developer/api-docs",
      "/developer/mcp-console",
      "/developer/a2a-console",
      "/system/jobs",
      "/system/settings",
      "/system/about",
      "/sessions",
    ].forEach(expectRoute);
  });
});
