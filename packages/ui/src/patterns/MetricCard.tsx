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

// @cloud-dog/ui — MetricCard pattern (compact KPI card with optional trend).

import * as React from "react";
import { cn } from "../utils/cn";
import { Card, CardContent } from "../components/card/Card";

export type MetricTrend = "up" | "down" | "flat";

export type MetricCardProps = Readonly<{
  label: string;
  value: string | number;
  unit?: string;
  trend?: MetricTrend;
  tone?: "default" | "success" | "warning" | "danger";
  className?: string;
  /**
   * Optional activation handler. When provided the card becomes an accessible
   * button (keyboard-operable, hover/focus affordance) so a dashboard tile can
   * drill through to a listing. Router navigation stays with the caller \u2014 this
   * primitive is router-agnostic. (CL-11 / CL-12, W28E-1876.)
   */
  onClick?: () => void;
  /** Accessible label for the clickable card (defaults to the metric label). */
  ariaLabel?: string;
  /**
   * Optional test id forwarded to the root card element so E2E/Playwright
   * selectors (e.g. `get_by_test_id("kpi-total")`) can target the tile.
   * (W28R-3018 — the prop was previously dropped, so dashboard KPI tiles were
   * unaddressable by data-testid.)
   */
  "data-testid"?: string;
}>;

const trendArrow: Record<MetricTrend, string> = {
  up: "\u2191",
  down: "\u2193",
  flat: "\u2192",
};

export function MetricCard(props: MetricCardProps) {
  const clickable = typeof props.onClick === "function";
  const interactiveProps = clickable
    ? {
        role: "button" as const,
        tabIndex: 0,
        "aria-label": props.ariaLabel ?? props.label,
        onClick: props.onClick,
        onKeyDown: (event: React.KeyboardEvent<HTMLDivElement>) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            props.onClick?.();
          }
        },
      }
    : {};

  return (
    <Card
      className={cn(
        "overflow-hidden",
        clickable &&
          "cursor-pointer transition-colors hover:bg-accent/40 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring",
        props.className
      )}
      data-testid={props["data-testid"]}
      {...interactiveProps}
    >
      <CardContent className="py-3">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{props.label}</div>
        <div className="mt-1 flex items-baseline gap-1">
          <span className="text-2xl font-semibold">{props.value}</span>
          {props.unit ? <span className="text-sm text-muted-foreground">{props.unit}</span> : null}
          {props.trend ? (
            <span className="ml-2 text-sm" aria-label={`Trend: ${props.trend}`}>
              {trendArrow[props.trend]}
            </span>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
