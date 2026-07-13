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

// @cloud-dog/shell — Fixed top bar (brand, breadcrumbs, user menu, theme).

import * as React from "react";
import { brand } from "@cloud-dog/tokens";
import { Button } from "@cloud-dog/ui";
import { Breadcrumbs } from "./Breadcrumbs.js";
import { ThemeToggle } from "./ThemeToggle.js";
import { UserBadge } from "./UserBadge.js";
import type { BreadcrumbItem, UserMenuConfig } from "../types/nav.js";
import { useShell } from "../context/useShell.js";

export function TopBar(props: {
  appName?: string;
  userMenu?: UserMenuConfig;
  breadcrumbs?: BreadcrumbItem[];
  homePath?: string;
  onHomeNavigate?: (path: string) => void;
  testIdPrefix?: string;
}) {
  const shell = useShell();
  const title = props.appName ? `${brand.name} : ${props.appName}` : brand.name;
  const homePath = props.homePath ?? "/";
  const testIdPrefix = props.testIdPrefix ?? "cloud-dog-shell";

  return (
    <div
      className="h-14 border-b bg-background text-foreground flex items-center gap-3 px-3"
      data-testid={`${testIdPrefix}-top-bar-content`}
    >
      {/* Mobile navigation landmark: the persistent Main navigation <nav> is
          `hidden md:block`, so on small screens the shell would otherwise expose NO
          navigation landmark until the drawer opens. Wrapping the mobile trigger in a
          `md:hidden` <nav> gives mobile viewports exactly one visible navigation
          landmark (mirroring the desktop one, which is `hidden md:block`). */}
      <nav aria-label="Mobile navigation" className="md:hidden" data-testid={`${testIdPrefix}-mobile-nav`}>
        <Button
          variant="ghost"
          size="icon"
          aria-label="Open navigation"
          onClick={() => shell.openMobileDrawer()}
          data-testid={`${testIdPrefix}-mobile-nav-trigger`}
        >
          <span aria-hidden="true">≡</span>
        </Button>
      </nav>

      <a
        href={homePath}
        className="flex items-center gap-2 min-w-0 rounded-md focus:outline-none focus:ring-2 focus:ring-ring"
        aria-label="Go to home"
        data-testid={`${testIdPrefix}-home-link`}
        onClick={(event) => {
          if (!props.onHomeNavigate) return;
          event.preventDefault();
          props.onHomeNavigate(homePath);
        }}
      >
        <img src={brand.logoPath} alt="" className="h-6 w-6 shrink-0" />
        <div className="font-semibold truncate">{title}</div>
      </a>

      <div className="flex-1 px-2" data-testid={`${testIdPrefix}-breadcrumbs`}>
        {props.breadcrumbs ? <Breadcrumbs items={props.breadcrumbs} /> : null}
      </div>

      <div className="flex items-center gap-1" data-testid={`${testIdPrefix}-top-actions`}>
        <ThemeToggle />
        <UserBadge config={props.userMenu} testIdPrefix={testIdPrefix} />
      </div>
    </div>
  );
}
