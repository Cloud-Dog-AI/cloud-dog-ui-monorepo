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

// @cloud-dog/shell — Single navigation item.

import * as React from "react";
import { Link, useLocation } from "react-router-dom";
import { cn } from "@cloud-dog/ui";
import type { NavItem as NavItemType } from "../types/nav.js";
import { useShell } from "../context/useShell.js";

export function NavItem(props: { item: NavItemType }) {
  const shell = useShell();
  const loc = useLocation();
  const active = loc.pathname === props.item.path;

  return (
    <Link
      to={props.item.path}
      className={cn(
        "flex items-center gap-3 rounded-md px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground",
        active ? "bg-accent text-accent-foreground font-medium" : "text-foreground"
      )}
      title={shell.navCollapsed ? props.item.label : undefined}
      onClick={(event) => {
        if (props.item.onSelect) {
          event.preventDefault();
          props.item.onSelect();
        }
        shell.closeMobileDrawer();
      }}
    >
      <span aria-hidden="true" className="h-5 w-5 grid place-items-center shrink-0">
        {props.item.icon}
      </span>
      {!shell.navCollapsed ? <span className="truncate">{props.item.label}</span> : null}
      {!shell.navCollapsed && props.item.badge !== undefined ? (
        <span className="ml-auto text-xs rounded-full bg-muted px-2 py-0.5">
          {props.item.badge}
        </span>
      ) : null}
    </Link>
  );
}
