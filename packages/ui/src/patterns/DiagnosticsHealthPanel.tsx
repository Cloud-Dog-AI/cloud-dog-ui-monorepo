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

// @cloud-dog/ui — DiagnosticsHealthPanel pattern.
//
// PS-WEBUI-STYLE-COMPONENTS §10 / PS-30 W28E-1851 (STD-F16): the canonical
// composition for the "Developer diagnostics / health / resource metrics" page
// family — the live "is this service healthy" panel that sits on the `/audit-log`
// surface, above the NIST AU-3 audit/log table.
//
// It composes the shared ResourceMetrics row (polling /status or
// /webapi/v1/metrics), a HealthWidget service/dependency grid using the single
// ok/warning/error/unknown vocabulary, an optional MetricCard KPI row, the
// canonical loading (role=status) / error (role=alert) states, a manual Refresh
// control, and a service-extension slot (children) for domain diagnostics panels
// and probes. Services preserve uncommon functionality through props/children;
// they MUST NOT fork the shared components.

import * as React from "react";
import { cn } from "../utils/cn";
import { Button } from "../components/button/Button";
import { Card, CardContent, CardHeader } from "../components/card/Card";
import { ResourceMetrics } from "./ResourceMetrics";
import type { MetricItem } from "./ResourceMetrics";
import { HealthWidget } from "./HealthWidget";
import type { HealthStatus } from "./HealthWidget";
import { MetricCard } from "./MetricCard";

/** A single service/dependency health card on the diagnostics panel (§10.4). */
export type DiagnosticsHealthItem = Readonly<{
  name: string;
  status: HealthStatus; // ok | warning | error | unknown
  detail?: string;
  url?: string;
}>;

/** An optional domain KPI card on the diagnostics panel. */
export type DiagnosticsMetricCardItem = Readonly<{
  label: string;
  value: string | number;
  unit?: string;
  trend?: "up" | "down" | "flat";
  tone?: "default" | "success" | "warning" | "danger";
}>;

export type DiagnosticsHealthPanelProps = Readonly<{
  /** Panel heading. Default "System diagnostics". */
  title?: string;
  /** Optional one-line description under the heading. */
  description?: string;
  /** ResourceMetrics fetch URL — `/status` or `/webapi/v1/metrics`. When omitted,
   * the fallback metric tiles render (N/A by default). */
  metricsUrl?: string;
  /** ResourceMetrics poll interval. Default 30_000 ms (PS-30 UI-R24). */
  metricsIntervalMs?: number;
  /** Bearer-token accessor for the metrics fetch (omit for cookie-auth services). */
  getAccessToken?: () => string | null;
  /** Fallback / initial metric tiles shown before the first poll or when no URL is
   * supplied. Defaults to the canonical Uptime/Memory/CPU/Disk/Connections set,
   * all "N/A". */
  fallbackMetrics?: MetricItem[];
  /** Service/dependency health cards. */
  health?: readonly DiagnosticsHealthItem[];
  /** Optional domain KPI metric cards. */
  metricCards?: readonly DiagnosticsMetricCardItem[];
  /** First-load in flight — renders the role="status" loading indicator. */
  loading?: boolean;
  /** Load error — renders the role="alert" message. */
  error?: string | null;
  /** Manual refresh handler. When supplied, a Refresh button is rendered. */
  onRefresh?: () => void;
  /** Refresh button label. Default "Refresh". */
  refreshLabel?: string;
  /** Heading level for the panel title (default "h2"). */
  headingLevel?: "h1" | "h2" | "h3";
  className?: string;
  /** Stable test id. Default "diagnostics-health-panel". */
  testId?: string;
  /** Service-extension slot — domain diagnostics panels, probes, raw inspectors. */
  children?: React.ReactNode;
}>;

/** Canonical N/A fallback metric set (PS-30 UI-R11 — N/A, never "unknown"). */
const DEFAULT_FALLBACK_METRICS: MetricItem[] = [
  { label: "Uptime", value: "N/A", tone: "neutral" },
  { label: "Memory", value: "N/A", tone: "neutral" },
  { label: "CPU", value: "N/A", tone: "neutral" },
  { label: "Disk (cache)", value: "N/A", tone: "neutral" },
  { label: "Connections", value: "N/A", tone: "neutral" },
];

export function DiagnosticsHealthPanel(props: DiagnosticsHealthPanelProps) {
  const {
    title = "System diagnostics",
    description,
    metricsUrl,
    metricsIntervalMs = 30_000,
    getAccessToken,
    fallbackMetrics = DEFAULT_FALLBACK_METRICS,
    health = [],
    metricCards = [],
    loading = false,
    error = null,
    onRefresh,
    refreshLabel = "Refresh",
    headingLevel = "h2",
    className,
    testId = "diagnostics-health-panel",
    children,
  } = props;

  const Heading = headingLevel;

  return (
    <Card className={cn("overflow-hidden", className)} data-testid={testId}>
      <CardHeader className="flex flex-wrap items-start justify-between gap-3 pb-3">
        <div className="min-w-0 space-y-1">
          <Heading className="text-lg font-semibold">{title}</Heading>
          {description ? (
            <p className="text-sm text-muted-foreground">{description}</p>
          ) : null}
        </div>
        {onRefresh ? (
          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={onRefresh}
            disabled={loading}
            data-testid="diagnostics-refresh"
          >
            {refreshLabel}
          </Button>
        ) : null}
      </CardHeader>

      <CardContent className="space-y-4">
        {error ? (
          <p role="alert" className="text-sm text-destructive" data-testid="diagnostics-error">
            {error}
          </p>
        ) : null}

        {loading ? (
          <div
            role="status"
            aria-live="polite"
            className="text-sm text-muted-foreground"
            data-testid="diagnostics-loading"
          >
            Loading diagnostics…
          </div>
        ) : null}

        {/* Resource-metrics row (§10.5.3.1 / §10.6) */}
        <section aria-label="Resource metrics" data-testid="diagnostics-resource-metrics">
          <ResourceMetrics
            metrics={fallbackMetrics}
            fetchUrl={metricsUrl}
            intervalMs={metricsIntervalMs}
            getAccessToken={getAccessToken}
          />
        </section>

        {/* Service / dependency health grid (§10.5.3.2 / §10.4 vocabulary) */}
        {health.length > 0 ? (
          <section
            aria-label="Service health"
            data-testid="diagnostics-health-grid"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
          >
            {health.map((item) => (
              <HealthWidget
                key={item.name}
                name={item.name}
                status={item.status}
                detail={item.detail}
                url={item.url}
              />
            ))}
          </section>
        ) : null}

        {/* Optional domain KPI row (§10.5.3.3) */}
        {metricCards.length > 0 ? (
          <section
            aria-label="Diagnostics metrics"
            data-testid="diagnostics-metric-cards"
            className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4"
          >
            {metricCards.map((m) => (
              <MetricCard
                key={m.label}
                label={m.label}
                value={m.value}
                unit={m.unit}
                trend={m.trend}
                tone={m.tone}
              />
            ))}
          </section>
        ) : null}

        {/* Service-extension slot (§10.8 — no-loss) */}
        {children ? (
          <section data-testid="diagnostics-extension" className="space-y-4">
            {children}
          </section>
        ) : null}
      </CardContent>
    </Card>
  );
}
