// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0.

// W28E-610 CX-101: Shared bulk-export helper for db-mcp DataTables.
// Emits a JSON blob download of the rows the user selected.

export function exportRowsJson<T>(rows: readonly T[], filename = "export.json"): void {
  const blob = new Blob([JSON.stringify(rows, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  try {
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.rel = "noopener";
    document.body.appendChild(a);
    a.click();
    a.remove();
  } finally {
    setTimeout(() => URL.revokeObjectURL(url), 0);
  }
}

export const STANDARD_EXPORT_BULK_ACTIONS = [{ label: "Export", action: "export" as const }];
