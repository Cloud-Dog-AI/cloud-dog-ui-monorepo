// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License, Version 2.0
//
// W28K-1408 F-1408-3 — canonical scope identifiers used for scope-aware CTA
// hide/show. These mirror scheduler-mcp-server defaults.yaml
// idam.default_admin_scopes; `schedules.admin` is the backend superuser scope.

export const SCOPES = {
  read: "schedules.read",
  write: "schedules.write",
  runNow: "schedules.run_now",
  admin: "schedules.admin",
  registryRead: "registry.read",
  registryAdmin: "registry.admin",
  auditRead: "audit.read",
  settingsRead: "settings.read",
  settingsAdmin: "settings.admin",
  settingsReveal: "settings.reveal",
} as const;

export type ScopeName = (typeof SCOPES)[keyof typeof SCOPES];

// Mirrors backend Principal.has_scope: `schedules.admin` is the superuser scope
// (grants everything); otherwise the exact scope must be present.
export function hasScope(scopes: ReadonlyArray<string>, scope: string): boolean {
  return scopes.includes(SCOPES.admin) || scopes.includes(scope);
}
