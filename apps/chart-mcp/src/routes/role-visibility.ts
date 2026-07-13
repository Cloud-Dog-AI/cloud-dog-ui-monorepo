// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//     http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.

// W28F-931 role-visibility helper for the chart-mcp WebUI navigation.
// Mirrors the 7-role catalogue from src/chart_mcp_server/platform/auth.py
// (chart.operator/chart.designer/chart.renderer_admin/chart.asset_admin/
// chart.viewer/chart.admin/chart.auditor). UI hiding is a UX hint only —
// the API tier remains the source of truth for RBAC (403).

import type { NavItemType } from "@cloud-dog/shell";

export type RoleId =
  | "chart.viewer"
  | "chart.operator"
  | "chart.designer"
  | "chart.renderer_admin"
  | "chart.asset_admin"
  | "chart.admin"
  | "chart.auditor"
  // Platform / IDAM roles surfaced via shared IDAM pages.
  | "admin"
  | "read-only"
  | "read-write"
  | string;

export const ALL_CHART_ROLES: readonly RoleId[] = [
  "chart.viewer",
  "chart.operator",
  "chart.designer",
  "chart.renderer_admin",
  "chart.asset_admin",
  "chart.admin",
  "chart.auditor",
];

// Role-set tokens used by the App router. Each token is the set of role IDs
// for which the route's NavItem is shown. The Route itself is always mounted
// (so deep links from admin / auditor / API contracts still resolve); the
// nav filter only controls menu visibility.
export const ROLE_ANY_AUTHED: readonly RoleId[] = [
  "chart.viewer",
  "chart.operator",
  "chart.designer",
  "chart.renderer_admin",
  "chart.asset_admin",
  "chart.admin",
  "chart.auditor",
  "admin",
  "read-only",
  "read-write",
];

// W28F-931 R4 alignment: narrower role-bound visibility sets that mirror
// the backend CHART_ROLE_PERMISSIONS catalogue's per-permission roster.
// chart.renderer_admin's permissions exclude session/profile/style; the
// "Sessions" / "Profiles" / "Style Packs" / "Style Selector" nav items
// were previously ROLE_ANY_AUTHED, which mis-advertised those pages to
// renderer_admin. chart.asset_admin similarly lacks profile / session /
// renderer / job perms; corrected here.
export const ROLE_HAS_SESSION_READ: readonly RoleId[] = [
  "chart.viewer", "chart.operator", "chart.designer",
  "chart.admin", "chart.auditor",
  "admin", "read-only", "read-write",
];
export const ROLE_HAS_PROFILE_READ: readonly RoleId[] = [
  "chart.viewer", "chart.operator", "chart.designer",
  "chart.admin", "chart.auditor",
  "admin", "read-only", "read-write",
];
export const ROLE_HAS_STYLE_READ: readonly RoleId[] = [
  "chart.viewer", "chart.operator", "chart.designer",
  "chart.asset_admin", "chart.admin", "chart.auditor",
  "admin", "read-only", "read-write",
];
export const ROLE_HAS_RENDERER_READ: readonly RoleId[] = [
  "chart.viewer", "chart.operator", "chart.designer",
  "chart.renderer_admin", "chart.admin", "chart.auditor",
  "admin", "read-only", "read-write",
];
export const ROLE_HAS_JOB_READ: readonly RoleId[] = [
  "chart.viewer", "chart.operator", "chart.designer",
  "chart.renderer_admin", "chart.admin", "chart.auditor",
  "admin", "read-only", "read-write",
];
export const ROLE_HAS_RECOMMEND: readonly RoleId[] = [
  "chart.viewer", "chart.operator", "chart.designer",
  "chart.admin", "chart.auditor",
  "admin", "read-only", "read-write",
];

export const ROLE_OPERATOR_PLUS: readonly RoleId[] = [
  "chart.operator",
  "chart.designer",
  "chart.renderer_admin",
  "chart.asset_admin",
  "chart.admin",
];

export const ROLE_DESIGNER_PLUS: readonly RoleId[] = [
  "chart.designer",
  "chart.renderer_admin",
  "chart.asset_admin",
  "chart.admin",
];

export const ROLE_ASSET_ADMIN_PLUS: readonly RoleId[] = [
  "chart.asset_admin",
  "chart.admin",
];

export const ROLE_RENDERER_ADMIN_PLUS: readonly RoleId[] = [
  "chart.renderer_admin",
  "chart.admin",
  "chart.auditor",
];

