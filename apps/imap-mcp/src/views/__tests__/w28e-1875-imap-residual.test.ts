// W28E-1875 — IMAP residual WebUI snag closure regression guards.
//
// Each residual row from WEBUI-SNAG-LIST-CORRECTED-2026-07-07 (§IMAP full disposition)
// is closed on origin/main; these source-level assertions (same pattern as
// App.profiles-connections-routes.test.ts) pin the closed state so a future edit cannot
// silently regress it. C-b (collapsed Raw-config <details>) already has a live-render
// guard in profiles-fix-wave-b.test.tsx and is not duplicated here.
//
//   C-e / C-e'  Gmail Edit dialog: IMAP-only fields filtered + "Re-authorise Gmail" link
//   IMAP-064    FileBrowser mutations tab retained (functional, gate-driven) — KEEP ruling
//   IMAP-232    Settings keeps a single canonical Import/Export surface — intent ruling
//   CLEAN-1     bespoke Admin{Users,Groups,ApiKeys}Page removed; /admin/* uses @cloud-dog/idam
//   CLEAN-2     dead legacyDraft/buildLegacyPayload/syncLegacyFormToJson removed
//   CLEAN-4     /mutation-gating redirect route deleted

import { existsSync, readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const profilesSource = readFileSync("src/views/StorageProfilesPage.tsx", "utf8");
const fileBrowserSource = readFileSync("src/views/FileBrowserPage.tsx", "utf8");
const settingsSource = readFileSync("src/views/SettingsPage.tsx", "utf8");
const appSource = readFileSync("src/routes/App.tsx", "utf8");

describe("W28E-1875 C-e / C-e' — Gmail provider-specific auth section", () => {
  it("filters the IMAP-only fields for gmail providers (no bare username/password inputs)", () => {
    expect(profilesSource).toContain('if (draft.provider === "gmail")');
    expect(profilesSource).toContain(
      'return !["host", "port", "security", "username", "password"].includes(field.name);',
    );
  });

  it("offers a Re-authorise Gmail entry point to the dedicated OAuth page (C-e replacement)", () => {
    expect(profilesSource).toContain("Re-authorise Gmail");
    expect(profilesSource).toContain("/gmail-settings?profile=");
  });
});

describe("W28E-1875 IMAP-064 — FileBrowser mutations tab retained (KEEP ruling)", () => {
  it("keeps the functional Mutations tab trigger", () => {
    expect(fileBrowserSource).toContain('<TabsTrigger value="mutations">Mutations</TabsTrigger>');
  });

  it("keeps the mutations tab wired to the gated bulk-action handler", () => {
    expect(fileBrowserSource).toContain("runBulkAction");
  });
});

describe("W28E-1875 IMAP-232 — single canonical Import/Export surface (intent ruling)", () => {
  it("documents the single-surface decision and renders the canonical control", () => {
    expect(settingsSource).toContain("IMAP-232: single Import/Export surface");
    expect(settingsSource).toContain("Import / Export settings");
  });

  it("wires Import/Export to the real settings API, not a stub", () => {
    expect(settingsSource).toContain("api.updateSettings");
  });
});

describe("W28E-1875 CLEAN-1 — bespoke Admin pages removed; /admin/* uses shared idam", () => {
  it("has no bespoke Admin{Users,Groups,ApiKeys}Page view files", () => {
    expect(existsSync("src/views/AdminUsersPage.tsx")).toBe(false);
    expect(existsSync("src/views/AdminGroupsPage.tsx")).toBe(false);
    expect(existsSync("src/views/AdminApiKeysPage.tsx")).toBe(false);
  });

  it("routes /admin/* to the shared @cloud-dog/idam components", () => {
    expect(appSource).toContain("IdamUsersPage");
    expect(appSource).toContain('path: "/admin/users"');
  });
});

describe("W28E-1875 CLEAN-2 — dead StorageProfiles legacy code removed", () => {
  it("contains none of the removed legacy identifiers", () => {
    expect(profilesSource).not.toContain("legacyDraft");
    expect(profilesSource).not.toContain("buildLegacyPayload");
    expect(profilesSource).not.toContain("syncLegacyFormToJson");
  });
});

describe("W28E-1875 CLEAN-4 — /mutation-gating redirect route deleted", () => {
  it("has no /mutation-gating route left in the router", () => {
    expect(appSource).not.toContain("mutation-gating");
  });
});
