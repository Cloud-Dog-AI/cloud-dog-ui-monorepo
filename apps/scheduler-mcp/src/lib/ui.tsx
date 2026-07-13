// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0

import * as React from "react";

export function PageHeader(props: { title: string; description?: string; actions?: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-start justify-between gap-3 pb-4">
      <div>
        <h1 className="text-xl font-semibold tracking-tight">{props.title}</h1>
        {props.description ? (
          <p className="text-sm text-muted-foreground mt-1">{props.description}</p>
        ) : null}
      </div>
      {props.actions ? <div className="flex gap-2">{props.actions}</div> : null}
    </div>
  );
}

export function ErrorBanner(props: { error: string | null }) {
  if (!props.error) return null;
  return (
    <div role="alert" className="mb-3 rounded border border-red-300 bg-red-50 px-3 py-2 text-sm text-red-900 dark:border-red-700 dark:bg-red-950 dark:text-red-100">
      {props.error}
    </div>
  );
}

export function EmptyState(props: { message: string }) {
  return (
    <div className="rounded border border-dashed border-neutral-300 p-6 text-center text-sm text-muted-foreground dark:border-neutral-700">
      {props.message}
    </div>
  );
}