export const ROLE_ADMIN_AUDITOR: readonly RoleId[] = [
  "chart.admin",
  "chart.auditor",
  "admin",
];

export const ROLE_ADMIN_ONLY: readonly RoleId[] = ["chart.admin", "admin"];

// W28F-931 R4: alignment with backend CHART_ROLE_PERMISSIONS.
//
// The R2 role-visibility intent (commit c412403) treated viewer as a
// "navigate-from-dashboard-only" role. The actual W28F-930 RBAC catalogue
// (src/chart_mcp_server/platform/auth.py CHART_ROLE_PERMISSIONS) grants
// chart.viewer broad READ access (profile:read / session:read / render:read /
// recommend / validate / asset:read / style:read / job:read / renderer:read).
// The PW5 audit (Boundary 5) revealed the divergence: the SPA hid nav items
// for pages whose backend permitted the viewer's API calls (style-packs,
// recommendations, data-preview, style-selector, etc.). That created a UX
// gap where the viewer was BLOCKED from discovering routes it could read,
// while the backend was already returning 200. Per W28F-931 §3.5 directive
// "update role-visibility.ts to declare the true intended visibility",
// the catalogue below now matches the backend RBAC catalogue.
export const ROLE_VIEWER_READS: readonly RoleId[] = [
  // chart.viewer + all read-or-write roles. recommend/validate/style:read
  // are viewer-grantable per CHART_ROLE_PERMISSIONS["chart.viewer"].
  "chart.viewer",
  "chart.operator",
  "chart.designer",
  "chart.renderer_admin",
  "chart.asset_admin",
  "chart.admin",
  "chart.auditor",
  "admin",
  "read-only",
  "read-write",
];

// Designer-plus + viewer (where read-only style-pack viewing is allowed).
export const ROLE_STYLE_VIEW: readonly RoleId[] = [
  "chart.viewer",
  "chart.operator",
  "chart.designer",
  "chart.renderer_admin",
  "chart.asset_admin",
  "chart.admin",
  "chart.auditor",
  "admin",
];

// Auditor catalogue: read renders/assets/sessions + audit-log + config.
export const ROLE_AUDITOR_PLUS_VIEWER: readonly RoleId[] = [
  "chart.viewer",
  "chart.operator",
  "chart.designer",
  "chart.renderer_admin",
  "chart.asset_admin",
  "chart.admin",
  "chart.auditor",
  "admin",
];

export type NavRoleConfig = Readonly<{
  path: string;
  allowedRoles: readonly RoleId[];
}>;

/** Per-path role visibility — used by both nav filtering and the UT.
 *
 * W28F-931 R4 alignment: the allowedRoles for each path mirrors the backend
 * CHART_ROLE_PERMISSIONS catalogue's READ surface. Form/action pages
 * (Data Input, Field Mapping, ChartSpec Editor, Render Preview) remain
 * operator+/designer+ since their primary purpose is mutation; pages whose
 * primary purpose is OBSERVATION (Recommendations as a sandbox, Data Preview
 * for visualisation, Style Selector for browsing) are now viewer-visible
 * since the backend's viewer.recommend/validate/style:read permissions make
 * them productively usable. UI hiding remains a UX hint; the backend is the
 * source of truth for 403.
 */
