// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0

// Small app-local UI helpers. Heavy components come from @cloud-dog/ui — no bespoke
// React widgets here per W28L-1520 §8 (shared-component reuse hard rule).

import * as React from "react";
import { Badge, Dialog, JsonExplorer, Spinner } from "@cloud-dog/ui";

export interface PageHeaderProps {
  title: string;
  description?: string;
  version?: string;
  children?: React.ReactNode;
}

export function PageHeader(props: PageHeaderProps) {
  return (
    <header className="flex flex-wrap items-start justify-between gap-3 border-b pb-3">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-semibold">{props.title}</h1>
          {props.version ? <Badge variant="secondary">v{props.version}</Badge> : null}
        </div>
        {props.description ? (
          <p className="text-sm text-muted-foreground">{props.description}</p>
        ) : null}
      </div>
      {props.children ? <div className="flex items-center gap-2">{props.children}</div> : null}
    </header>
  );
}

export interface JsonDetailDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  label: string;
  data: unknown;
  extra?: React.ReactNode;
}

export function JsonDetailDialog(props: JsonDetailDialogProps) {
  return (
    <Dialog open={props.open} onOpenChange={props.onOpenChange} label={props.label}>
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">{props.label}</h2>
          <button
            type="button"
            className="text-sm text-muted-foreground hover:underline"
            onClick={() => props.onOpenChange(false)}
          >
            Close
          </button>
        </div>
        {props.extra}
        <JsonExplorer data={(props.data as Record<string, unknown>) ?? {}} />
      </div>
    </Dialog>
  );
}

export interface StatusLineProps {
  loading?: boolean;
  error?: string | null;
  status?: string | null;
}

export function StatusLine({ loading, error, status }: StatusLineProps) {
  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground" role="status">
        <Spinner className="h-4 w-4" /> Loading…
      </div>
    );
  }
  if (error) {
    return (
      <div className="rounded border border-rose-300 bg-rose-50 p-2 text-sm text-rose-700">
        {error}
      </div>
    );
  }
  if (status) {
    return <div className="text-sm text-muted-foreground">{status}</div>;
  }
  return null;
}

export function errMessage(e: unknown, fallback = "Unexpected error."): string {
  if (e instanceof Error && e.message) return e.message;
  return fallback;
}

export function useEntityList<T>(
  loader: () => Promise<T[] | { items: T[] }>,
  deps: React.DependencyList = []
) {
  const [rows, setRows] = React.useState<T[]>([]);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const reload = React.useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await loader();
      const list = Array.isArray(data) ? data : data.items;
      setRows(list);
    } catch (e) {
      setError(errMessage(e, "Failed to load."));
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);

  React.useEffect(() => {
    void reload();
  }, [reload]);

  return { rows, loading, error, reload };
}
