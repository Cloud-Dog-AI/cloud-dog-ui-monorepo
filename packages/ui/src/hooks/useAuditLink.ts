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

// @cloud-dog/ui — Hook: build audit-page deep links (W28J-1304 navigation pattern).
//
// Every entity row across a service WebUI can deep-link to the shared Audit page
// pre-filtered to that entity. This hook centralises the URL contract so every
// page emits the same shape (`/audit?<param>=<value>`), AND-combined server-side.

import * as React from "react";

export type AuditLinkExtras = Readonly<{
  /** scope the entity link to a workspace (commit / branch / tag / stash / merge rows). */
  workspaceId?: string;
}>;

export type AuditLink = Readonly<{
  /** `/audit?correlation_id=<id>` */
  linkToCorrelation: (correlationId: string) => string;
  /** `/audit?entity_kind=<kind>&entity_id=<id>[&workspace_id=<ws>]` */
  linkToEntity: (kind: string, entityId: string, extras?: AuditLinkExtras) => string;
  /** `/audit?user=<username>` */
  linkToUser: (username: string) => string;
  /** `/audit?workspace_id=<id>` */
  linkToWorkspace: (workspaceId: string) => string;
  /** `/audit?profile_id=<id>` */
  linkToProfile: (profileId: string) => string;
  /** `/audit?job_id=<id>` */
  linkToJob: (jobId: string) => string;
}>;

function build(basePath: string, params: Array<[string, string | undefined]>): string {
  const search = new URLSearchParams();
  for (const [key, value] of params) {
    if (value !== undefined && value !== null && value !== "") {
      search.set(key, value);
    }
  }
  const qs = search.toString();
  return qs ? `${basePath}?${qs}` : basePath;
}

/** The seven AND-combinable audit filter dimensions (W28J-1304 §3). */
export type AuditFilters = Readonly<{
  correlation_id?: string;
  entity_kind?: string;
  entity_id?: string;
  user?: string;
  workspace_id?: string;
  profile_id?: string;
  job_id?: string;
}>;

const AUDIT_FILTER_KEYS = [
  "correlation_id",
  "entity_kind",
  "entity_id",
  "user",
  "workspace_id",
  "profile_id",
  "job_id",
] as const;

/**
 * Parse an audit deep-link's query string into the filter set the Audit page
 * applies on mount. Accepts a raw `?a=b&c=d` string, a bare `a=b`, or a
 * `URLSearchParams`. Unknown params are ignored; empty values are dropped.
 */
export function parseAuditLinkParams(search: string | URLSearchParams): AuditFilters {
  const params = typeof search === "string" ? new URLSearchParams(search.replace(/^\?/, "")) : search;
  const out: Record<string, string> = {};
  for (const key of AUDIT_FILTER_KEYS) {
    const value = params.get(key);
    if (value !== null && value !== "") {
      out[key] = value;
    }
  }
  return out as AuditFilters;
}

export type AuditLinkProps = Readonly<{ href: string; label: string }>;

/**
 * Build the props for a row-level "Actions › View Audit" control. Returns a
 * relative `href` and the canonical PS-77 label. Used by every DataTable's
 * audit-link action across a service WebUI (W28J-1304 §4).
 */
export function getAuditLinkProps(
  entityKind: string,
  entityId: string,
  extras?: AuditLinkExtras & { basePath?: string },
): AuditLinkProps {
  const basePath = extras?.basePath ?? "/audit";
  const href = build(basePath, [
    ["entity_kind", entityKind],
    ["entity_id", entityId],
    ["workspace_id", extras?.workspaceId],
  ]);
  return { href, label: "Actions › View Audit" };
}

/**
 * Returns a stable set of audit-link builders. Each returns a RELATIVE href
 * (e.g. `/audit?workspace_id=abc`); the caller decides whether to `navigate()`
 * or render an `<a href>`. The default base path is `/audit`.
 */
export function useAuditLink(basePath = "/audit"): AuditLink {
  return React.useMemo<AuditLink>(
    () => ({
      linkToCorrelation: (correlationId) => build(basePath, [["correlation_id", correlationId]]),
      linkToEntity: (kind, entityId, extras) =>
        build(basePath, [
          ["entity_kind", kind],
          ["entity_id", entityId],
          ["workspace_id", extras?.workspaceId],
        ]),
      linkToUser: (username) => build(basePath, [["user", username]]),
      linkToWorkspace: (workspaceId) => build(basePath, [["workspace_id", workspaceId]]),
      linkToProfile: (profileId) => build(basePath, [["profile_id", profileId]]),
      linkToJob: (jobId) => build(basePath, [["job_id", jobId]]),
    }),
    [basePath],
  );
}
