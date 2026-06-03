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

// @cloud-dog/ui — ResourceMetrics pattern (system resource display).

import * as React from "react";
import { cn } from "../utils/cn";
import { StatusCard } from "./StatusCard";
import type { StatusTone } from "./StatusCard";

export type MetricItem = Readonly<{
  label: string;
  value: string;
  unit?: string;
  tone?: StatusTone;
}>;

export type ResourceMetricsProps = Readonly<{
  metrics: MetricItem[];
  fetchUrl?: string;
  intervalMs?: number;
  getAccessToken?: () => string | null;
  className?: string;
}>;

type RawMetrics = Record<string, unknown>;

const METRIC_KEYS: { key: string; label: string; unit: string }[] = [
  { key: "uptime", label: "Uptime", unit: "s" },
  { key: "memory_mb", label: "Memory", unit: "MB" },
  { key: "cpu_percent", label: "CPU", unit: "%" },
  { key: "disk_percent", label: "Disk", unit: "%" },
  { key: "active_connections", label: "Connections", unit: "" },
];

function mapRawToMetrics(raw: RawMetrics): MetricItem[] {
  return METRIC_KEYS.map(({ key, label, unit }) => {
    const v = raw[key];
    const value = v != null ? String(v) : "N/A";
    const tone: StatusTone | undefined =
      value === "N/A" ? "neutral" : undefined;
    return { label, value, unit: value === "N/A" ? undefined : unit, tone };
  });
}

export function ResourceMetrics(props: ResourceMetricsProps) {
  const { fetchUrl, intervalMs = 30_000, getAccessToken } = props;
  const [polledMetrics, setPolledMetrics] = React.useState<MetricItem[] | null>(null);

  React.useEffect(() => {
    if (!fetchUrl) return;

    const doFetch = async () => {
      try {
        const headers: HeadersInit = { Accept: "application/json" };
        const token = getAccessToken?.();
        if (token) headers["Authorization"] = `Bearer ${token}`;
        const res = await fetch(fetchUrl, { headers });
        if (!res.ok) return;
        const data: RawMetrics = await res.json();
        setPolledMetrics(mapRawToMetrics(data));
      } catch {
        // keep previous metrics on failure
      }
    };

    doFetch();
    const id = setInterval(doFetch, intervalMs);
    return () => clearInterval(id);
  }, [fetchUrl, intervalMs, getAccessToken]);

  const displayMetrics = polledMetrics ?? props.metrics;

  return (
    <div className={cn("space-y-2", props.className)} role="region" aria-label="Resource metrics" data-testid="resource-metrics">
      {fetchUrl ? (
        <div className="text-xs text-foreground/60">Auto-refresh: {intervalMs}ms</div>
      ) : null}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {displayMetrics.map((m) => (
          <StatusCard
            key={m.label}
            title={m.label}
            value={m.unit ? `${m.value} ${m.unit}` : m.value}
            tone={m.tone}
          />
        ))}
      </div>
    </div>
  );
}
