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

// @cloud-dog/ui — JobsPage pattern (job list with status badges and controls).

import * as React from "react";
import { cn } from "../utils/cn";
import { Button } from "../components/button/Button";
import { Badge } from "../components/layout/Badge";
import { DataTable } from "../components/table/DataTable";
import type { DataColumn } from "../components/table/DataTable";

export type JobStatus = "queued" | "running" | "completed" | "failed" | "cancelled";

export type JobItem = Readonly<{
  id: string;
  name: string;
  status: JobStatus;
  progress?: number;
  startedAt?: string;
  duration?: string;
}>;

export type JobsPageProps = Readonly<{
  jobs: JobItem[];
  onCancel?: (jobId: string) => void;
  onViewDetail?: (jobId: string) => void;
  className?: string;
}>;

const statusVariant: Record<JobStatus, "default" | "secondary" | "destructive"> = {
  queued: "secondary",
  running: "default",
  completed: "secondary",
  failed: "destructive",
  cancelled: "secondary",
};

export function JobsPage(props: JobsPageProps) {
  const columns: DataColumn<JobItem>[] = [
    { id: "name", header: "Job", cell: (r) => r.name, sortable: true, sortValue: (r) => r.name },
    {
      id: "status",
      header: "Status",
      cell: (r) => <Badge variant={statusVariant[r.status]}>{r.status}</Badge>,
    },
    {
      id: "progress",
      header: "Progress",
      cell: (r) =>
        r.progress != null ? (
          <div className="flex items-center gap-2">
            <div className="h-1.5 w-20 rounded-full bg-muted">
              <div className="h-full rounded-full bg-primary" style={{ width: `${r.progress}%` }} />
            </div>
            <span className="text-xs text-muted-foreground">{r.progress}%</span>
          </div>
        ) : (
          <span className="text-xs text-muted-foreground">--</span>
        ),
    },
    { id: "startedAt", header: "Started", cell: (r) => r.startedAt ?? "--" },
    { id: "duration", header: "Duration", cell: (r) => r.duration ?? "--" },
    {
      id: "__actions",
      header: "Actions",
      cell: (r) => (
        <div className="flex items-center gap-1">
          {props.onViewDetail ? (
            <Button variant="ghost" size="sm" onClick={() => props.onViewDetail!(r.id)}>
              Detail
            </Button>
          ) : null}
          {props.onCancel && r.status === "running" ? (
            <Button variant="ghost" size="sm" onClick={() => props.onCancel!(r.id)}>
              Cancel
            </Button>
          ) : null}
        </div>
      ),
    },
  ];

  return (
    <div className={cn("space-y-4", props.className)}>
      <header>
        <h1 className="text-xl font-semibold">Jobs</h1>
        <div className="text-sm text-muted-foreground">{props.jobs.length} jobs</div>
      </header>

      <div className="rounded-md border bg-background">
        <DataTable columns={columns} rows={props.jobs} emptyMessage="No jobs found." />
      </div>
    </div>
  );
}
