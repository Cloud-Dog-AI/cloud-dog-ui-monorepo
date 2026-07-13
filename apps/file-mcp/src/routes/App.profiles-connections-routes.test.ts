import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const appSource = readFileSync("src/routes/App.tsx", "utf8");

describe("W28E-1846 profiles/connections route aliases", () => {
  it("maps canonical family routes to Storage Profiles", () => {
    expect(appSource).toContain('path="/profiles" element={<Navigate to={ROUTES.storageProfiles} replace />}');
    expect(appSource).toContain('path="/source-connections" element={<Navigate to={ROUTES.storageProfiles} replace />}');
  });
});
