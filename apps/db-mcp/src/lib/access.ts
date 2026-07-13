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

import type { User } from "@cloud-dog/auth";

export const ROLE_NAMES = ["admin", "data_steward", "developer", "analyst", "auditor"] as const;

export const DEFAULT_ROLE_PERMISSIONS: Record<(typeof ROLE_NAMES)[number], readonly string[]> = {
  admin: ["*"],
  data_steward: [
    "catalog.read",
    "schema.read",
    "schema.change",
    "relationship.read",
    "relationship.change",
    "content.search",
    "data.read",
    "data.create",
    "data.update",
    "data.delete",
    "index.manage",
    "profile.manage",
    "audit.read",
  ],
  developer: [
    "catalog.read",
    "schema.read",
    "schema.change",
    "relationship.read",
    "content.search",
    "data.read",
    "data.create",
    "data.update",
    "index.manage",
  ],
  analyst: [
    "catalog.read",
    "schema.read",
    "relationship.read",
    "content.search",
    "data.read",
  ],
  auditor: [
    "catalog.read",
    "schema.read",
    "relationship.read",
    "audit.read",
    "data.read",
  ],
};

export function getEffectivePermissions(user: User | null | undefined): Set<string> {
  const permissions = new Set<string>(user?.permissions ?? []);
  for (const role of user?.roles ?? []) {
    const granted = DEFAULT_ROLE_PERMISSIONS[role as keyof typeof DEFAULT_ROLE_PERMISSIONS];
    for (const permission of granted ?? []) {
      permissions.add(permission);
    }
  }
  return permissions;
}

export function hasRole(user: User | null | undefined, role: string): boolean {
  return (user?.roles ?? []).includes(role);
}

export function hasPermission(user: User | null | undefined, permission: string): boolean {
  const permissions = getEffectivePermissions(user);
  return permissions.has("*") || permissions.has(permission);
}

export function hasAnyPermission(user: User | null | undefined, permissions: string[]): boolean {
  return permissions.some((permission) => hasPermission(user, permission));
}

export function canManageProfiles(user: User | null | undefined): boolean {
  return hasRole(user, "admin") || hasRole(user, "data_steward") || hasPermission(user, "profile.manage");
}

export function canManageSourceConnections(user: User | null | undefined): boolean {
  return hasRole(user, "admin") || hasPermission(user, "admin.write");
}

export function canCreateOrUpdateData(user: User | null | undefined): boolean {
  return hasAnyPermission(user, ["data.create", "data.update", "data.delete"]);
}

export function canDeleteData(user: User | null | undefined): boolean {
  return hasPermission(user, "data.delete");
}

export function canManageRelationships(user: User | null | undefined): boolean {
  return hasPermission(user, "relationship.change");
}
