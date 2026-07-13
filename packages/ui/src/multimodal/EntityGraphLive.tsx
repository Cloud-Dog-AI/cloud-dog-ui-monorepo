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

// @cloud-dog/ui — EntityGraphLive (W28F-948): live-updating entity graph.
//
// Composes the shared RelationshipGraph (no fork). It folds an ordered stream of
// EntityGraphEvents (delivered as SSE events arrive) into an accumulating
// node/edge set, so the graph grows live as a research run converges.

import * as React from "react";
import { cn } from "../utils/cn";
import { RelationshipGraph } from "../patterns/RelationshipGraph";
import type { RelationshipEdge, RelationshipNode } from "../patterns/RelationshipGraph";
import type { EntityGraphEvent } from "./types";

export type EntityGraphLiveProps = Readonly<{
  /** Ordered events seen so far; appending to this array grows the graph live. */
  events: ReadonlyArray<EntityGraphEvent>;
  /** Optional centre node id passed through to RelationshipGraph. */
  centerNodeId?: string;
  onNodeClick?: (id: string) => void;
  emptyMessage?: string;
  dataTestId?: string;
  className?: string;
}>;

/** Fold an ordered event stream into a de-duplicated node/edge set. */
export function reduceEntityGraph(events: ReadonlyArray<EntityGraphEvent>): {
  nodes: RelationshipNode[];
  edges: RelationshipEdge[];
} {
  const nodeMap = new Map<string, RelationshipNode>();
  const edgeMap = new Map<string, RelationshipEdge>();
  for (const ev of events) {
    if (ev.kind === "node") {
      nodeMap.set(ev.id, { id: ev.id, label: ev.label, type: ev.type, meta: ev.meta });
    } else {
      const key = `${ev.type}:${ev.source}->${ev.target}`;
      edgeMap.set(key, { source: ev.source, target: ev.target, type: ev.type, label: ev.label });
    }
  }
  return { nodes: [...nodeMap.values()], edges: [...edgeMap.values()] };
}

export function EntityGraphLive(props: EntityGraphLiveProps) {
  const {
    events,
    centerNodeId,
    onNodeClick,
    emptyMessage = "Entities will appear as the research run converges…",
    dataTestId = "mm-entity-graph-live",
    className,
  } = props;

  const { nodes, edges } = React.useMemo(() => reduceEntityGraph(events), [events]);

  return (
    <div data-testid={dataTestId} className={cn("flex flex-col gap-1", className)}>
      <div
        className="flex items-center justify-between text-xs text-muted-foreground"
        aria-live="polite"
        data-testid={`${dataTestId}-status`}
      >
        <span>Entity graph</span>
        <span data-testid={`${dataTestId}-count`}>
          {nodes.length} {nodes.length === 1 ? "entity" : "entities"}, {edges.length} {edges.length === 1 ? "link" : "links"}
        </span>
      </div>
      <RelationshipGraph
        nodes={nodes}
        edges={edges}
        centerNodeId={centerNodeId}
        onNodeClick={onNodeClick}
        emptyMessage={emptyMessage}
        dataTestId={`${dataTestId}-graph`}
      />
    </div>
  );
}
