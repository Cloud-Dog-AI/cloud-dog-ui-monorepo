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

export function isReadOnlyUser(user: User | null | undefined): boolean {
  return !isAdminUser(user);
}
