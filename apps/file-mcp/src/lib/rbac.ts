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

// @cloud-dog/app-file-mcp — Server-issued permission helpers for affordances only.

import type { User } from "@cloud-dog/auth";

type RbacUser = Pick<User, "permissions"> | null | undefined;

function permissionSet(user: RbacUser): Set<string> {
  return new Set((user?.permissions ?? []).map((value) => value.trim()).filter(Boolean));
}

function hasAny(values: Set<string>, candidates: string[]): boolean {
  return candidates.some((candidate) => values.has(candidate));
}

export function isAdminUser(user: RbacUser): boolean {
  const permissions = permissionSet(user);
  return hasAny(permissions, ["*", "admin:*"]);
}

export function canManageStorageProfiles(user: RbacUser): boolean {
  return isAdminUser(user);
}

export function canManageGoogleDriveSettings(user: RbacUser): boolean {
  const permissions = permissionSet(user);
  return isAdminUser(user) || permissions.has("admin:google_drive");
}

export function canReadProfile(user: RbacUser, profileName: string): boolean {
  const permissions = permissionSet(user);
  if (isAdminUser(user)) return true;
  return hasAny(permissions, [
    "profile:read",
    "profile:write",
    "profile:*",
    `profile:${profileName}`,
    `profile:${profileName}:read`,
    `profile:${profileName}:write`,
  ]);
}

export function canWriteProfile(user: RbacUser, profileName: string): boolean {
  const permissions = permissionSet(user);
  if (isAdminUser(user)) return true;
  return hasAny(permissions, [
    "file:write",
    "profile:write",
    "profile:*",
    `profile:${profileName}`,
    `profile:${profileName}:write`,
  ]);
}
