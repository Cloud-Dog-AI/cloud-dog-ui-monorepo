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

// @cloud-dog/ui — Tooltip component.

import * as React from "react";
import { createPortal } from "react-dom";

export function Tooltip(props: { content: React.ReactNode; children: React.ReactElement }) {
  const ref = React.useRef<HTMLElement | null>(null);
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; left: number }>({ top: 0, left: 0 });

  React.useEffect(() => {
    const el = ref.current;
    if (!open || !el) return;
    const rect = el.getBoundingClientRect();
    setPos({ top: rect.top - 8, left: rect.left + rect.width / 2 });
  }, [open]);

  const child = React.cloneElement(props.children, {
    ref: (node: HTMLElement) => {
      ref.current = node;
      const r = (props.children as any).ref;
      if (typeof r === "function") r(node);
    },
    onMouseEnter: (e: any) => {
      (props.children as any).props?.onMouseEnter?.(e);
      setOpen(true);
    },
    onMouseLeave: (e: any) => {
      (props.children as any).props?.onMouseLeave?.(e);
      setOpen(false);
    },
  });

  return (
    <>
      {child}
      {open
        ? createPortal(
            <div
              role="tooltip"
              className="fixed z-50 -translate-x-1/2 -translate-y-full rounded-md bg-foreground text-background px-2 py-1 text-xs shadow-md"
              style={{ top: pos.top, left: pos.left }}
            >
              {props.content}
            </div>,
            document.body
          )
        : null}
    </>
  );
}
