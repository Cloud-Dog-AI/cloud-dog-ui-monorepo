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

// @cloud-dog/shell — DocLinks: help menu with documentation links.

import * as React from "react";
import { Button } from "@cloud-dog/ui";

export type DocLink = Readonly<{
  label: string;
  url: string;
  external?: boolean;
}>;

export type DocLinksProps = Readonly<{
  links: DocLink[];
  className?: string;
  /** When true, render as dropdown menu; otherwise as inline list. */
  dropdown?: boolean;
}>;

export function DocLinks({ links, className = "", dropdown = true }: DocLinksProps) {
  const [open, setOpen] = React.useState(false);

  if (!links.length) return null;

  if (!dropdown) {
    return (
      <nav className={`flex flex-col gap-1 ${className}`} aria-label="Documentation links">
        {links.map((link) => (
          <a
            key={link.url}
            href={link.url}
            target={link.external ? "_blank" : undefined}
            rel={link.external ? "noopener noreferrer" : undefined}
            className="text-sm text-muted-foreground hover:text-foreground hover:underline px-2 py-1 rounded"
          >
            {link.label}
            {link.external && <span className="ml-1 text-xs">↗</span>}
          </a>
        ))}
      </nav>
    );
  }

  return (
    <div className={`relative ${className}`}>
      <Button
        variant="ghost"
        size="sm"
        aria-label="Documentation"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
      >
        <span aria-hidden="true">?</span>
      </Button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div
            className="absolute right-0 mt-1 z-50 w-56 rounded-md border bg-popover text-popover-foreground shadow-md"
            role="menu"
          >
            <div className="p-1">
              {links.map((link) => (
                <a
                  key={link.url}
                  href={link.url}
                  target={link.external ? "_blank" : undefined}
                  rel={link.external ? "noopener noreferrer" : undefined}
                  role="menuitem"
                  className="block px-3 py-2 text-sm rounded hover:bg-accent hover:text-accent-foreground"
                  onClick={() => setOpen(false)}
                >
                  {link.label}
                  {link.external && <span className="ml-1 text-xs opacity-60">↗</span>}
                </a>
              ))}
            </div>
          </div>
        </>
      )}
    </div>
  );
}
