// @cloud-dog/ui — change-watch shared types (W28E-1870-F, PS-102 §10).
//
// UI-side view models for the cross-service change-stream/watch capability.
// Kept transport-agnostic; a service's api-client maps its REST/MCP payloads
// (the common ChangeEvent envelope) onto these.

/** Watch lifecycle/health states rendered as status badges (PS-102 §5.9). */
export type WatchState = "live" | "paused" | "throttled" | "error" | "cursor-expired";

/** A row in the watch list table. */
export type WatchRow = Readonly<{
  watchId: string;
  serviceId: string;
  profileId: string;
  tenantId: string;
  state: WatchState;
  /** Journal depth (retained events). */
  depth: number;
  latestSeq: number;
  ackSeq: number;
  /** Unacked in-flight batches. */
  inflight: number;
  lastEventTime?: string;
}>;

/** A row in the event journal table (from the common ChangeEvent envelope). */
export type WatchEventRow = Readonly<{
  cursor: string;
  seq: number;
  action: string;
  objectRef: string;
  eventTime: string;
  summary?: string;
}>;

export type CriterionKind = "glob" | "regex" | "field";

export type WatchCriterion = Readonly<{
  id: string;
  kind: CriterionKind;
  /** Field/metadata key (for kind "field"; optional glob/regex scoping otherwise). */
  field?: string;
  pattern: string;
}>;

/** Criteria a watch matches on (PS-102 §4 criteria_match). */
export type WatchCriteria = Readonly<{
  match: readonly WatchCriterion[];
  /** Action verbs to include (empty = all). */
  actions: readonly string[];
}>;
