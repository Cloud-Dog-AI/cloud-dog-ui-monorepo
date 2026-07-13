// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
// Licensed under the Apache License 2.0
import * as React from "react";
import { Card, CardContent, CardHeader, JsonExplorer } from "@cloud-dog/ui";
import { useSearchState } from "../state/AppState";
import { PageHeader, StatusLine, errMessage } from "../lib/ui";
import type { GovernanceStatus, GovernanceProxyStatus } from "../lib/types";

export function SettingsPage() {
  const { api, appVersion } = useSearchState();
  const [data, setData] = React.useState<unknown>(null);
  const [governance, setGovernance] = React.useState<GovernanceStatus | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);
  React.useEffect(() => {
    let c = false;
    void Promise.allSettled([api.systemSettings(), api.governance()])
      .then(([settings, gov]) => {
        if (c) return;
        if (settings.status === "fulfilled") setData(settings.value);
        else setError(errMessage(settings.reason));
        if (gov.status === "fulfilled") setGovernance(gov.value);
      })
      .finally(() => { if (!c) setLoading(false); });
    return () => { c = true; };
  }, [api]);

  return (
    <div className="space-y-6">
      <PageHeader title="Settings" version={appVersion} description="Service configuration + rate-limit / cache / mode / egress-proxy governance status. Vault-bound secrets are redacted and never surfaced." />
      <StatusLine loading={loading} error={error} />

      {governance ? <GovernancePanels governance={governance} /> : null}
      {governance?.proxy ? <ProxyPanel proxy={governance.proxy} /> : null}

      <Card><CardHeader><h2 className="text-lg font-semibold">Service configuration</h2></CardHeader>
        <CardContent><JsonExplorer data={(data as Record<string, unknown>) ?? {}} /></CardContent></Card>
    </div>
  );
}

