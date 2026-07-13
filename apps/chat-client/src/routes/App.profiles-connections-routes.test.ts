import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync("src/routes/App.tsx", "utf8");

describe("W28E-1846 profiles/connections route aliases", () => {
  it("maps the canonical source-connections route to MCP Servers", () => {
    expect(appSource).toContain('path="/source-connections" element={<Navigate to="/mcp-servers" replace />}');
  });
});
