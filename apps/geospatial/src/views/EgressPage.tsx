// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0.

// W28H-1122 Egress Governance panel — renders the SINGLE shared status builder
// (GET /v1/status/egress; same structure as the geo_egress_status MCP tool and
// A2A skill): runtime mode, TTL policy, the caller's inbound rate windows,
// per-provider outbound budgets with cooldown/breaker state, cache counters,
// async-queue posture, and W28H-1123 shared egress proxy pool status/provenance.
// Read-only; RBAC `geo.status.read` (viewer+) is enforced by the API tier.
// Public-safe: the backend never includes secrets or proxy credentials.

import * as React from "react";
import { Badge, Button, Card, CardContent, CardHeader, DataTable, JsonExplorer, type DataColumn } from "@cloud-dog/ui";
import { useGeoState } from "../state/AppState";
import { PageHeader, StatusLine } from "../lib/ui";

type Rec = Record<string, unknown>;

type ProviderRow = Readonly<{
  provider: string;
  limitPerMin: number;
  used: number;
  remaining: number;
  limited: boolean;
  reason: string | null;
  breaker: string;
  cooldownRemaining: number | null;
  resolvesAt: string | null;
  proxyState: string;
  proxyDetail: string | null;
  proxyDirect: boolean;
}>;

const rec = (v: unknown): Rec => (v && typeof v === "object" && !Array.isArray(v) ? (v as Rec) : {});
const arr = (v: unknown): unknown[] => (Array.isArray(v) ? v : []);
const num = (v: unknown, fallback = 0): number => (typeof v === "number" && Number.isFinite(v) ? v : fallback);
const str = (v: unknown): string | null => (typeof v === "string" && v ? v : null);

function proxyProjection(provider: string, proxyProviders: Rec): Pick<ProviderRow, "proxyState" | "proxyDetail" | "proxyDirect"> {
  const p = rec(proxyProviders[provider]);
  if (Object.keys(p).length === 0) {
    return { proxyState: "unknown", proxyDetail: null, proxyDirect: true };
  }
  const direct = p.direct === true;
  if (direct) {
    return {
      proxyState: str(p.reason) ?? "direct",
      proxyDetail: str(p.host),
      proxyDirect: true,
    };
  }
  const latest = rec(p.latest_selection);
  const latestId = str(latest.proxy_id);
  const healthy = typeof p.healthy_count === "number" && typeof p.member_count === "number"
    ? `${p.healthy_count}/${p.member_count} healthy`
    : null;
  return {
    proxyState: str(p.pool) ?? "proxy",
    proxyDetail: [str(p.strategy), healthy, latestId ? `last ${latestId}` : null].filter(Boolean).join(" · ") || str(p.host),
    proxyDirect: false,
  };
}

function providerRows(providers: Rec, proxyProviders: Rec): ProviderRow[] {
  return Object.entries(providers)
    .map(([provider, raw]) => {
      const p = rec(raw);
      const usage = rec(p.usage);
      return {
        provider,
        limitPerMin: num(p.limit_per_min),
        used: num(usage.used),
        remaining: num(usage.remaining, num(p.limit_per_min)),
        limited: p.limited === true,
        reason: str(p.reason),
        breaker: str(p.breaker) ?? "closed",
        cooldownRemaining: typeof p.cooldown_remaining_seconds === "number" ? p.cooldown_remaining_seconds : null,
        resolvesAt: str(p.estimated_resolves_at),
        ...proxyProjection(provider, proxyProviders),
      };
    })
    .sort((a, b) => Number(b.limited) - Number(a.limited) || a.provider.localeCompare(b.provider));
}

function ModeBadge({ mode }: { mode: string }) {
  // OFFLINE/SIMULATE are the zero-egress modes; LIVE means real provider calls.
  return (
    <Badge variant={mode === "LIVE" ? "default" : "secondary"} data-testid="egress-mode-badge">
      {mode}
    </Badge>
  );
}

