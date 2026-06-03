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
}>;

const trendArrow: Record<MetricTrend, string> = {
  up: "\u2191",
  down: "\u2193",
  flat: "\u2192",
};

export function MetricCard(props: MetricCardProps) {
  return (
    <Card className={cn("overflow-hidden", props.className)}>
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
