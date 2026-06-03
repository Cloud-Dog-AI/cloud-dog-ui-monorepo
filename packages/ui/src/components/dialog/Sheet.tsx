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

// @cloud-dog/ui — Sheet (drawer) overlay.

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "../../utils/cn";
import { useFocusTrap } from "../../hooks/useFocusTrap";
import { useReducedMotion } from "../../hooks/useReducedMotion";

export interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
  side?: "left" | "right" | "top" | "bottom";
}

export function Sheet(props: SheetProps) {
  const side = props.side ?? "right";
  const reduced = useReducedMotion();
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

  const pos =
    side === "left"
      ? "left-0 top-0 h-full w-80"
      : side === "right"
      ? "right-0 top-0 h-full w-80"
      : side === "top"
      ? "left-0 top-0 w-full h-80"
      : "left-0 bottom-0 w-full h-80";

  return createPortal(
    <div
      className="fixed inset-0 z-50 bg-black/40"
      onClick={(e) => { if (e.target === e.currentTarget) props.onOpenChange(false); }}
    >
      <div
        ref={ref}
        className={cn(
          "absolute bg-background border shadow-xl p-4 overflow-auto",
          pos,
          reduced ? "" : "transition-transform"
        )}
        role="dialog"
        aria-modal="true"
        onClick={(e) => e.stopPropagation()}
      >
        {props.children}
      </div>
    </div>,
    document.body
  );
}
