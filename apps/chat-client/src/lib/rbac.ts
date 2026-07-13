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

function toLowerSet(values: string[] | undefined): Set<string> {
  return new Set((values ?? []).map((value) => String(value).trim().toLowerCase()).filter(Boolean));
}

export function isAdminUser(user: User | null | undefined): boolean {
  if (!user) return false;
  const roles = toLowerSet(user.roles);
  const permissions = toLowerSet(user.permissions);
  return (
    roles.has("admin")
    || permissions.has("*")
    || permissions.has("admin")
    || permissions.has("admin:*")
    || permissions.has("rbac:write")
  );
}

// W28A-727-R5 flat login: three roles — admin / read-write / read-only.
// `canWrite` is true for admin AND read-write (they may mutate data); only the
// read-only role is denied. Backed by the shared cloud_dog_idam guard server-side
// (web_flat_roles.role_can_write + the read-only write-gate → 403-inline), this
// gates the matching UI affordances so a read-write operator keeps write controls
// while a read-only visitor sees a view-only UI.
const _READ_WRITE_ROLE_ALIASES = new Set([
  "read-write",
  "read_write",
  "readwrite",
  "writer",
  "editor",
  "user",
  "member",
]);

const _WRITE_PERMISSION_MARKERS = new Set([
  "*",
  "chat:message:send",
  "chat:conversation:delete",
  "config:write",
  "profiles:write",
  "file:write",
]);

export function canWrite(user: User | null | undefined): boolean {
  if (!user) return false;
  if (isAdminUser(user)) return true;
  const roles = toLowerSet(user.roles);
  for (const role of roles) {
    if (_READ_WRITE_ROLE_ALIASES.has(role)) return true;
  }
  const permissions = toLowerSet(user.permissions);
  for (const marker of _WRITE_PERMISSION_MARKERS) {
    if (permissions.has(marker)) return true;
  }
  return false;
}

export function isReadOnlyUser(user: User | null | undefined): boolean {
  // Truly read-only: not admin AND not read-write (fail-closed for unknown roles).
  return !canWrite(user);
}
