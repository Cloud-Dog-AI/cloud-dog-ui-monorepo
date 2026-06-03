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

// @cloud-dog/ui — Structured object renderer for admin/detail views.

import * as React from "react";
import { cn } from "../utils/cn";

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function renderValue(value: unknown, path: string): React.ReactNode {
  if (value == null || value === "") {
    return <span className="text-sm text-muted-foreground">N/A</span>;
  }

  if (
    typeof value === "string" ||
    typeof value === "number" ||
    typeof value === "boolean" ||
    typeof value === "bigint"
  ) {
    return <span className="break-all font-mono text-xs">{String(value)}</span>;
  }

  if (Array.isArray(value)) {
    if (value.length === 0) {
      return <span className="text-sm text-muted-foreground">None</span>;
    }

    return (
      <div className="space-y-2">
        {value.map((item, index) => (
          <div key={`${path}[${index}]`} className="rounded-md border bg-muted/10 p-3">
            <div className="mb-2 text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Item {index + 1}
            </div>
            {renderValue(item, `${path}[${index}]`)}
          </div>
        ))}
      </div>
    );
  }

  if (isRecord(value)) {
    const entries = Object.entries(value).sort(([left], [right]) => left.localeCompare(right));
    if (entries.length === 0) {
      return <span className="text-sm text-muted-foreground">None</span>;
    }

    return (
      <dl className="overflow-hidden rounded-md border bg-muted/10">
        {entries.map(([key, nested]) => (
          <div
            key={`${path}.${key}`}
            className="grid gap-2 border-b px-3 py-2 last:border-b-0 md:grid-cols-[minmax(0,13rem)_1fr]"
          >
            <dt className="break-words text-xs font-medium uppercase tracking-wide text-muted-foreground">
              {key}
            </dt>
            <dd className="min-w-0">{renderValue(nested, `${path}.${key}`)}</dd>
          </div>
        ))}
      </dl>
    );
  }

  return <span className="break-all font-mono text-xs">{String(value)}</span>;
}

export type StructuredViewProps = Readonly<{
  title?: string;
  value: unknown;
  className?: string;
}>;

export function StructuredView(props: StructuredViewProps) {
  return (
    <section className={cn("space-y-3 rounded-md border bg-background p-4", props.className)}>
      {props.title ? <h3 className="text-sm font-semibold">{props.title}</h3> : null}
      {renderValue(props.value, props.title ?? "root")}
    </section>
  );
}