function GovernancePanels({ governance }: { governance: GovernanceStatus }) {
  const { mode, ratelimit, cache } = governance;
  const hitPct = cache.hit_ratio != null ? `${Math.round(cache.hit_ratio * 100)}%` : "—";
  return (
    <>
      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Runtime mode</h2></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-2 text-sm" aria-label="governance-mode">
            <dt className="text-muted-foreground">Service default</dt>
            <dd data-testid="gov-mode">{mode.service_default_mode}</dd>
            <dt className="text-muted-foreground">Available modes</dt>
            <dd>{(mode.available_modes ?? []).join(", ")}</dd>
            <dt className="text-muted-foreground">Request override</dt>
            <dd>{mode.request_override_allowed ? `allowed (role: ${mode.override_requires_role ?? "—"})` : "disabled"}</dd>
          </dl>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <h2 className="text-lg font-semibold">Rate-limit governance</h2>
        </CardHeader>
        <CardContent>
          <p className="text-sm mb-3" data-testid="gov-ratelimit-enabled">
            Governance: {ratelimit.enabled ? "enabled" : "disabled"} · rejected total: {ratelimit.rejected_total ?? 0}
          </p>
          <table className="w-full text-sm" aria-label="governance-scopes">
            <thead><tr className="text-left text-muted-foreground">
              <th>Scope</th><th>Usage</th><th>Limit</th><th>Remaining</th><th>Limited</th><th>Resolves</th>
            </tr></thead>
            <tbody>
              {(ratelimit.scopes ?? []).map((s) => (
                <tr key={s.scope}>
                  <td>{s.scope}</td><td>{s.usage}</td><td>{s.limit}</td><td>{s.remaining}</td>
                  <td>{s.limited ? "yes" : "no"}</td><td>{s.estimated_resolves_at ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {(ratelimit.backends ?? []).length > 0 ? (
            <table className="w-full text-sm mt-3" aria-label="governance-backends">
              <thead><tr className="text-left text-muted-foreground">
                <th>Backend</th><th>Circuit</th><th>Cooldown</th><th>Limited</th>
              </tr></thead>
              <tbody>
                {(ratelimit.backends ?? []).map((b) => (
                  <tr key={b.backend}>
                    <td>{b.backend}</td><td>{b.circuit_state}</td>
                    <td>{b.cooldown_active ? "active" : "—"}</td><td>{b.limited ? "yes" : "no"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : null}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><h2 className="text-lg font-semibold">Cache</h2></CardHeader>
        <CardContent>
          <dl className="grid grid-cols-2 gap-2 text-sm" aria-label="governance-cache">
            <dt className="text-muted-foreground">Enabled</dt>
            <dd data-testid="gov-cache-enabled">{cache.enabled ? "yes" : "no"}</dd>
            <dt className="text-muted-foreground">Backend / namespace</dt>
            <dd>{cache.backend ?? "—"} / {cache.namespace ?? "—"}</dd>
            <dt className="text-muted-foreground">Hit ratio</dt>
            <dd>{hitPct} ({cache.hits ?? 0} hits / {cache.misses ?? 0} misses)</dd>
          </dl>
        </CardContent>
      </Card>
    </>
  );
}

// Render the governance no_proxy rules regardless of the shape the backend returns:
// a string (NO_PROXY convention), a string[], or the structured object { suffixes, hosts }.
// Rendering a raw object crashes the Settings page (React error #31), and calling .join on a
// non-array throws — both blanked /system/settings before this guard.
function formatNoProxy(np: unknown): string {
  if (Array.isArray(np)) return np.map(String).join(", ");
  if (typeof np === "string") return np;
  if (np && typeof np === "object") {
    const o = np as { suffixes?: unknown; hosts?: unknown };
    const parts = [
      ...(Array.isArray(o.suffixes) ? o.suffixes.map(String) : []),
      ...(Array.isArray(o.hosts) ? o.hosts.map(String) : []),
    ];
    return parts.join(", ");
  }
  return "";
}

function ProxyPanel({ proxy }: { proxy: GovernanceProxyStatus }) {
  const shared = proxy.shared_store === true;
  const backend = proxy.shared_store_backend ?? (shared ? "valkey" : "in_process");
  const pools = proxy.pools ?? [];
  const endpoints = proxy.endpoints ?? [];
  return (
    <Card>
      <CardHeader><h2 className="text-lg font-semibold">Egress proxy pool</h2></CardHeader>
      <CardContent>
        <dl className="grid grid-cols-2 gap-2 text-sm mb-3" aria-label="governance-proxy">
          <dt className="text-muted-foreground">Enabled</dt>
          <dd data-testid="gov-proxy-enabled">{proxy.enabled ? "yes" : "no"}</dd>
          <dt className="text-muted-foreground">Governance state</dt>
          <dd data-testid="gov-proxy-shared-store">
            {shared ? `shared / cross-process (${backend})` : `in-process (${backend})`}
          </dd>
          <dt className="text-muted-foreground">System default pool</dt>
          <dd>{proxy.system_default_pool ?? "direct"}</dd>
          <dt className="text-muted-foreground">No-proxy rules</dt>
          <dd>{formatNoProxy(proxy.no_proxy) || "—"}</dd>
        </dl>

        {pools.map((pool) => (
          <div key={pool.name} className="mb-4">
            <p className="text-sm font-medium mb-1" data-testid={`gov-proxy-pool-${pool.name}`}>
              Pool “{pool.name}” · strategy {pool.strategy} · healthy {pool.healthy_count ?? 0}/{pool.members.length}
              {pool.allow_direct_fallback ? " · direct-fallback" : ""}
            </p>
            <table className="w-full text-sm" aria-label={`governance-proxy-members-${pool.name}`}>
              <thead><tr className="text-left text-muted-foreground">
                <th>Member</th><th>Health</th><th>Fails</th><th>Blocked end-sites</th>
              </tr></thead>
              <tbody>
                {pool.members.map((m) => (
                  <tr key={m.id} data-testid={`gov-proxy-member-${m.id}`}>
                    <td>{m.id}{m.region ? ` (${m.region})` : ""}</td>
                    <td>{m.health?.status ?? "—"}</td>
                    <td>{m.health?.consecutive_failures ?? 0}</td>
                    <td>
                      {(m.endpoint_blocks ?? []).length === 0
                        ? "—"
                        : (m.endpoint_blocks ?? [])
                            .map((b) => `${b.endpoint} (${b.status}${b.last_block_reason ? `: ${b.last_block_reason}` : ""})`)
                            .join(", ")}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ))}

        {endpoints.length > 0 ? (
          <table className="w-full text-sm mt-2" aria-label="governance-proxy-endpoints">
            <thead><tr className="text-left text-muted-foreground">
              <th>End-site</th><th>Requests in window</th><th>Over limit</th>
            </tr></thead>
            <tbody>
              {endpoints.map((e) => (
                <tr key={e.endpoint}>
                  <td>{e.endpoint}</td><td>{e.requests_in_window}</td>
                  <td>{e.over_limit ? "yes" : "no"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : null}
      </CardContent>
    </Card>
  );
}
