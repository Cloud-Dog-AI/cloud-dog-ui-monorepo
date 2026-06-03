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

// @cloud-dog/ui — Hook: focus trapping for overlays (Dialog, Sheet, Popover).

import * as React from "react";

function getFocusable(root: HTMLElement): HTMLElement[] {
  const selector =
    'a[href],button:not([disabled]),textarea:not([disabled]),input:not([disabled]),select:not([disabled]),[tabindex]:not([tabindex="-1"])';
  return Array.from(root.querySelectorAll<HTMLElement>(selector)).filter(
    (el) => !el.hasAttribute("disabled") && !el.getAttribute("aria-hidden")
  );
}

export function useFocusTrap(ref: React.RefObject<HTMLElement>, active: boolean): void {
  React.useEffect(() => {
    const root = ref.current;
    if (!active || !root) return;

    const prev = document.activeElement as HTMLElement | null;
    const focusables = getFocusable(root);
    (focusables[0] ?? root).focus();

    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;
      const items = getFocusable(root);
      if (!items.length) return;
      const first = items[0];
      const last = items[items.length - 1];
      const current = document.activeElement as HTMLElement | null;
      if (e.shiftKey) {
        if (current === first || !root.contains(current)) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (current === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      prev?.focus?.();
    };
  }, [ref, active]);
}
