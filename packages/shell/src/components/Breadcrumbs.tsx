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

// @cloud-dog/shell — Breadcrumb trail.

import * as React from "react";
import type { BreadcrumbItem } from "../types/nav.js";

export function Breadcrumbs(props: { items: BreadcrumbItem[] }) {
  if (!props.items.length) return null;
  return (
    <ol className="flex items-center gap-2 text-sm text-muted-foreground">
      {props.items.map((b, i) => (
        <li key={`${b.label}-${i}`} className="flex items-center gap-2">
          {b.href ? (
            <a className="hover:text-foreground" href={b.href}>
              {b.label}
            </a>
          ) : (
            <span className="text-foreground">{b.label}</span>
          )}
          {i < props.items.length - 1 ? <span aria-hidden="true">/</span> : null}
        </li>
      ))}
    </ol>
  );
}
