// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0
//
// W28K-1408 F-1408-1 — run-status eligibility, mirroring scheduler-mcp-server
// api/runs.py exactly so the Jobs UI never offers an action the backend 409s.
//   cancel : backend 409 when status in _TERMINAL  -> cancellable = NOT terminal
//   retry  : backend 409 unless status in _RETRIABLE (= _TERMINAL ∪ {blocked})
//   delete : backend 409 unless status in _RETRIABLE
//   dead-letter view : failed | blocked | misfired

export const TERMINAL_CANCEL = new Set(["succeeded", "failed", "cancelled", "skipped", "misfired"]);
export const RETRIABLE = new Set(["succeeded", "failed", "cancelled", "skipped", "misfired", "blocked"]);
export const DEAD_LETTER = new Set(["failed", "blocked", "misfired"]);

export function normStatus(status?: string | null): string {
  return String(status ?? "unknown").trim().toLowerCase();
}

export function canCancelStatus(status?: string | null): boolean {
  return !TERMINAL_CANCEL.has(normStatus(status));
}
export function canRetryStatus(status?: string | null): boolean {
  return RETRIABLE.has(normStatus(status));
}
export function canDeleteStatus(status?: string | null): boolean {
  return RETRIABLE.has(normStatus(status));
}
export function isDeadLetterStatus(status?: string | null): boolean {
  return DEAD_LETTER.has(normStatus(status));
}
