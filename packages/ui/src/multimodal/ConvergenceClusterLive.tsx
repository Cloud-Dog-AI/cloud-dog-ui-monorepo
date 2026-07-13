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

// @cloud-dog/ui — ConvergenceClusterLive (W28F-948): live convergence clusters.
//
// Renders cross-source convergence clusters that appear/grow as research SSE
// events arrive. Built from shared Card primitives + a Badge for the source
// count; no bespoke layout framework.

import * as React from "react";
import { cn } from "../utils/cn";
import { Card, CardContent, CardHeader } from "../components/card";
import { Badge } from "../components/layout/Badge";
import type { ConvergenceCluster, ConvergenceEvent } from "./types";

export type ConvergenceClusterLiveProps = Readonly<{
  /**
   * Either a fully-formed cluster list, or an ordered convergence event stream
   * that is folded into clusters live. Supply whichever the caller has.
   */
  clusters?: ReadonlyArray<ConvergenceCluster>;
  events?: ReadonlyArray<ConvergenceEvent>;
  emptyMessage?: string;
  dataTestId?: string;
  className?: string;
}>;

/** Fold an ordered convergence event stream into a de-duplicated cluster list. */
export function reduceConvergence(events: ReadonlyArray<ConvergenceEvent>): ConvergenceCluster[] {
  const map = new Map<string, { claim: string; score?: number; sources: Map<string, ConvergenceCluster["sources"][number]> }>();
  for (const ev of events) {
    if (ev.kind === "cluster") {
      const existing = map.get(ev.cluster.id);
      const sources = existing?.sources ?? new Map();
      for (const s of ev.cluster.sources) sources.set(s.id, s);
      map.set(ev.cluster.id, { claim: ev.cluster.claim, score: ev.cluster.score, sources });
    } else {
      const existing = map.get(ev.clusterId);
      if (existing) existing.sources.set(ev.source.id, ev.source);
      else map.set(ev.clusterId, { claim: ev.clusterId, sources: new Map([[ev.source.id, ev.source]]) });
    }
  }
  return [...map.entries()].map(([id, v]) => ({ id, claim: v.claim, score: v.score, sources: [...v.sources.values()] }));
}

export function ConvergenceClusterLive(props: ConvergenceClusterLiveProps) {
  const { clusters, events, emptyMessage = "Convergence clusters will appear as sources corroborate…", dataTestId = "mm-convergence-live", className } = props;
  const resolved = React.useMemo<ReadonlyArray<ConvergenceCluster>>(
    () => clusters ?? (events ? reduceConvergence(events) : []),
    [clusters, events],
  );

  return (
    <div data-testid={dataTestId} className={cn("flex flex-col gap-2", className)}>
      <div className="flex items-center justify-between text-xs text-muted-foreground" aria-live="polite">
        <span>Convergence clusters</span>
        <span data-testid={`${dataTestId}-count`}>{resolved.length} {resolved.length === 1 ? "cluster" : "clusters"}</span>
      </div>
      {resolved.length === 0 ? (
        <p data-testid={`${dataTestId}-empty`} className="rounded bg-muted px-2 py-1 text-xs text-muted-foreground">
          {emptyMessage}
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {resolved.map((c) => (
            <li key={c.id}>
              <Card data-testid={`${dataTestId}-cluster-${c.id}`}>
                <CardHeader className="flex flex-row items-start justify-between gap-2">
                  <p className="text-sm font-medium text-foreground">{c.claim}</p>
                  <Badge data-testid={`${dataTestId}-cluster-${c.id}-count`}>
                    {c.sources.length} {c.sources.length === 1 ? "source" : "sources"}
                  </Badge>
                </CardHeader>
                <CardContent>
                  <ul className="flex flex-col gap-0.5">
                    {c.sources.map((s) => (
                      <li key={s.id} className="text-xs">
                        {s.url ? (
                          <a
                            href={s.url}
                            target="_blank"
                            rel="noreferrer"
                            className="text-primary underline hover:no-underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                          >
                            {s.title}
                          </a>
                        ) : (
                          <span className="text-foreground">{s.title}</span>
                        )}
                        {s.backend ? <span className="ml-1 text-muted-foreground">· {s.backend}</span> : null}
                      </li>
                    ))}
                  </ul>
                </CardContent>
              </Card>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
