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

// @cloud-dog/ui — ToolCallPanel pattern (expandable tool call display).

import * as React from "react";
import { cn } from "../utils/cn";
import { Badge } from "../components/layout/Badge";
import { JsonBlock } from "./JsonBlock";

export type ToolCallPanelProps = Readonly<{
  toolName: string;
  args: unknown;
  result?: unknown;
  durationMs?: number;
  defaultOpen?: boolean;
  className?: string;
}>;

export function ToolCallPanel(props: ToolCallPanelProps) {
  const [open, setOpen] = React.useState(props.defaultOpen ?? false);

  return (
    <section className={cn("rounded-md border bg-background", props.className)}>
      <button
        type="button"
        className={cn(
          "w-full flex items-center gap-2 px-3 py-2",
          "focus:outline-none focus:ring-2 focus:ring-ring rounded-sm"
        )}
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <span className="text-sm font-semibold">{props.toolName}</span>
        {props.durationMs !== undefined ? (
          <Badge className="ml-auto" aria-label="Duration">
            {Math.round(props.durationMs)}ms
          </Badge>
        ) : (
          <span className="ml-auto text-xs text-muted-foreground">{open ? "Hide" : "Show"}</span>
        )}
      </button>

      {open ? (
        <div className="p-3 pt-0 space-y-3">
          <JsonBlock title="Arguments" value={props.args} defaultCollapsed={false} />
          {props.result !== undefined ? (
            <JsonBlock title="Result" value={props.result} defaultCollapsed={false} />
          ) : null}
        </div>
      ) : null}
    </section>
  );
}