export const ROUTE_ROLE_VISIBILITY: ReadonlyArray<NavRoleConfig> = [
  { path: "/", allowedRoles: ROLE_ANY_AUTHED },
  { path: "/profiles", allowedRoles: ROLE_HAS_PROFILE_READ },
  { path: "/sessions", allowedRoles: ROLE_HAS_SESSION_READ },
  { path: "/data-input", allowedRoles: ROLE_OPERATOR_PLUS },
  { path: "/data-preview", allowedRoles: ROLE_HAS_RECOMMEND },
  { path: "/recommendations", allowedRoles: ROLE_HAS_RECOMMEND },
  { path: "/field-mapping", allowedRoles: ROLE_OPERATOR_PLUS },
  { path: "/chartspec-editor", allowedRoles: ROLE_OPERATOR_PLUS },
  { path: "/style-selector", allowedRoles: ROLE_HAS_STYLE_READ },
  { path: "/style-packs", allowedRoles: ROLE_HAS_STYLE_READ },
  { path: "/locale-selector", allowedRoles: ROLE_ANY_AUTHED },
  { path: "/diagram-panel", allowedRoles: ROLE_OPERATOR_PLUS },
  { path: "/document-panel", allowedRoles: ROLE_OPERATOR_PLUS },
  { path: "/clipart-theming", allowedRoles: ROLE_OPERATOR_PLUS },
  { path: "/render-preview", allowedRoles: ROLE_OPERATOR_PLUS },
  { path: "/renders", allowedRoles: ROLE_ANY_AUTHED },
  { path: "/render-assets", allowedRoles: ROLE_ANY_AUTHED },
  { path: "/renderer-health", allowedRoles: ROLE_HAS_RENDERER_READ },
  { path: "/lifecycle-cache", allowedRoles: ROLE_ASSET_ADMIN_PLUS },
  { path: "/licence-status", allowedRoles: ROLE_RENDERER_ADMIN_PLUS },
  { path: "/audit-log", allowedRoles: ROLE_ADMIN_AUDITOR },
  // PS-WEBUI-URL-CANONICAL v1.0 (W28E-1810C): canonical /developer/* + /system/*
  // are the menu's actual targets; the legacy aliases below are retained so
  // deep links / in-app fallbacks still resolve to the same visibility set.
  { path: "/developer/api-docs", allowedRoles: ROLE_ANY_AUTHED },
  { path: "/developer/mcp-console", allowedRoles: ROLE_ANY_AUTHED },
  { path: "/developer/a2a-console", allowedRoles: ROLE_ANY_AUTHED },
  { path: "/system/jobs", allowedRoles: ROLE_HAS_JOB_READ },
  { path: "/system/settings", allowedRoles: ROLE_ANY_AUTHED },
  { path: "/system/about", allowedRoles: ROLE_ANY_AUTHED },
  // PS-WEBUI-URL-CANONICAL v1.0 (W28E-1810C): canonical /admin/* is the menu target.
  { path: "/admin/users", allowedRoles: ROLE_ADMIN_ONLY },
  { path: "/admin/groups", allowedRoles: ROLE_ADMIN_ONLY },
  { path: "/admin/api-keys", allowedRoles: ROLE_ADMIN_ONLY },
  { path: "/admin/roles", allowedRoles: ROLE_ADMIN_ONLY },
  { path: "/admin/rbac", allowedRoles: ROLE_ADMIN_ONLY },
  // Legacy aliases (routes still mounted; backend 308-redirects direct nav).
  { path: "/jobs", allowedRoles: ROLE_HAS_JOB_READ },
  { path: "/api-docs", allowedRoles: ROLE_ANY_AUTHED },
  { path: "/mcp-console", allowedRoles: ROLE_ANY_AUTHED },
  { path: "/a2a-console", allowedRoles: ROLE_ANY_AUTHED },
  { path: "/settings", allowedRoles: ROLE_ANY_AUTHED },
  { path: "/about", allowedRoles: ROLE_ANY_AUTHED },
  { path: "/idam/users", allowedRoles: ROLE_ADMIN_ONLY },
  { path: "/idam/groups", allowedRoles: ROLE_ADMIN_ONLY },
  { path: "/idam/api-keys", allowedRoles: ROLE_ADMIN_ONLY },
  { path: "/idam/roles", allowedRoles: ROLE_ADMIN_ONLY },
  { path: "/idam/rbac", allowedRoles: ROLE_ADMIN_ONLY },
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

/** Filter a NavItem tree against the active user's roles.
 *
 * W28F-931 R4: container/group items (those with `children`) are NOT
 * subjected to the per-path visibility check — their visibility is
 * derived from the visibility of their (filtered) children. This avoids
 * the trap where the Workflow group container (path "/data-input",
 * ROLE_OPERATOR_PLUS) would hide the whole group from chart.viewer even
 * though some child routes (Data Preview / Recommendations / Style
 * Selector / Locale Selector) are viewer-visible per the R4 alignment
 * with the backend CHART_ROLE_PERMISSIONS catalogue.
 */
export function visibleNavItems(items: NavItemType[], userRoles: readonly string[] | undefined): NavItemType[] {
  const visit = (item: NavItemType): NavItemType | null => {
    const hasChildren = !!(item.children && item.children.length);
    if (hasChildren) {
      // Group/container item — derive visibility from children.
      const kids = item.children!.map(visit).filter((x): x is NavItemType => x !== null);
      if (kids.length === 0) return null;
      return { ...item, children: kids };
    }
    // Leaf item — apply per-path visibility check.
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
