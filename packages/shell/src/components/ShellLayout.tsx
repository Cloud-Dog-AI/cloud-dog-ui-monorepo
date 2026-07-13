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

// @cloud-dog/shell — Canonical Cloud-Dog shell layout wrapper.

import * as React from "react";
import type { BreadcrumbItem, NavItem, UserMenuConfig } from "../types/nav.js";
import { ShellProvider } from "../context/ShellContext.js";
import { SkipLink } from "./SkipLink.js";
import { TopBar } from "./TopBar.js";
import { LeftNav } from "./LeftNav.js";
import { MobileDrawer } from "./MobileDrawer.js";
import type { ShellPreset } from "../presets/types.js";

export interface ShellLayoutProps {
  appName?: string;
  navItems: NavItem[];
  userMenu?: UserMenuConfig;
  breadcrumbs?: BreadcrumbItem[];
  children: React.ReactNode;
  footer?: React.ReactNode;
  preset?: ShellPreset;
  showNav?: boolean;
  homePath?: string;
  onHomeNavigate?: (path: string) => void;
  testIdPrefix?: string;
}

export function ShellLayout(props: ShellLayoutProps) {
  const showNav = props.showNav ?? true;
  const testIdPrefix = props.testIdPrefix ?? "cloud-dog-shell";
  return (
    <ShellProvider>
      <SkipLink />
      <header data-testid={`${testIdPrefix}-top-bar`}>
        <TopBar
          appName={props.appName}
          userMenu={props.userMenu}
          breadcrumbs={props.breadcrumbs}
          homePath={props.homePath}
          onHomeNavigate={props.onHomeNavigate}
          testIdPrefix={testIdPrefix}
        />
      </header>

      {showNav ? (
        <div className="grid grid-cols-1 md:grid-cols-[auto_minmax(0,1fr)]" data-testid={`${testIdPrefix}-layout`}>
          <nav aria-label="Main navigation" className="hidden md:block" data-testid={`${testIdPrefix}-left-nav`}>
            <LeftNav items={props.navItems} width={props.preset?.leftNavWidth} testIdPrefix={testIdPrefix} />
          </nav>

          <MobileDrawer items={props.navItems} testIdPrefix={testIdPrefix} />

          <main
            id="main-content"
            className="min-w-0 min-h-[calc(100vh-3.5rem)] bg-muted/10"
            data-testid={`${testIdPrefix}-main`}
          >
            <div className={props.preset?.contentClassName ?? "p-6"}>{props.children}</div>
            {props.footer ? <div data-testid={`${testIdPrefix}-footer`}>{props.footer}</div> : null}
          </main>
        </div>
      ) : (
        <main
          id="main-content"
          className="min-w-0 min-h-[calc(100vh-3.5rem)] bg-muted/10"
          data-testid={`${testIdPrefix}-main`}
        >
          <div className={props.preset?.contentClassName ?? "p-6"}>{props.children}</div>
          {props.footer ? <div data-testid={`${testIdPrefix}-footer`}>{props.footer}</div> : null}
        </main>
      )}
    </ShellProvider>
  );
}
