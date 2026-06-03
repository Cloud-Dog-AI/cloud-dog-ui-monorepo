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

// @cloud-dog/ui — Dialog overlay with focus trap.

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "../../utils/cn";
import { useFocusTrap } from "../../hooks/useFocusTrap";

export interface DialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /**
   * Accessible name for the dialog. If omitted, a generic label is applied to
   * avoid an unnamed dialog (axe: aria-dialog-name).
   */
  label?: string;
  children: React.ReactNode;
}

export function Dialog(props: DialogProps) {
  const ref = React.useRef<HTMLDivElement>(null);
  useFocusTrap(ref, props.open);

  React.useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") props.onOpenChange(false);
    };
    if (props.open) document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [props.open, props]);

  if (!props.open) return null;

  return createPortal(
    <div
      className="fixed inset-0 z-50 grid place-items-center p-4 bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) props.onOpenChange(false); }}
    >
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-label={props.label ?? "Dialog"}
        className={cn("relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl border bg-background p-6 shadow-xl")}
        onClick={(e) => e.stopPropagation()}
      >
        {props.children}
      </div>
    </div>,
    document.body
  );
}
