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

// @cloud-dog/shell — Permission-aware nav item.

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { NavItem } from "./NavItem.js";
import type { NavItem as NavItemType } from "../types/nav.js";

export function PermissionNavItem(props: { item: NavItemType }) {
  try {
    const auth = useAuth();
    if (auth.isLoading) return null;
    if (props.item.requiredPermission && !auth.hasPermission(props.item.requiredPermission)) {
      return null;
    }
  } catch {
    // AuthProvider is optional for shell consumers; default allow.
  }

  return <NavItem item={props.item} />;
}
