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

// @cloud-dog/shell — UserBadge: auth-backed user identity menu with logout.

import * as React from "react";
import { useAuth } from "@cloud-dog/auth";
import { Avatar, Button, DropdownMenu, cn } from "@cloud-dog/ui";
import type { UserMenuConfig } from "../types/nav.js";

export interface UserBadgeProps {
  config?: UserMenuConfig;
  className?: string;
}

export function UserBadge(props: UserBadgeProps) {
  let auth:
    | ReturnType<typeof useAuth>
    | undefined;

  try {
    auth = useAuth();
  } catch {
    auth = undefined;
  }

  const displayName = props.config?.displayName ?? auth?.user?.displayName ?? "";
  const email = props.config?.email ?? auth?.user?.email ?? "";
  const avatarUrl = props.config?.avatarUrl;
  const hasSession = Boolean(auth?.isAuthenticated && auth.user);
  const canLogout = Boolean(props.config?.onLogout ?? auth);

  const items = [
    props.config?.onAbout
      ? { id: "about", label: "About", onSelect: props.config.onAbout }
      : null,
    props.config?.onProfile
      ? { id: "profile", label: "Profile", onSelect: props.config.onProfile }
      : null,
    props.config?.onSettings
      ? { id: "settings", label: "Settings", onSelect: props.config.onSettings }
      : null,
    canLogout
      ? {
          id: "logout",
          label: "Sign out",
          onSelect: () => {
            if (props.config?.onLogout) {
              props.config.onLogout();
              return;
            }
            void auth?.logout();
          },
        }
      : null,
  ].filter((item): item is NonNullable<typeof item> => item !== null);

  if (!displayName && items.length === 0 && !hasSession) {
    return null;
  }

  const fallback = (displayName || "U").slice(0, 1).toUpperCase();

  return (
    <DropdownMenu
      trigger={
        <Button
          variant="ghost"
          aria-label="User menu"
          className={cn("h-auto min-w-0 gap-2 px-2 py-1", props.className)}
        >
          <Avatar alt={displayName || "User"} src={avatarUrl} fallback={fallback} />
          <span className="hidden max-w-40 truncate text-sm font-medium sm:inline">
            {displayName || "Signed in"}
          </span>
        </Button>
      }
      items={items}
      header={
        <div className="px-3 py-2">
          <div className="text-sm font-semibold">{displayName || "Signed in"}</div>
          {email ? <div className="text-xs text-muted-foreground">{email}</div> : null}
        </div>
      }
    />
  );
}
