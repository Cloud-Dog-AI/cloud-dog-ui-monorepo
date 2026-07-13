// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Licensed under the Apache License, Version 2.0.

// W28H-1122: Vitest render tests for the Egress Governance page — the panel
// renders the shared status-builder payload (mode, actor window, TTLs, queue,
// provider budget/cooldown table) and surfaces API errors (403 stays honest).

import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor, cleanup } from "@testing-library/react";
import { ApiError } from "@cloud-dog/api-client";

const egressStatus = vi.fn();
vi.mock("../state/AppState", () => ({
  useGeoState: () => ({ api: { egressStatus }, appVersion: "0.1.0", apiBaseUrl: "/api" }),
}));

import { EgressPage } from "./EgressPage";

const STATUS = {
  service: "geospatial-mcp-server",
  modes: {
    service_default: "LIVE",
    request_effective: "LIVE",
    override_permission: "geo.mode.override",
    ranking: ["OFFLINE", "SIMULATE", "DEV", "LIVE"],
  },
  ttls: {
    default_ttl_seconds: 3600,
    provider_overrides: { osm_nominatim: 86400 },
    operation_overrides: {},
    dev_ttl_multiplier: 4.0,
  },
  rate_limits: {
    inbound_scopes: {
      actor: { limit_per_min: 60, used: 7, limit: 60, remaining: 53, window_seconds: 60, reset_seconds: 42 },
      api_key: { limit_per_min: 60 },
      service: { limit_per_min: 240 },
      endpoint: { limit_per_min: 0 },
      operation: { limit_per_min: 0 },
    },
    outbound_default_per_min: 60,
    response_shape: { code: "RATE_LIMITED", http_status: 429, retryable: true, header: "Retry-After" },
  },
  providers: {
    osm_nominatim: {
      limit_per_min: 60,
      usage: { used: 3, limit: 60, remaining: 57, window_seconds: 60, reset_seconds: 12 },
      limited: false,
      reason: null,
      consecutive_failures: 0,
      breaker: "closed",
    },
    openaq: {
      limit_per_min: 60,
      usage: { used: 0, limit: 60, remaining: 60, window_seconds: 60, reset_seconds: 0 },
      limited: true,
      reason: "upstream_retry_after",
      cooldown_remaining_seconds: 118,
      estimated_resolves_at: "2026-07-06T12:02:00+00:00",
      consecutive_failures: 1,
      breaker: "closed",
    },
  },
  cooldown_policy: { base_seconds: 30, max_seconds: 900, failure_threshold: 3, half_open_after_seconds: 60 },
  cache: { modes: ["use_cache"], default_mode: "use_cache", layers: {} },
  queue: { handoff_enabled: true, max_queued_per_actor: 20, depth: 2 },
  proxy: {
    enabled: true,
    available: true,
    service: "geospatial-mcp-server",
    shared_store_backend: "valkey",
    system_default_pool: "default",
    no_proxy: ["*.cloud-dog.net", "localhost"],
    pools: [
      { name: "default", strategy: "round_robin", healthy_count: 1, members: [{ id: "p1" }] },
    ],
    providers: {
      osm_nominatim: {
        direct: false,
        host: "nominatim.openstreetmap.org",
        pool: "default",
        strategy: "round_robin",
        healthy_count: 1,
        member_count: 1,
        latest_selection: { proxy_id: "p1", pool: "default", direct: false },
      },
      openaq: {
        direct: false,
        host: "api.openaq.org",
        pool: "default",
        strategy: "round_robin",
        healthy_count: 1,
        member_count: 1,
      },
      cloud_dog_search: {
        direct: true,
        reason: "internal_no_proxy",
        host: "searchmcp0.cloud-dog.net",
      },
    },
  },
  dev_posture: {},
  public_safe: true,
};

beforeEach(() => {
  egressStatus.mockReset();
  cleanup();
});

describe("EgressPage", () => {
  it("renders mode, actor window, TTL, queue cards and the provider table from the shared status payload", async () => {
    egressStatus.mockResolvedValue(STATUS);
    render(<EgressPage />);
    await waitFor(() => expect(screen.getByTestId("egress-mode-badge")).toHaveTextContent("LIVE"));
    expect(screen.getByTestId("page-egress")).toBeInTheDocument();
    // Actor window 7/60.
    expect(screen.getByTestId("egress-card-window")).toHaveTextContent("7/60");
    // TTL default + DEV multiplier.
    expect(screen.getByTestId("egress-card-ttl")).toHaveTextContent("3600s");
    expect(screen.getByTestId("egress-card-ttl")).toHaveTextContent("×4");
    // Queue depth + handoff posture.
    expect(screen.getByTestId("egress-card-queue")).toHaveTextContent("2");
    expect(screen.getByTestId("egress-card-queue")).toHaveTextContent("handoff enabled");
    // Shared proxy pool status/provenance.
    expect(screen.getByTestId("egress-card-proxy")).toHaveTextContent("on");
    expect(screen.getByTestId("egress-card-proxy")).toHaveTextContent("valkey state");
    expect(screen.getAllByText("default").length).toBeGreaterThan(0);
    expect(screen.getByText(/last p1/)).toBeInTheDocument();
    // Provider rows: the cooled-down provider is flagged with its honest reason
    // and cooldown; the healthy one shows availability.
    expect(screen.getByText("openaq")).toBeInTheDocument();
    expect(screen.getByText("upstream_retry_after")).toBeInTheDocument();
    expect(screen.getByText(/118s/)).toBeInTheDocument();
    expect(screen.getByText("osm_nominatim")).toBeInTheDocument();
    expect(screen.getByText("available")).toBeInTheDocument();
    // No secrets anywhere in the rendered page.
    expect(document.body.textContent).not.toMatch(/password|secret/i);
  });

  it("surfaces a backend error (e.g. RBAC 403) instead of rendering stale data", async () => {
    egressStatus.mockRejectedValue(new ApiError("Forbidden", { status: 403 }));
    render(<EgressPage />);
    await waitFor(() => expect(screen.getByText(/Forbidden/)).toBeInTheDocument());
  });

  it("refresh re-queries the status endpoint", async () => {
    egressStatus.mockResolvedValue(STATUS);
    render(<EgressPage />);
    await waitFor(() => expect(egressStatus).toHaveBeenCalledTimes(1));
    screen.getByTestId("egress-refresh").click();
    await waitFor(() => expect(egressStatus).toHaveBeenCalledTimes(2));
  });
});
