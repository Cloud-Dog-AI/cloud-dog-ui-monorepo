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

// @cloud-dog/shell — Hook: useShell().

import * as React from "react";
import { ShellContext } from "./ShellContext.js";

export function useShell() {
  const ctx = React.useContext(ShellContext);
  if (!ctx) throw new Error("ShellContext is not available. Wrap with <ShellProvider>.");
  return {
    ...ctx,
    toggleNav: () => ctx.setNavCollapsed(!ctx.navCollapsed),
    openMobileDrawer: () => ctx.setMobileDrawerOpen(true),
    closeMobileDrawer: () => ctx.setMobileDrawerOpen(false),
  };
}
