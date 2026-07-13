// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0.

// GE-DEF-002: Vitest unit tests for the nav role-visibility helper (mirrors the
// backend RBAC role map; UI hiding is a UX hint, the API tier is authoritative).

import { describe, expect, it } from "vitest";
import type { NavItemType } from "@cloud-dog/shell";
import {
  userIsAuthorised,
  visibleNavItems,
  ROLE_OPERATOR_PLUS,
  ROLE_ADMIN_ONLY,
  ROUTE_ROLE_VISIBILITY,
  allPathsCovered,
} from "./role-visibility";

describe("userIsAuthorised", () => {
  it("allows an empty allow-list (public)", () => {
    expect(userIsAuthorised([], [])).toBe(true);
  });
  it("denies an unauthenticated (no-roles) user against a gated set", () => {
    expect(userIsAuthorised([], ROLE_OPERATOR_PLUS)).toBe(false);
    expect(userIsAuthorised(undefined, ROLE_ADMIN_ONLY)).toBe(false);
  });
  it("allows geo.operator on operator-plus surfaces but denies geo.viewer", () => {
    expect(userIsAuthorised(["geo.operator"], ROLE_OPERATOR_PLUS)).toBe(true);
    expect(userIsAuthorised(["geo.viewer"], ROLE_OPERATOR_PLUS)).toBe(false);
  });
  it("gates IDAM admin pages to admins only", () => {
    expect(userIsAuthorised(["geo.admin"], ROLE_ADMIN_ONLY)).toBe(true);
    expect(userIsAuthorised(["geo.auditor"], ROLE_ADMIN_ONLY)).toBe(false);
  });
});

describe("visibleNavItems", () => {
  const nav: NavItemType[] = [
    { label: "Map", path: "/map" } as NavItemType,
    { label: "Profiles", path: "/profiles" } as NavItemType,
    {
      label: "Admin",
      path: "/admin",
      children: [{ label: "Users", path: "/admin/users" } as NavItemType],
    } as NavItemType,
  ];

  it("hides operator-only + admin-only items from a viewer", () => {
    const visible = visibleNavItems(nav, ["geo.viewer"]);
    const paths = visible.flatMap((i) => (i.children ? i.children.map((c) => c.path) : [i.path]));
    expect(paths).toContain("/profiles"); // viewer can read profiles
    expect(paths).not.toContain("/map"); // viewer cannot render
    expect(visible.find((i) => i.path === "/admin")).toBeUndefined(); // empty group dropped
  });

  it("shows map + admin group to a geo.admin", () => {
    const visible = visibleNavItems(nav, ["geo.admin"]);
    const top = visible.map((i) => i.path);
    expect(top).toContain("/map");
    expect(top).toContain("/admin");
  });
});

describe("allPathsCovered", () => {
  it("covers the geospatial pages including the map + admin idam", () => {
    const paths = allPathsCovered();
    expect(paths).toContain("/map");
    expect(paths).toContain("/admin/users");
  });

  it("covers the W28H-1122 egress governance page for readers (viewer + auditor), mirroring geo.status.read", () => {
    expect(allPathsCovered()).toContain("/system/egress");
    const entry = ROUTE_ROLE_VISIBILITY.find((r) => r.path === "/system/egress");
    expect(entry).toBeDefined();
    expect(userIsAuthorised(["geo.viewer"], entry!.allowedRoles)).toBe(true);
    expect(userIsAuthorised(["geo.auditor"], entry!.allowedRoles)).toBe(true);
    expect(userIsAuthorised([], entry!.allowedRoles)).toBe(false);
  });
});
