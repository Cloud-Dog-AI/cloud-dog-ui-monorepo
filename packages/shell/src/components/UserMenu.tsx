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

// @cloud-dog/shell — User menu dropdown.

import * as React from "react";
import { Avatar, Button, DropdownMenu } from "@cloud-dog/ui";
import type { UserMenuConfig } from "../types/nav.js";

export function UserMenu(props: { config?: UserMenuConfig }) {
  const cfg = props.config;
  if (!cfg) return null;

  return (
    <DropdownMenu
      trigger={
        <Button variant="ghost" size="icon" aria-label="User menu">
          <Avatar
            alt={cfg.displayName ?? "User"}
            src={cfg.avatarUrl}
            fallback={(cfg.displayName ?? "U").slice(0, 1)}
          />
        </Button>
      }
      items={[
        cfg.onProfile
          ? { id: "profile", label: "Profile", onSelect: cfg.onProfile }
          : null,
        cfg.onSettings
          ? { id: "settings", label: "Settings", onSelect: cfg.onSettings }
          : null,
        cfg.onLogout ? { id: "logout", label: "Sign out", onSelect: cfg.onLogout } : null,
      ].filter(Boolean) as any}
      header={
        <div className="px-3 py-2">
          <div className="text-sm font-semibold">{cfg.displayName ?? "Signed in"}</div>
          {cfg.email ? <div className="text-xs text-muted-foreground">{cfg.email}</div> : null}
        </div>
      }
    />
  );
}
