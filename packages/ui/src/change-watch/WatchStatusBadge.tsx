// @cloud-dog/ui — WatchStatusBadge (W28E-1870-F, PS-102 §5.9 / §10).
// Maps a watch state to the shared StatusBadge tone (no bespoke badge).

import { StatusBadge, type StatusBadgeTone } from "../components/layout/StatusBadge";
import type { WatchState } from "./types";

/** Deterministic tone mapping for watch states. Exported for sorting/tests. */
export function watchStateTone(state: WatchState): StatusBadgeTone {
  switch (state) {
    case "live":
      return "ok";
    case "throttled":
      return "warning";
    case "error":
    case "cursor-expired":
      return "error";
    case "paused":
    default:
      return "neutral";
  }
}

export type WatchStatusBadgeProps = Readonly<{
  state: WatchState;
  className?: string;
}>;

/** Renders a watch state as a platform StatusBadge. */
export function WatchStatusBadge({ state, className }: WatchStatusBadgeProps) {
  return <StatusBadge value={state} tone={watchStateTone(state)} className={className} />;
}
