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

// @cloud-dog/shell — Mobile navigation drawer overlay.

import * as React from "react";
import { Sheet } from "@cloud-dog/ui";
import type { NavItem } from "../types/nav.js";
import { useShell } from "../context/useShell.js";
import { LeftNav } from "./LeftNav.js";

export function MobileDrawer(props: { items: NavItem[] }) {
  const shell = useShell();
  return (
    <div className="md:hidden">
      <Sheet open={shell.mobileDrawerOpen} onOpenChange={(o) => shell.setMobileDrawerOpen(o)} side="left">
        <div className="h-full">
          <LeftNav items={props.items} mode="drawer" />
        </div>
      </Sheet>
    </div>
  );
}
