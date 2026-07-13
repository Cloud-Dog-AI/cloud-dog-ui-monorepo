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

// IMAP-301/302/303 / CX-170: moment-formatted uptime, byte-formatted disk metric.
function formatUptimeSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return "N/A";
  const s = Math.floor(seconds);
  if (s < 60) return `${s} second${s === 1 ? "" : "s"}`;
  const m = Math.floor(s / 60);
  if (m < 60) return `${m} minute${m === 1 ? "" : "s"}`;
  const h = Math.floor(m / 60);
  if (h < 24) {
    const rem = m % 60;
    return rem ? `${h}h ${rem}m` : `${h} hour${h === 1 ? "" : "s"}`;
  }
  const d = Math.floor(h / 24);
  const remH = h % 24;
  return remH ? `${d}d ${remH}h` : `${d} day${d === 1 ? "" : "s"}`;
}

function formatBytesLocal(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes < 0) return "N/A";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 ** 3) return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
  if (bytes < 1024 ** 4) return `${(bytes / 1024 ** 3).toFixed(2)} GB`;
  return `${(bytes / 1024 ** 4).toFixed(2)} TB`;
}

function mapRawToMetrics(raw: RawMetrics): MetricItem[] {
  const uptimeNum = Number(raw.uptime);
  const memMb = raw.memory_mb;
  const cpu = raw.cpu_percent;
  // IMAP-303: prefer cache_bytes_used (bytes) over disk_percent.
  const cacheBytes = raw.cache_bytes_used ?? raw.storage_bytes_used ?? raw.storage_bytes;
  const diskPercent = raw.disk_percent ?? raw.disk_used_percent ?? raw.disk_usage_percent;
  const conn = raw.active_connections;

  const diskValue = cacheBytes != null
    ? formatBytesLocal(Number(cacheBytes))
    : diskPercent != null
      ? `${diskPercent}%`
      : "N/A";
  const diskTone: StatusTone | undefined = diskValue === "N/A" ? "neutral" : undefined;

  return [
    { label: "Uptime", value: Number.isFinite(uptimeNum) ? formatUptimeSeconds(uptimeNum) : "N/A", tone: Number.isFinite(uptimeNum) ? undefined : "neutral" },
    { label: "Memory", value: memMb != null ? String(memMb) : "N/A", unit: memMb != null ? "MB" : undefined, tone: memMb != null ? undefined : "neutral" },
    { label: "CPU", value: cpu != null ? String(cpu) : "N/A", unit: cpu != null ? "%" : undefined, tone: cpu != null ? undefined : "neutral" },
    { label: "Disk (cache)", value: diskValue, tone: diskTone },
    { label: "Connections", value: conn != null ? String(conn) : "N/A", tone: conn != null ? undefined : "neutral" },
  ];
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

  // IMAP-301 / CX-170: render the auto-refresh interval as moment-formatted text.
  const intervalSec = Math.round(intervalMs / 1000);
  const intervalLabel = intervalSec < 60
    ? `${intervalSec} second${intervalSec === 1 ? "" : "s"}`
    : intervalSec < 3600
      ? `${Math.round(intervalSec / 60)} minute${Math.round(intervalSec / 60) === 1 ? "" : "s"}`
      : `${(intervalSec / 3600).toFixed(1)} hours`;

  // IMAP-305: 5-across when there are >=5 metrics; keep responsive cascade below.
  const colsClass = displayMetrics.length >= 5
    ? "grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5"
    : "grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4";

  return (
    <div className={cn("space-y-2", props.className)} role="region" aria-label="Resource metrics">
      {fetchUrl ? (
        <div className="text-xs text-foreground/60">Auto-refresh: {intervalLabel}</div>
      ) : null}
      <div className={colsClass}>
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
