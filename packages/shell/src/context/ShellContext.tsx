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

// @cloud-dog/shell — Shell state provider (nav, drawer, theme).

import * as React from "react";

export type ThemeMode = "light" | "dark";
const THEME_STORAGE_KEY = "cloud-dog.shell.theme";

export type ShellState = Readonly<{
  navCollapsed: boolean;
  setNavCollapsed: (collapsed: boolean) => void;
  mobileDrawerOpen: boolean;
  setMobileDrawerOpen: (open: boolean) => void;
  rightDrawerOpen: boolean;
  setRightDrawerOpen: (open: boolean) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
}>;

export const ShellContext = React.createContext<ShellState | null>(null);

export function ShellProvider(props: { children: React.ReactNode }) {
  const [navCollapsed, setNavCollapsed] = React.useState(false);
  const [mobileDrawerOpen, setMobileDrawerOpen] = React.useState(false);
  const [rightDrawerOpen, setRightDrawerOpen] = React.useState(false);
  const [theme, setTheme] = React.useState<ThemeMode>(() => {
    try {
      const stored = localStorage.getItem(THEME_STORAGE_KEY);
      if (stored === "dark" || stored === "light") return stored;
    } catch {
      // Ignore restricted storage environments and fall back to the DOM class.
    }
    return document.documentElement.classList.contains("dark") ? "dark" : "light";
  });

  React.useEffect(() => {
    const root = document.documentElement;
    if (theme === "dark") root.classList.add("dark");
    else root.classList.remove("dark");
    try {
      localStorage.setItem(THEME_STORAGE_KEY, theme);
    } catch {
      // Ignore restricted storage environments.
    }
  }, [theme]);

  const value: ShellState = {
    navCollapsed,
    setNavCollapsed,
    mobileDrawerOpen,
    setMobileDrawerOpen,
    rightDrawerOpen,
    setRightDrawerOpen,
    theme,
    setTheme,
  };

  return <ShellContext.Provider value={value}>{props.children}</ShellContext.Provider>;
}
