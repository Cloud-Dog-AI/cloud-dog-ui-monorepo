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

// @cloud-dog/ui — LogStream pattern (live log feed with auto-scroll).

import * as React from "react";
import { cn } from "../utils/cn";

export type LogEntry = Readonly<{
  id: string;
  timestamp: string;
  level: string;
  message: string;
  source?: string;
}>;

export type LogStreamProps = Readonly<{
  entries: LogEntry[];
  autoFollow?: boolean;
  levelFilter?: string;
  searchFilter?: string;
  className?: string;
}>;

function levelColor(level: string): string {
  const l = level.toLowerCase();
  if (l === "error" || l === "fatal") return "text-destructive";
  if (l === "warn" || l === "warning") return "text-amber-600 dark:text-amber-400";
  if (l === "info") return "text-primary";
  if (l === "debug" || l === "trace") return "text-muted-foreground";
  return "";
}

export function LogStream(props: LogStreamProps) {
  const autoFollow = props.autoFollow ?? true;
  const viewportRef = React.useRef<HTMLDivElement>(null);

  const filtered = React.useMemo(() => {
    let entries = props.entries;
    if (props.levelFilter) {
      const lf = props.levelFilter.toLowerCase();
      entries = entries.filter((e) => e.level.toLowerCase() === lf);
    }
    if (props.searchFilter) {
      const q = props.searchFilter.toLowerCase();
      entries = entries.filter((e) => e.message.toLowerCase().includes(q));
    }
    return entries;
  }, [props.entries, props.levelFilter, props.searchFilter]);

  React.useEffect(() => {
    if (!autoFollow) return;
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [filtered.length, autoFollow]);

  return (
    <div
      ref={viewportRef}
      className={cn("h-64 overflow-auto font-mono text-xs bg-muted/10 p-3", props.className)}
      role="log"
      aria-label="Log stream"
      aria-live="polite"
      tabIndex={0}
    >
      {filtered.length === 0 ? (
        <div className="text-sm text-muted-foreground">No log entries.</div>
      ) : (
        <div className="space-y-0.5">
          {filtered.map((entry) => (
            <div key={entry.id} className="flex gap-2 whitespace-pre-wrap break-words">
              <span className="shrink-0 text-muted-foreground">{entry.timestamp}</span>
              <span className={cn("shrink-0 w-12 uppercase font-semibold", levelColor(entry.level))}>
                {entry.level}
              </span>
              <span className="flex-1">{entry.message}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
