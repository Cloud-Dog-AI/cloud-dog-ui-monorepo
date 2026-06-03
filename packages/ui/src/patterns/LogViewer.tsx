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

// @cloud-dog/ui — LogViewer pattern (search, pause, auto-scroll, basic windowing).

import * as React from "react";
import { cn } from "../utils/cn";
import { Input } from "../components/input/Input";
import { Button } from "../components/button/Button";

export type LogViewerProps = Readonly<{
  lines: string[];
  className?: string;
  defaultPaused?: boolean;
}>;

export function LogViewer(props: LogViewerProps) {
  const [paused, setPaused] = React.useState(props.defaultPaused ?? false);
  const [query, setQuery] = React.useState("");
  const viewportRef = React.useRef<HTMLDivElement>(null);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return props.lines;
    const q = query.toLowerCase();
    return props.lines.filter((l) => l.toLowerCase().includes(q));
  }, [props.lines, query]);

  React.useEffect(() => {
    if (paused) return;
    const el = viewportRef.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [filtered.length, paused]);

  return (
    <section className={cn("rounded-md border bg-background", props.className)} aria-label="Log viewer">
      <div className="flex items-center gap-2 p-2 border-b">
        <Input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search logs"
          aria-label="Search logs"
        />
        <Button variant="ghost" size="sm" onClick={() => setPaused((p) => !p)} aria-pressed={paused}>
          {paused ? "Resume" : "Pause"}
        </Button>
      </div>

      <div
        ref={viewportRef}
        className="h-64 overflow-auto p-3 font-mono text-xs bg-muted/10"
        tabIndex={0}
        aria-label="Log lines"
      >
        {filtered.length ? (
          <div className="space-y-1">
            {filtered.map((l, i) => (
              <div key={i} className="whitespace-pre-wrap break-words">
                {l}
              </div>
            ))}
          </div>
        ) : (
          <div className="text-sm text-muted-foreground">No log lines.</div>
        )}
      </div>
    </section>
  );
}
