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

// @cloud-dog/shell — Collapsible left navigation rail.

import * as React from "react";
import { cn } from "@cloud-dog/ui";
import type { NavItem as NavItemType } from "../types/nav.js";
import { NavItem } from "./NavItem.js";
import { NavGroup } from "./NavGroup.js";
import { useShell } from "../context/useShell.js";
import { useAuth } from "@cloud-dog/auth";

function partition(items: NavItemType[]) {
  const groups: Array<{ label: string; items: NavItemType[] }> = [];
  const singles: NavItemType[] = [];
  for (const it of items) {
    if (it.children?.length) groups.push({ label: it.label, items: it.children });
    else singles.push(it);
  }
  return { groups, singles };
}

export type LeftNavMode = "rail" | "drawer";

export type LeftNavWidth = Readonly<{ expanded: string; collapsed: string }>;

export function LeftNav(props: {
  items: NavItemType[];
  mode?: LeftNavMode;
  width?: LeftNavWidth;
}) {
  const shell = useShell();
  const mode: LeftNavMode = props.mode ?? "rail";
  const width = props.width ?? { expanded: "w-60", collapsed: "w-16" };
  let hasPermission: (p: string) => boolean = () => true;
  try {
    const auth = useAuth();
    hasPermission = auth.hasPermission;
  } catch {
    // AuthProvider is optional for shell consumers.
  }

  const filtered = React.useMemo(() => {
    const filterItems = (items: NavItemType[]): NavItemType[] =>
      items
        .filter((it) => {
          if (!it.requiredPermission) return true;
          return hasPermission(it.requiredPermission);
        })
        .map((it) => ({
          ...it,
          children: it.children ? filterItems(it.children) : undefined,
        }));
    return filterItems(props.items);
  }, [props.items, hasPermission]);

  const { groups, singles } = partition(filtered);

  return (
    <div
      className={cn(
        "relative border-r bg-background",
        mode === "drawer" ? "h-full w-full" : "h-[calc(100vh-3.5rem)]",
        mode === "drawer"
          ? "w-full"
          : shell.navCollapsed
          ? width.collapsed
          : width.expanded
      )}
    >
      <div className="h-full overflow-y-auto py-3">
        <div className={cn("px-2 space-y-1", shell.navCollapsed ? "px-1" : "px-2")}>
          {singles.map((it) => (
            <NavItem key={it.path} item={it} />
          ))}
        </div>

        <div className="mt-3 space-y-2">
          {groups.map((g) => (
            <NavGroup key={g.label} label={g.label} items={g.items} />
          ))}
        </div>
      </div>

      {mode === "rail" ? (
        <button
          type="button"
          className={cn(
            "absolute bottom-3 right-2 h-8 w-8 rounded-md border bg-background shadow-sm hover:bg-accent hover:text-accent-foreground grid place-items-center",
            "focus:outline-none focus:ring-2 focus:ring-ring"
          )}
          aria-label={shell.navCollapsed ? "Expand navigation" : "Collapse navigation"}
          onClick={() => shell.toggleNav()}
        >
          <span aria-hidden="true">{shell.navCollapsed ? ">>" : "<<"}</span>
        </button>
      ) : null}
    </div>
  );
}
