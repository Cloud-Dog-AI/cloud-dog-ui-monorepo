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

// @cloud-dog/ui — ToolBrowser pattern (searchable tool catalogue with schema).

import * as React from "react";
import { cn } from "../utils/cn";
import { Input } from "../components/input/Input";
import { Card, CardContent } from "../components/card/Card";

export type ToolDef = Readonly<{
  name: string;
  description: string;
  inputSchema?: Record<string, unknown>;
}>;

export type ToolBrowserProps = Readonly<{
  tools: ToolDef[];
  onSelect?: (tool: ToolDef) => void;
  className?: string;
}>;

export function ToolBrowser(props: ToolBrowserProps) {
  const [query, setQuery] = React.useState("");
  const [expanded, setExpanded] = React.useState<string | null>(null);

  const filtered = React.useMemo(() => {
    if (!query.trim()) return props.tools;
    const q = query.toLowerCase();
    return props.tools.filter(
      (t) => t.name.toLowerCase().includes(q) || t.description.toLowerCase().includes(q),
    );
  }, [props.tools, query]);

  const toggle = (name: string) => {
    setExpanded((prev) => (prev === name ? null : name));
  };

  return (
    <div className={cn("space-y-3", props.className)}>
      <Input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="Search tools..."
        aria-label="Search tools"
      />
      <div className="space-y-2">
        {filtered.map((tool) => (
          <Card
            key={tool.name}
            className={cn("cursor-pointer", props.onSelect ? "hover:border-primary/40" : "")}
            onClick={() => props.onSelect?.(tool)}
          >
            <CardContent className="py-3">
              <div className="flex items-center justify-between">
                <div className="min-w-0">
                  <div className="text-sm font-bold truncate">{tool.name}</div>
                  <div className="text-xs text-muted-foreground">{tool.description}</div>
                </div>
                {tool.inputSchema ? (
                  <button
                    type="button"
                    className="ml-2 shrink-0 text-xs text-primary underline"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggle(tool.name);
                    }}
                    aria-expanded={expanded === tool.name}
                    aria-label={`Toggle schema for ${tool.name}`}
                  >
                    {expanded === tool.name ? "Hide" : "Schema"}
                  </button>
                ) : null}
              </div>
              {expanded === tool.name && tool.inputSchema ? (
                <pre className="mt-2 overflow-auto rounded bg-muted p-2 text-xs">
                  {JSON.stringify(tool.inputSchema, null, 2)}
                </pre>
              ) : null}
            </CardContent>
          </Card>
        ))}
        {filtered.length === 0 ? (
          <div className="text-sm text-muted-foreground">No tools match your search.</div>
        ) : null}
      </div>
    </div>
  );
}
