// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0
//
// W28K-1408 F-1408-3 — scope helper unit coverage (mirrors backend
// Principal.has_scope: schedules.admin is the superuser scope).

import { describe, expect, it } from "vitest";
import { SCOPES, hasScope } from "../rbac";

describe("hasScope", () => {
  it("grants the exact scope when present", () => {
    expect(hasScope(["schedules.read"], SCOPES.read)).toBe(true);
    expect(hasScope(["schedules.write"], SCOPES.write)).toBe(true);
  });

  it("denies a scope that is absent (read-only principal)", () => {
    expect(hasScope(["schedules.read"], SCOPES.write)).toBe(false);
    expect(hasScope(["schedules.read"], SCOPES.runNow)).toBe(false);
    expect(hasScope(["schedules.read"], SCOPES.admin)).toBe(false);
  });

  it("treats schedules.admin as the superuser scope (grants everything)", () => {
    const admin = ["schedules.admin"];
    expect(hasScope(admin, SCOPES.read)).toBe(true);
    expect(hasScope(admin, SCOPES.write)).toBe(true);
    expect(hasScope(admin, SCOPES.runNow)).toBe(true);
    expect(hasScope(admin, SCOPES.settingsReveal)).toBe(true);
  });

  it("denies everything for an empty (anon) scope set", () => {
    expect(hasScope([], SCOPES.read)).toBe(false);
    expect(hasScope([], SCOPES.write)).toBe(false);
  });
});
