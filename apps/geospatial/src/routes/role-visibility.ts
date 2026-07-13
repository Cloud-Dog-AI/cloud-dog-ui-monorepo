// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0.

// Role-visibility helper for the geospatial-mcp WebUI navigation. Mirrors the
// 7-role catalogue from src/cloud_dog_geospatial_mcp_server/rbac.py
// (geo.viewer/operator/analyst/provider_admin/asset_admin/admin/auditor). UI
// hiding is a UX hint only — the API tier remains the source of truth for RBAC
// (403). Routes are always mounted so deep links still resolve and are gated by
// the backend.

import type { NavItemType } from "@cloud-dog/shell";

export type RoleId =
  | "geo.viewer"
  | "geo.operator"
  | "geo.analyst"
  | "geo.provider_admin"
  | "geo.asset_admin"
  | "geo.admin"
  | "geo.auditor"
  // Platform / IDAM roles surfaced via shared IDAM pages.
  | "admin"
  | "read-only"
  | "read-write"
  | string;

export const ALL_GEO_ROLES: readonly RoleId[] = [
  "geo.viewer",
  "geo.operator",
  "geo.analyst",
  "geo.provider_admin",
  "geo.asset_admin",
  "geo.admin",
  "geo.auditor",
];

// Any authenticated principal (all geo + platform roles).
export const ROLE_ANY_AUTHED: readonly RoleId[] = [
  ...ALL_GEO_ROLES,
  "admin",
  "read-only",
  "read-write",
];

// Read surfaces (geo.viewer + everything above it that can read). Mirrors
// rbac.py _VIEWER: capabilities/profile/provider/session/job/asset/basemap read.
export const ROLE_READS: readonly RoleId[] = [
  "geo.viewer",
  "geo.operator",
  "geo.analyst",
  "geo.provider_admin",
  "geo.asset_admin",
  "geo.admin",
  "geo.auditor",
  "admin",
  "read-only",
  "read-write",
];

// Active query/render ops (geo.geocode.run / feature.search / map.render /
// imagery.search). rbac.py _OPERATOR and up; geo.viewer/auditor are EXCLUDED
// (reader-cannot-geocode/render). Provider/asset admins do not hold these.
export const ROLE_OPERATOR_PLUS: readonly RoleId[] = [
  "geo.operator",
  "geo.analyst",
  "geo.admin",
  "read-write",
];

// Analysis (spatial.analyse / imagery.compare). rbac.py _ANALYST and up.
export const ROLE_ANALYST_PLUS: readonly RoleId[] = [
  "geo.analyst",
  "geo.admin",
];

// Providers page: read for everyone; provider_admin/admin manage.
export const ROLE_PROVIDER_VIEW: readonly RoleId[] = ROLE_READS;

// Audit log: admin + auditor.
export const ROLE_ADMIN_AUDITOR: readonly RoleId[] = [
  "geo.admin",
  "geo.auditor",
  "admin",
];

// IDAM admin pages: geo.admin / platform admin only.
export const ROLE_ADMIN_ONLY: readonly RoleId[] = ["geo.admin", "admin"];

export type NavRoleConfig = Readonly<{
  path: string;
  allowedRoles: readonly RoleId[];
}>;

/** Per-path role visibility — used by both nav filtering and the UT. */
export const ROUTE_ROLE_VISIBILITY: ReadonlyArray<NavRoleConfig> = [
  { path: "/", allowedRoles: ROLE_ANY_AUTHED },
  // geospatial primary pages (CW-M3): active query ops vs read surfaces.
  { path: "/map", allowedRoles: ROLE_OPERATOR_PLUS },
  { path: "/geocode", allowedRoles: ROLE_OPERATOR_PLUS },
  { path: "/features", allowedRoles: ROLE_OPERATOR_PLUS },
  { path: "/imagery", allowedRoles: ROLE_OPERATOR_PLUS },
  { path: "/profiles", allowedRoles: ROLE_READS },
  { path: "/sessions", allowedRoles: ROLE_READS },
  { path: "/providers", allowedRoles: ROLE_PROVIDER_VIEW },
  { path: "/assets", allowedRoles: ROLE_READS },
  { path: "/reports", allowedRoles: ROLE_ANALYST_PLUS },
  // System
  { path: "/system/jobs", allowedRoles: ROLE_READS },
  { path: "/audit-log", allowedRoles: ROLE_ADMIN_AUDITOR },
  // W28H-1122: egress governance status — rbac.py grants geo.status.read to
  // viewer-and-above plus auditor (== ROLE_READS); API 403 remains the truth.
  { path: "/system/egress", allowedRoles: ROLE_READS },
  { path: "/system/settings", allowedRoles: ROLE_ANY_AUTHED },
  { path: "/system/about", allowedRoles: ROLE_ANY_AUTHED },
  // Developer
  { path: "/developer/api-docs", allowedRoles: ROLE_ANY_AUTHED },
  { path: "/developer/mcp-console", allowedRoles: ROLE_ANY_AUTHED },
  { path: "/developer/a2a-console", allowedRoles: ROLE_ANY_AUTHED },
  // Admin / IDAM
  { path: "/admin/users", allowedRoles: ROLE_ADMIN_ONLY },
  { path: "/admin/groups", allowedRoles: ROLE_ADMIN_ONLY },
  { path: "/admin/api-keys", allowedRoles: ROLE_ADMIN_ONLY },
  { path: "/admin/roles", allowedRoles: ROLE_ADMIN_ONLY },
  { path: "/admin/rbac", allowedRoles: ROLE_ADMIN_ONLY },
];

const visibilityByPath = new Map<string, readonly RoleId[]>(
  ROUTE_ROLE_VISIBILITY.map((entry) => [entry.path, entry.allowedRoles])
);

/** True when at least one of the user's roles is in the allowed set. */
export function userIsAuthorised(userRoles: readonly string[] | undefined, allowed: readonly RoleId[]): boolean {
  if (!allowed.length) return true;
  if (!userRoles || userRoles.length === 0) return false;
  const set = new Set<string>(allowed);
  return userRoles.some((r) => set.has(r));
}

/** Filter a NavItem tree against the active user's roles. Group/container items
 * derive visibility from their (filtered) children. */
export function visibleNavItems(items: NavItemType[], userRoles: readonly string[] | undefined): NavItemType[] {
  const visit = (item: NavItemType): NavItemType | null => {
    const hasChildren = !!(item.children && item.children.length);
    if (hasChildren) {
      const kids = item.children!.map(visit).filter((x): x is NavItemType => x !== null);
      if (kids.length === 0) return null;
      return { ...item, children: kids };
    }
    const allowed = visibilityByPath.get(item.path);
    if (allowed && !userIsAuthorised(userRoles, allowed)) return null;
    return item;
  };
  return items.map(visit).filter((x): x is NavItemType => x !== null);
}

/** Exposed for tests + auditors. */
export function allPathsCovered(): string[] {
  return ROUTE_ROLE_VISIBILITY.map((r) => r.path);
}