export function EgressPage() {
  const { api, appVersion } = useGeoState();
  const [status, setStatus] = React.useState<Rec>({});
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  const load = React.useCallback(async (isActive: () => boolean = () => true) => {
    setLoading(true);
    setError(null);
    try {
      const data = await api.egressStatus();
      if (!isActive()) return;
      setStatus(rec(data));
    } catch (e) {
      if (isActive()) setError(e instanceof Error ? e.message : "Failed to load egress status.");
    } finally {
      if (isActive()) setLoading(false);
    }
  }, [api]);

  React.useEffect(() => {
    let cancelled = false;
    void load(() => !cancelled);
    return () => {
      cancelled = true;
    };
  }, [load]);

  const modes = rec(status.modes);
  const ttls = rec(status.ttls);
  const rateLimits = rec(status.rate_limits);
  const inbound = rec(rateLimits.inbound_scopes);
  const actor = rec(inbound.actor);
  const cooldown = rec(status.cooldown_policy);
  const queue = rec(status.queue);
  const proxyStatus = rec(status.proxy);
  const proxyProviders = rec(proxyStatus.providers);
  const rows = React.useMemo(() => providerRows(rec(status.providers), proxyProviders), [status.providers, proxyProviders]);
  const effectiveMode = str(modes.request_effective) ?? str(modes.service_default) ?? "—";
  const proxyPools = arr(proxyStatus.pools);
  const proxiedProviders = Object.values(proxyProviders).filter((p) => rec(p).direct !== true).length;
  const directProviders = Object.values(proxyProviders).filter((p) => rec(p).direct === true).length;

  const columns: DataColumn<ProviderRow>[] = [
    { id: "provider", header: "Provider", sortable: true, sortValue: (r) => r.provider, cell: (r) => <span className="font-medium">{r.provider}</span> },
    { id: "budget", header: "Budget/min", sortable: true, sortValue: (r) => r.limitPerMin, cell: (r) => String(r.limitPerMin) },
    { id: "used", header: "Used", sortable: true, sortValue: (r) => r.used, cell: (r) => `${r.used} (${r.remaining} left)` },
    {
      id: "state",
      header: "State",
      sortable: true,
      sortValue: (r) => (r.limited ? 0 : 1),
      cell: (r) =>
        r.limited ? (
          <Badge variant="destructive">{r.reason ?? "limited"}</Badge>
        ) : (
          <Badge variant="secondary">available</Badge>
        ),
    },
    { id: "breaker", header: "Breaker", cell: (r) => (r.breaker === "closed" ? "closed" : <Badge variant="destructive">{r.breaker}</Badge>) },
    {
      id: "proxy",
      header: "Proxy",
      sortable: true,
      sortValue: (r) => r.proxyState,
      cell: (r) => (
        <span className="inline-flex max-w-60 flex-col gap-1">
          <Badge variant={r.proxyDirect ? "secondary" : "default"}>{r.proxyState}</Badge>
          {r.proxyDetail ? <span className="text-xs text-muted-foreground break-words">{r.proxyDetail}</span> : null}
        </span>
      ),
    },
    {
      id: "cooldown",
      header: "Cooldown",
      cell: (r) =>
        r.cooldownRemaining != null && r.cooldownRemaining > 0
          ? `${r.cooldownRemaining}s${r.resolvesAt ? ` (until ${r.resolvesAt})` : ""}`
          : "—",
    },
  ];

  return (
    <div className="space-y-6" data-testid="page-egress">
      <PageHeader
        title="Egress Governance"
        version={appVersion}
        description="External-endpoint runtime mode, TTL policy, rate windows, provider budgets, cooldowns, queue posture, and shared proxy pool status (W28H-1122/W28H-1123; read-only, public-safe)."
      >
        <Button variant="secondary" size="sm" data-testid="egress-refresh" onClick={() => { void load(); }}>
          Refresh
        </Button>
      </PageHeader>
      <StatusLine loading={loading} error={error} />

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <Card data-testid="egress-card-mode">
          <CardHeader className="text-sm font-medium text-muted-foreground">Runtime mode</CardHeader>
          <CardContent className="space-y-1">
            <ModeBadge mode={effectiveMode} />
            <p className="text-xs text-muted-foreground">
              default {str(modes.service_default) ?? "—"} · escalation needs{" "}
              <code>{str(modes.override_permission) ?? "geo.mode.override"}</code>
            </p>
          </CardContent>
        </Card>
        <Card data-testid="egress-card-window">
          <CardHeader className="text-sm font-medium text-muted-foreground">Your rate window (actor)</CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-semibold">
              {num(actor.used)}/{num(actor.limit, num(actor.limit_per_min))}
            </p>
            <p className="text-xs text-muted-foreground">
              per {num(actor.window_seconds, 60)}s · resets in {num(actor.reset_seconds)}s · 429 carries Retry-After
            </p>
          </CardContent>
        </Card>
        <Card data-testid="egress-card-ttl">
          <CardHeader className="text-sm font-medium text-muted-foreground">Cache TTL policy</CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-semibold">{num(ttls.default_ttl_seconds)}s</p>
            <p className="text-xs text-muted-foreground">
              {Object.keys(rec(ttls.provider_overrides)).length} provider + {Object.keys(rec(ttls.operation_overrides)).length} operation overrides · DEV ×{num(ttls.dev_ttl_multiplier, 1)}
            </p>
          </CardContent>
        </Card>
        <Card data-testid="egress-card-queue">
          <CardHeader className="text-sm font-medium text-muted-foreground">Async queue</CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-semibold">{num(queue.depth)}</p>
            <p className="text-xs text-muted-foreground">
              handoff {queue.handoff_enabled === false ? "disabled (fail-closed 429)" : "enabled"} · max {num(queue.max_queued_per_actor, 20)}/actor
            </p>
          </CardContent>
        </Card>
        <Card data-testid="egress-card-proxy">
          <CardHeader className="text-sm font-medium text-muted-foreground">Egress proxy pool</CardHeader>
          <CardContent className="space-y-1">
            <p className="text-2xl font-semibold">{proxyStatus.enabled === true ? "on" : "off"}</p>
            <p className="text-xs text-muted-foreground">
              {str(proxyStatus.shared_store_backend) ?? "unknown"} state · {proxyPools.length} pools · {proxiedProviders} proxied / {directProviders} direct
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader className="text-sm font-medium text-muted-foreground">
          Provider budgets & cooldowns (breaker opens after {num(cooldown.failure_threshold, 3)} consecutive failures; base {num(cooldown.base_seconds, 30)}s ×2ⁿ capped {num(cooldown.max_seconds, 900)}s; half-open probe after {num(cooldown.half_open_after_seconds, 60)}s)
        </CardHeader>
        <CardContent>
          <DataTable
            columns={columns}
            rows={rows}
            getRowId={(r) => r.provider}
            emptyMessage="No governed providers."
            pageSize={10}
            tableId="geospatial-egress-providers"
          />
        </CardContent>
      </Card>

      <Card data-testid="egress-raw">
        <CardHeader className="text-sm font-medium text-muted-foreground">Full status (raw)</CardHeader>
        <CardContent>
          <JsonExplorer data={status} />
        </CardContent>
      </Card>
    </div>
  );
}
