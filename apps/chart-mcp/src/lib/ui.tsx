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

// Small page-level helpers built ONLY on shared @cloud-dog/* components.

import * as React from "react";
import { VersionInfo } from "@cloud-dog/shell";
import { Button, Dialog, JsonExplorer, Spinner } from "@cloud-dog/ui";

/** Standard page header: title + version (CW-D5) with the primary action top-right (CW-T10). */
export function PageHeader(props: {
  title: string;
  version?: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3">
      <div className="space-y-1">
        <div className="flex items-center gap-3">
          <h1 className="text-2xl font-semibold">{props.title}</h1>
          {props.version ? <VersionInfo version={props.version} /> : null}
        </div>
        {props.description ? (
          <p className="text-sm text-muted-foreground">{props.description}</p>
        ) : null}
      </div>
      {props.children ? <div className="flex flex-wrap items-center gap-2">{props.children}</div> : null}
    </header>
  );
}

/** Read-only entity detail dialog rendering JSON via the shared PS-81 JsonExplorer (CW-F5). */
export function JsonDetailDialog(props: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  data: unknown;
  extra?: React.ReactNode;
}) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange} label={props.label}>
      <div className="space-y-4">
        {props.extra}
        <JsonExplorer data={props.data} defaultExpanded />
        <div className="flex justify-end">
          <Button variant="secondary" onClick={() => props.onOpenChange(false)}>
            Close
          </Button>
        </div>
      </div>
    </Dialog>
  );
}

/** Inline loading / error banners shared by the list pages. */
export function StatusLine(props: { loading?: boolean; error?: string | null; status?: string | null }) {
  return (
    <>
      {props.error ? (
        <p role="alert" className="text-sm text-destructive">
          {props.error}
        </p>
      ) : null}
      {props.status ? (
        <p role="status" className="text-sm text-foreground/80">
          {props.status}
        </p>
      ) : null}
      {props.loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
          <Spinner className="h-5 w-5" /> Loading…
        </div>
      ) : null}
    </>
  );
}

/** Load a collection on mount with reload + error capture. */
export function useEntityList<T>(loader: () => Promise<T[]>, deps: React.DependencyList) {
  const [rows, setRows] = React.useState<T[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const loaderRef = React.useRef(loader);
  React.useEffect(() => {
    loaderRef.current = loader;
  });

  const reload = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      setRows(await loaderRef.current());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
      setRows([]);
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  return { rows, setRows, loading, error, reload };
}

export function errMessage(e: unknown, fallback: string): string {
  return e instanceof Error && e.message.trim() ? e.message : fallback;
}

/** Trigger a browser download for a bounded base64 asset transfer envelope. */
export function downloadTransfer(transfer: {
  asset_id: string;
  base64_data?: string;
  content_type?: string;
  format?: string;
}): void {
  if (!transfer.base64_data) {
    throw new Error("Asset has no inline data available for download (too large for base64 transfer).");
  }
  const href = `data:${transfer.content_type ?? "application/octet-stream"};base64,${transfer.base64_data}`;
  const link = document.createElement("a");
  link.href = href;
  link.download = `${transfer.asset_id}.${transfer.format ?? "bin"}`;
  document.body.appendChild(link);
  link.click();
  link.remove();
}
