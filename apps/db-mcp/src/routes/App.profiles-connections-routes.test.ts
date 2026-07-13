import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync("src/routes/App.tsx", "utf8");

describe("W28E-1846 profiles/connections route aliases", () => {
  it("maps canonical family routes to the existing db-mcp admin pages", () => {
    expect(appSource).toContain('path="/source-connections" element={<Navigate to={ROUTES.sourceConnections} replace />}');
    expect(appSource).toContain('path="/profiles" element={<Navigate to={ROUTES.profiles} replace />}');
  });
});
