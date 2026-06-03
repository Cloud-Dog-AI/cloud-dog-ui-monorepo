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

// @cloud-dog/ui — Dropdown menu component.

import * as React from "react";
import { createPortal } from "react-dom";
import { cn } from "../../utils/cn";
import { useKeyboardNav } from "../../hooks/useKeyboardNav";

export type DropdownItem = Readonly<{
  id: string;
  label: string;
  onSelect: () => void;
  disabled?: boolean;
}>;

export function DropdownMenu(props: {
  trigger: React.ReactElement;
  header?: React.ReactNode;
  items: DropdownItem[];
}) {
  const triggerRef = React.useRef<HTMLElement | null>(null);
  const [open, setOpen] = React.useState(false);
  const [pos, setPos] = React.useState<{ top: number; left: number; width: number }>({
    top: 0,
    left: 0,
    width: 0,
  });
  const [active, setActive] = React.useState(0);

  React.useEffect(() => {
    const el = triggerRef.current;
    if (!open || !el) return;
    const rect = el.getBoundingClientRect();
    setPos({ top: rect.bottom + 8, left: rect.right, width: rect.width });
    setActive(0);
  }, [open]);

  const nav = useKeyboardNav({
    onEscape: () => setOpen(false),
    onArrowDown: () => setActive((i) => Math.min(props.items.length - 1, i + 1)),
    onArrowUp: () => setActive((i) => Math.max(0, i - 1)),
    onEnter: () => {
      const it = props.items[active];
      if (!it || it.disabled) return;
      it.onSelect();
      setOpen(false);
    },
  });

  const trigger = React.cloneElement(props.trigger, {
    ref: (node: HTMLElement) => {
      triggerRef.current = node;
      const r = (props.trigger as any).ref;
      if (typeof r === "function") r(node);
    },
    onClick: (e: any) => {
      (props.trigger as any).props?.onClick?.(e);
      setOpen((v) => !v);
    },
  });

  return (
    <>
      {trigger}
      {open
        ? createPortal(
            <div className="fixed inset-0 z-50" onMouseDown={() => setOpen(false)}>
              <div
                className={cn("absolute w-56 rounded-md border bg-background shadow-md overflow-hidden")}
                style={{ top: pos.top, left: pos.left - 224 }}
                onMouseDown={(e) => e.stopPropagation()}
                role="menu"
                tabIndex={-1}
                onKeyDown={nav}
              >
                {props.header ? <div className="border-b">{props.header}</div> : null}
                <div className="py-1">
                  {props.items.map((it, idx) => (
                    <button
                      key={it.id}
                      type="button"
                      role="menuitem"
                      disabled={it.disabled}
                      className={cn(
                        "w-full text-left px-3 py-2 text-sm hover:bg-accent hover:text-accent-foreground disabled:opacity-50",
                        idx === active ? "bg-accent text-accent-foreground" : ""
                      )}
                      onMouseEnter={() => setActive(idx)}
                      onClick={() => {
                        if (it.disabled) return;
                        it.onSelect();
                        setOpen(false);
                      }}
                    >
                      {it.label}
                    </button>
                  ))}
                </div>
              </div>
            </div>,
            document.body
          )
        : null}
    </>
  );
}
