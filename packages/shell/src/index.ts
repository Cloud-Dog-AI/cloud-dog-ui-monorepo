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

// @cloud-dog/shell — Public exports.

export { ShellLayout } from "./components/ShellLayout.js";
export { TopBar } from "./components/TopBar.js";
export { LeftNav } from "./components/LeftNav.js";
export { NavItem } from "./components/NavItem.js";
export { NavGroup } from "./components/NavGroup.js";
export { RightDrawer } from "./components/RightDrawer.js";
export { SkipLink } from "./components/SkipLink.js";
export { ThemeToggle } from "./components/ThemeToggle.js";
export { UserMenu } from "./components/UserMenu.js";
export { UserBadge } from "./components/UserBadge.js";
export { Breadcrumbs } from "./components/Breadcrumbs.js";
export { MobileDrawer } from "./components/MobileDrawer.js";
export { PermissionNavItem } from "./components/PermissionNavItem.js";
export { ServiceStatusBar } from "./components/ServiceStatusBar.js";
export { VersionInfo } from "./components/VersionInfo.js";
export { CopyrightFooter } from "./components/CopyrightFooter.js";
export { AboutDialog } from "./components/AboutDialog.js";
export { ProfileDialog } from "./components/ProfileDialog.js";
export { DashboardLayout } from "./components/DashboardLayout.js";
export { DocLinks } from "./components/DocLinks.js";

export type { ServiceStatus, ServiceStatusBarProps } from "./components/ServiceStatusBar.js";
export type { VersionInfoProps } from "./components/VersionInfo.js";
export type { CopyrightFooterProps } from "./components/CopyrightFooter.js";
export type { AboutDialogProps } from "./components/AboutDialog.js";
export type { ProfileDialogProps } from "./components/ProfileDialog.js";
export type { DashboardLayoutProps } from "./components/DashboardLayout.js";
export type { DocLinksProps, DocLink } from "./components/DocLinks.js";
export type { UserBadgeProps } from "./components/UserBadge.js";

export { ShellProvider } from "./context/ShellContext.js";
export { useShell } from "./context/useShell.js";
export { useRightDrawer } from "./context/useRightDrawer.js";
export { useTheme } from "./context/useTheme.js";

export type { NavItem as NavItemType, BreadcrumbItem, UserMenuConfig } from "./types/nav.js";

export { operationalConsolePreset, chatLayoutPreset, minimalShellPreset } from "./presets/index.js";
export type { ShellPreset } from "./presets/index.js";
