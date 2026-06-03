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

// @cloud-dog/shell — Collapsible nav group.

import * as React from "react";
import type { NavItem as NavItemType } from "../types/nav.js";
import { NavItem } from "./NavItem.js";
import { cn } from "@cloud-dog/ui";
import { useShell } from "../context/useShell.js";

export function NavGroup(props: { label: string; items: NavItemType[] }) {
  const shell = useShell();
  const [open, setOpen] = React.useState(true);

  return (
    <div>
      <button
        type="button"
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2 text-xs font-semibold uppercase tracking-wide text-muted-foreground",
          shell.navCollapsed ? "justify-center" : "justify-between"
        )}
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
      >
        {!shell.navCollapsed ? <span>{props.label}</span> : <span aria-hidden="true">•</span>}
        {!shell.navCollapsed ? <span aria-hidden="true">{open ? "−" : "+"}</span> : null}
      </button>
      {open ? (
        <div className="px-2 space-y-1">
          {props.items.map((it) => (
            <NavItem key={it.path} item={it} />
          ))}
        </div>
      ) : null}
    </div>
  );
}
