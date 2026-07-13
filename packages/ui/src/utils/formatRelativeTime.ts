// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0.

// CX-170 — shared moment-format helper. Every duration / uptime / age display
// in every web-UI service uses this helper. No raw seconds or milliseconds to
// the operator.

/** Format a duration (in seconds) as a short human string: "5s", "3m", "2h 15m", "4d". */
export function formatSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "—";
  const s = Math.floor(seconds);
  if (s < 60) return `${s} second${s === 1 ? "" : "s"}`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"}`;
  const h = Math.floor(m / 60);
  if (h < 24) {
    const rem = m % 60;
    return rem ? `${h}h ${rem}m` : `${h} hour${h === 1 ? "" : "s"}`;
  }
  const d = Math.floor(h / 24);
  const remH = h % 24;
  return remH ? `${d}d ${remH}h` : `${d} day${d === 1 ? "" : "s"}`;
}

/** Format an absolute timestamp (Date, ISO string, or epoch seconds) as "5m ago". */
export function formatRelativeTime(when: Date | string | number | null | undefined): string {
  if (when === null || when === undefined || when === "") return "—";
  const date = when instanceof Date
    ? when
    : typeof when === "number"
      ? new Date(when > 1e12 ? when : when * 1000)
      : new Date(when);
  if (Number.isNaN(date.getTime())) return "—";
  const diffSec = Math.floor((Date.now() - date.getTime()) / 1000);
  if (diffSec < 0) return `in ${formatSeconds(-diffSec)}`;
  if (diffSec < 10) return "just now";
  return `${formatSeconds(diffSec)} ago`;
}

/** Format an interval given in milliseconds as a moment string ("30 seconds"). */
export function formatMillis(ms: number | null | undefined): string {
  if (ms === null || ms === undefined || !Number.isFinite(ms)) return "—";
  return formatSeconds(Math.floor((ms as number) / 1000));
}

/** Format a byte count as "1.2 GB" / "350 MB" / "120 KB" / "85 B". */
export function formatBytes(bytes: number | null | undefined): string {
  if (bytes === null || bytes === undefined || !Number.isFinite(bytes) || (bytes as number) < 0) return "—";
  const b = bytes as number;
  if (b < 1024) return `${b} B`;
  if (b < 1024 ** 2) return `${(b / 1024).toFixed(1)} KB`;
  if (b < 1024 ** 3) return `${(b / 1024 ** 2).toFixed(1)} MB`;
  if (b < 1024 ** 4) return `${(b / 1024 ** 3).toFixed(2)} GB`;
  return `${(b / 1024 ** 4).toFixed(2)} TB`;
}
