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

// @cloud-dog/ui — StatusBadge: standardised status indicator for table cells.
// KEY-5: consistent placement, colour, icon, accessible text, and sort value.

import * as React from "react";
import { cn } from "../../utils/cn";

/** Status tones matching the platform StatusCard pattern. */
export type StatusBadgeTone = "ok" | "warning" | "error" | "neutral";

export type StatusBadgeProps = Readonly<{
  /** The raw status string to display. */
  value: string;
  /** Override auto-detected tone. */
  tone?: StatusBadgeTone;
  className?: string;
}>;

const OK_PATTERNS = /^(active|enabled|pass|ready|ok|online|healthy|running|completed|success|green)$/i;
const WARN_PATTERNS = /^(warn|warning|pending|degraded|partial|slow|flaky|amber|yellow|queued)$/i;
const ERROR_PATTERNS = /^(error|fail|failed|disabled|revoked|inactive|offline|unhealthy|stopped|blocked|red|critical)$/i;

/** Detect tone from a status string. Exported for sort-value and test use. */
export function detectTone(value: string): StatusBadgeTone {
  if (OK_PATTERNS.test(value)) return "ok";
  if (WARN_PATTERNS.test(value)) return "warning";
  if (ERROR_PATTERNS.test(value)) return "error";
  return "neutral";
}

/** Numeric sort weight: ok=0, warning=1, neutral=2, error=3. */
export function toneSortWeight(tone: StatusBadgeTone): number {
  if (tone === "ok") return 0;
  if (tone === "warning") return 1;
  if (tone === "neutral") return 2;
  return 3;
}

const TONE_CLASSES: Record<StatusBadgeTone, string> = {
  ok: "bg-emerald-100 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-300 dark:border-emerald-700",
  warning: "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-700",
  error: "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-700",
  neutral: "bg-secondary text-secondary-foreground border-secondary/20",
};

const TONE_ICONS: Record<StatusBadgeTone, string> = {
  ok: "\u2713",     // checkmark
  warning: "\u26A0", // warning sign
  error: "\u2717",   // cross
  neutral: "\u2014",  // em dash
};

export function StatusBadge(props: StatusBadgeProps) {
  const tone = props.tone ?? detectTone(props.value);
  const icon = TONE_ICONS[tone];

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium",
        TONE_CLASSES[tone],
        props.className,
      )}
      role="status"
      aria-label={`Status: ${props.value}`}
    >
      <span aria-hidden="true">{icon}</span>
      {props.value}
    </span>
  );
}
