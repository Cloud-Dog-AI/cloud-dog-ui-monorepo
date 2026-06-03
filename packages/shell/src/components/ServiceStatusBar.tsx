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

// @cloud-dog/shell — ServiceStatusBar: Health indicator strip (UI-R7).

import * as React from "react";
import { cn, Tooltip } from "@cloud-dog/ui";

export interface ServiceStatus {
  name: string;
  url: string;
  status: "ok" | "warning" | "error" | "unknown";
}

export interface ServiceStatusBarProps {
  services: ServiceStatus[];
  className?: string;
}

const dotColor: Record<ServiceStatus["status"], string> = {
  ok: "bg-green-500",
  warning: "bg-amber-500",
  error: "bg-red-500",
  unknown: "bg-gray-400",
};

export function ServiceStatusBar(props: ServiceStatusBarProps) {
  return (
    <div
      className={cn(
        "flex items-center gap-3 px-3 py-1 border-b bg-background text-xs text-muted-foreground",
        props.className,
      )}
      role="group"
      aria-label="Service health"
    >
      {props.services.map((svc) => (
        <Tooltip key={svc.name} content={`${svc.name} — ${svc.url}`}>
          <span className="inline-flex items-center gap-1">
            <span
              className={cn("h-2 w-2 rounded-full shrink-0", dotColor[svc.status])}
              aria-hidden="true"
            />
            <span>{svc.name}</span>
          </span>
        </Tooltip>
      ))}
    </div>
  );
}
