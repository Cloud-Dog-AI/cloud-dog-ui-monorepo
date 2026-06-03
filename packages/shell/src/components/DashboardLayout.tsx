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

// @cloud-dog/shell — DashboardLayout: Standard dashboard grid (UI-R20).

import * as React from "react";
import { cn } from "@cloud-dog/ui";

export interface DashboardLayoutProps {
  healthWidgets?: React.ReactNode;
  metricCards?: React.ReactNode;
  quickActions?: React.ReactNode;
  recentActivity?: React.ReactNode;
  children?: React.ReactNode;
  className?: string;
}

export function DashboardLayout(props: DashboardLayoutProps) {
  return (
    <div className={cn("flex flex-col gap-6 p-4", props.className)}>
      {props.healthWidgets && (
        <section aria-label="Health status">
          <div className="flex flex-wrap gap-4">{props.healthWidgets}</div>
        </section>
      )}

      {props.metricCards && (
        <section aria-label="Key metrics">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">{props.metricCards}</div>
        </section>
      )}

      {props.quickActions && (
        <section aria-label="Quick actions">
          <div className="flex flex-wrap gap-2">{props.quickActions}</div>
        </section>
      )}

      {props.recentActivity && (
        <section aria-label="Recent activity">
          <div className="rounded-lg border bg-card p-4">{props.recentActivity}</div>
        </section>
      )}

      {props.children}
    </div>
  );
}
