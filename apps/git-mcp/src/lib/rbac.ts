import type * as React from "react";

export type CanonicalGitRole = "admin" | "maintainer" | "writer" | "reader";

export type GitRoleAccess = Readonly<{
  roles: CanonicalGitRole[];
  primaryRole: CanonicalGitRole;
  isAdmin: boolean;
  canAccessAdminPages: boolean;
  canManageProfiles: boolean;
  canWriteRepository: boolean;
  canManageBranches: boolean;
  canManageMerges: boolean;
}>;

function pushRole(target: CanonicalGitRole[], role: CanonicalGitRole) {
  if (!target.includes(role)) target.push(role);
}

export function normaliseGitRoles(rawRoles: unknown): CanonicalGitRole[] {
  const roles = Array.isArray(rawRoles) ? rawRoles : [];
  const mapped: CanonicalGitRole[] = [];
  for (const item of roles) {
    const candidate = String(item ?? "").trim().toLowerCase();
    if (!candidate) continue;
    if (candidate === "admin") {
      pushRole(mapped, "admin");
      continue;
    }
    if (candidate === "maintainer" || candidate === "developer" || candidate === "dev" || candidate === "editor") {
      pushRole(mapped, "maintainer");
      continue;
    }
    if (candidate === "writer" || candidate === "contributor" || candidate === "user") {
      pushRole(mapped, "writer");
      continue;
    }
    if (candidate === "reader" || candidate === "viewer") {
      pushRole(mapped, "reader");
    }
  }
  if (!mapped.length) mapped.push("admin");
  return mapped;
}

export function getGitRoleAccess(rawRoles: unknown): GitRoleAccess {
  const roles = normaliseGitRoles(rawRoles);
  const isAdmin = roles.includes("admin");
  const canManageProfiles = isAdmin || roles.includes("maintainer");
  const canWriteRepository = canManageProfiles || roles.includes("writer");
  return {
    roles,
    primaryRole: roles[0] ?? "reader",
    isAdmin,
    canAccessAdminPages: isAdmin,
    canManageProfiles,
    canWriteRepository,
    canManageBranches: canWriteRepository,
    canManageMerges: isAdmin || roles.includes("maintainer"),
  };
}

export function firstUserRoles(user: { roles?: unknown } | null | undefined): CanonicalGitRole[] {
  return normaliseGitRoles(user?.roles);
}

export function roleBadgeTone(role: CanonicalGitRole): React.ComponentProps<"span">["className"] {
  if (role === "admin") return "bg-red-600 text-white border-red-700";
  if (role === "maintainer") return "bg-amber-600 text-white border-amber-700";
  if (role === "writer") return "bg-emerald-600 text-white border-emerald-700";
  return "bg-slate-600 text-white border-slate-700";
}
