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

// @cloud-dog/ui — HealthWidget pattern (traffic-light service health card).

import * as React from "react";
import { cn } from "../utils/cn";
import { Card, CardContent } from "../components/card/Card";

export type HealthStatus = "ok" | "warning" | "error" | "unknown";

export type HealthWidgetProps = Readonly<{
  name: string;
  status: HealthStatus;
  detail?: string;
  url?: string;
  className?: string;
}>;

const dotColor: Record<HealthStatus, string> = {
  ok: "bg-green-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
  unknown: "bg-gray-400",
};

export function HealthWidget(props: HealthWidgetProps) {
  return (
    <Card className={cn("overflow-hidden", props.className)}>
      <CardContent className="flex items-center gap-3 py-3">
        <span
          className={cn("inline-block h-3 w-3 shrink-0 rounded-full", dotColor[props.status])}
          role="img"
          aria-label={`Status: ${props.status}`}
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-semibold truncate">{props.name}</div>
          {props.detail ? (
            <div className="text-xs text-muted-foreground truncate">{props.detail}</div>
          ) : null}
        </div>
        {props.url ? (
          <a
            href={props.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs text-primary underline shrink-0"
          >
            Open
          </a>
        ) : null}
      </CardContent>
    </Card>
  );
}
