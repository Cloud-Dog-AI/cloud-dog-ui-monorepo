import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { resolve } from "node:path";

const REPO_ROOT = resolve(fileURLToPath(new URL("../../../../", import.meta.url)));

const ROUTE_FILES = [
  "apps/chart-mcp/src/routes/App.tsx",
  "apps/chat-client/src/routes/App.tsx",
  "apps/code-runner/src/routes/App.tsx",
  "apps/db-mcp/src/routes/App.tsx",
  "apps/expert-agent/src/routes/App.tsx",
  "apps/file-mcp/src/routes/App.tsx",
  "apps/geospatial/src/routes/App.tsx",
  "apps/git-mcp/src/routes/App.tsx",
  "apps/imap-mcp/src/routes/App.tsx",
  "apps/index-retriever/src/routes/App.tsx",
  "apps/notification-agent/src/routes/App.tsx",
  "apps/sbom-mcp/src/routes/App.tsx",
  "apps/scheduler-mcp/src/routes/App.tsx",
  "apps/sql-agent/src/routes/App.tsx",
] as const;

const REQUIRED_ALIASES = ["/audit", "/diagnostics-audit", "/observability", "/logs"] as const;

function source(path: string): string {
  return readFileSync(resolve(REPO_ROOT, path), "utf8");
}

function hasCanonicalAuditRoute(text: string): boolean {
  return text.includes('path="/audit-log"') || text.includes('auditLog: "/audit-log"');
}

describe("W28E-1841 audit route contract", () => {
  it.each(ROUTE_FILES)("%s uses canonical Audit Log nav label and /audit-log route", (path) => {
    const text = source(path);
    expect(text).toContain("Audit Log");
    expect(hasCanonicalAuditRoute(text)).toBe(true);
  });

  it.each(ROUTE_FILES)("%s redirects observed audit-family aliases to /audit-log", (path) => {
    const text = source(path);
    for (const alias of REQUIRED_ALIASES) {
      expect(text).toContain(`path="${alias}"`);
      expect(text).toContain("/audit-log");
    }
  });

  it("redirects monitoring aliases where the family historically used monitoring wording", () => {
    for (const path of [
      "apps/chat-client/src/routes/App.tsx",
      "apps/expert-agent/src/routes/App.tsx",
      "apps/notification-agent/src/routes/App.tsx",
    ]) {
      const text = source(path);
      expect(text).toContain('path="/monitoring"');
      expect(text).toContain("/audit-log");
    }
  });
});
