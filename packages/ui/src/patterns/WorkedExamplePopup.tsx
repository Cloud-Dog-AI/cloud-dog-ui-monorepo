// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0.

// CX-150 — Worked-example popup. Triggered from API Docs / MCP Console / A2A
// Console. Shows: title, example input (JSON), example output (JSON), and a
// "Copy curl" button when an endpoint URL is provided.

import * as React from "react";
import { Button } from "../components/button/Button";
import { Dialog } from "../components/dialog/Dialog";

export type WorkedExampleProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  /** Example request body (will be JSON-stringified). */
  exampleInput?: unknown;
  /** Example response body. */
  exampleOutput?: unknown;
  /** Endpoint URL — when supplied, a "Copy curl" button is rendered. */
  endpointUrl?: string;
  /** HTTP method for the curl example — default POST. */
  method?: "GET" | "POST" | "PUT" | "DELETE";
  /** Optional headers to include in the curl example. */
  headers?: Record<string, string>;
}>;

function jsonBlock(value: unknown): string {
  if (value === undefined || value === null) return "";
  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
}

function buildCurl(props: WorkedExampleProps): string {
  if (!props.endpointUrl) return "";
  const method = props.method ?? "POST";
  const lines = [`curl -sk -X ${method} \\`];
  for (const [k, v] of Object.entries(props.headers ?? {})) {
    lines.push(`  -H "${k}: ${v}" \\`);
  }
  if (method !== "GET" && props.exampleInput !== undefined) {
    lines.push(`  -H "Content-Type: application/json" \\`);
    lines.push(`  -d '${jsonBlock(props.exampleInput).replace(/'/g, "'\\''")}' \\`);
  }
  lines.push(`  "${props.endpointUrl}"`);
  return lines.join("\n");
}

export function WorkedExamplePopup(props: WorkedExampleProps) {
  const curl = React.useMemo(() => buildCurl(props), [props]);
  const onCopyCurl = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(curl);
    } catch {
      // noop
    }
  }, [curl]);

  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange} label={props.title}>
      <div className="space-y-4 text-sm" data-testid="cx150-worked-example">
        <header className="space-y-1">
          <h2 className="text-lg font-semibold">{props.title}</h2>
          {props.description ? <p className="text-muted-foreground">{props.description}</p> : null}
        </header>

        {props.exampleInput !== undefined ? (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Example input</h4>
            <pre className="mt-1 max-h-64 overflow-auto rounded border bg-muted/30 p-3 font-mono text-xs">
              {jsonBlock(props.exampleInput)}
            </pre>
          </div>
        ) : null}

        {props.exampleOutput !== undefined ? (
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Example output</h4>
            <pre className="mt-1 max-h-64 overflow-auto rounded border bg-muted/30 p-3 font-mono text-xs">
              {jsonBlock(props.exampleOutput)}
            </pre>
          </div>
        ) : null}

        {curl ? (
          <div>
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">curl</h4>
              <Button size="sm" variant="secondary" onClick={onCopyCurl}>Copy curl</Button>
            </div>
            <pre className="mt-1 max-h-48 overflow-auto rounded border bg-muted/30 p-3 font-mono text-xs">{curl}</pre>
          </div>
        ) : null}

        <div className="flex justify-end">
          <Button type="button" variant="secondary" onClick={() => props.onOpenChange(false)}>
            Cancel
          </Button>
        </div>
      </div>
    </Dialog>
  );
}
