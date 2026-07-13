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

// @cloud-dog/ui — W28A-871 ScopeTestPanel.

import * as React from "react";
import { Play } from "lucide-react";
import { Button } from "../components/button";
import { StatusBadge } from "../components/layout";
import { cn } from "../utils/cn";

export type ScopeTestAccessibleItem = Readonly<{
  namespace?: string;
  entity?: string;
  field?: string;
}>;

export type ScopeTestResult = Readonly<{
  status: "OK" | "WARN" | "FAIL";
  latencyMs?: number;
  accessible?: readonly ScopeTestAccessibleItem[];
  warnings?: readonly string[];
  errors?: readonly string[];
}>;

export type ScopeTestPanelProps = Readonly<{
  result?: ScopeTestResult | null;
  running?: boolean;
  onRun?: () => void;
  title?: string;
  className?: string;
}>;

export function ScopeTestPanel({ result, running = false, onRun, title = "Scope test", className }: ScopeTestPanelProps) {
  const tone = result?.status === "FAIL" ? "error" : result?.status === "WARN" ? "warning" : "ok";
  return (
    <section className={cn("space-y-3 rounded-md border border-border bg-card p-3", className)} data-component="ScopeTestPanel">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div>
          <h3 className="text-sm font-semibold">{title}</h3>
          {result?.latencyMs != null ? <p className="text-xs text-muted-foreground">{result.latencyMs} ms</p> : null}
        </div>
        <div className="flex items-center gap-2">
          {result ? <StatusBadge tone={tone} value={result.status} /> : null}
          {onRun ? (
            <Button aria-busy={running} disabled={running} onClick={onRun} size="sm" type="button" variant="secondary">
              <Play className="h-4 w-4" />
              {running ? "Testing..." : "Test scope"}
            </Button>
          ) : null}
        </div>
      </div>
      {!result ? <p className="text-sm text-muted-foreground">Run a scope test to verify permissions and discovered entities.</p> : null}
      {result?.accessible?.length ? (
        <div>
          <div className="text-xs font-medium uppercase text-muted-foreground">Accessible</div>
          <ul className="mt-1 grid gap-1 text-sm">
            {result.accessible.map((item, index) => (
              <li className="rounded-sm bg-muted px-2 py-1 font-mono text-xs" key={`${item.namespace ?? ""}:${item.entity ?? ""}:${item.field ?? ""}:${index}`}>
                {[item.namespace, item.entity, item.field].filter(Boolean).join(".")}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
      {result?.warnings?.length ? <MessageList items={result.warnings} tone="warning" /> : null}
      {result?.errors?.length ? <MessageList items={result.errors} tone="error" /> : null}
    </section>
  );
}

function MessageList({ items, tone }: { items: readonly string[]; tone: "warning" | "error" }) {
  return (
    <ul className={cn("grid gap-1 text-sm", tone === "error" ? "text-destructive" : "text-amber-700")}>
      {items.map((item) => (
        <li key={item}>{item}</li>
      ))}
    </ul>
  );
}
