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

// @cloud-dog/ui — PromptTestRunner pattern (prompt test cases + results panel).
//
// Presentation-only: the host owns the cases, the results, and the run action.
// Built on top of the shared DataTable.

import * as React from "react";
import { cn } from "../utils/cn";
import { Button } from "../components/button/Button";
import { Badge } from "../components/layout/Badge";
import { DataTable } from "../components/table/DataTable";
import type { DataColumn } from "../components/table/DataTable";

/** A single test case for a prompt template. */
export type PromptTestCase = Readonly<{
  id: string;
  name: string;
  /** Optional rendered input / variable bindings shown for context. */
  input?: string;
  /** Optional expected output / assertion description. */
  expected?: string;
}>;

export type PromptTestStatus = "pass" | "fail" | "running" | "pending";

/** Result of executing a test case. Keyed back to a case by `caseId`. */
export type PromptTestResult = Readonly<{
  caseId: string;
  status: PromptTestStatus;
  /** Optional actual output produced by the run. */
  actual?: string;
  /** Optional failure / diagnostic message. */
  message?: string;
  /** Optional run duration (e.g. "1.2s"). */
  duration?: string;
}>;

export type PromptTestRunnerProps = Readonly<{
  cases: PromptTestCase[];
  /** Results keyed by case id. Cases without a result render as "pending". */
  results?: PromptTestResult[];
  /** Run a single case (omit to hide the per-row run button). */
  onRun?: (caseId: string) => void;
  /** Run every case at once (omit to hide the "Run all" button). */
  onRunAll?: () => void;
  /** Disable all run controls (e.g. while a run is in flight). */
  busy?: boolean;
  className?: string;
}>;

const statusVariant: Record<PromptTestStatus, "default" | "secondary" | "destructive"> = {
  pass: "default",
  fail: "destructive",
  running: "secondary",
  pending: "secondary",
};

const statusLabel: Record<PromptTestStatus, string> = {
  pass: "Pass",
  fail: "Fail",
  running: "Running",
  pending: "Pending",
};

export function PromptTestRunner(props: PromptTestRunnerProps) {
  const { cases, results = [], onRun, onRunAll, busy = false, className } = props;

  const resultByCase = React.useMemo(() => {
    const map = new Map<string, PromptTestResult>();
    for (const r of results) map.set(r.caseId, r);
    return map;
  }, [results]);

  const passCount = React.useMemo(
    () => cases.filter((c) => resultByCase.get(c.id)?.status === "pass").length,
    [cases, resultByCase],
  );
  const failCount = React.useMemo(
    () => cases.filter((c) => resultByCase.get(c.id)?.status === "fail").length,
    [cases, resultByCase],
  );

  const columns: DataColumn<PromptTestCase>[] = [
    { id: "name", header: "Test case", cell: (r) => r.name, sortable: true, sortValue: (r) => r.name },
    {
      id: "status",
      header: "Result",
      cell: (r) => {
        const status = resultByCase.get(r.id)?.status ?? "pending";
        return (
          <Badge variant={statusVariant[status]} data-testid={`prompt-test-status-${r.id}`}>
            {statusLabel[status]}
          </Badge>
        );
      },
    },
    {
      id: "message",
      header: "Detail",
      cell: (r) => {
        const result = resultByCase.get(r.id);
        const detail = result?.message ?? result?.actual ?? r.expected ?? "--";
        return <span className="text-xs text-muted-foreground">{detail}</span>;
      },
    },
    {
      id: "duration",
      header: "Duration",
      cell: (r) => resultByCase.get(r.id)?.duration ?? "--",
    },
    {
      id: "__actions",
      header: "Actions",
      cell: (r) =>
        onRun ? (
          <Button
            variant="ghost"
            size="sm"
            disabled={busy}
            data-testid={`prompt-test-run-${r.id}`}
            onClick={() => onRun(r.id)}
          >
            Run
          </Button>
        ) : null,
    },
  ];

  return (
    <div className={cn("space-y-4", className)} data-testid="prompt-test-runner">
      <header className="flex items-center gap-3">
        <div className="min-w-0">
          <h2 className="text-lg font-semibold">Test cases</h2>
          <div className="text-sm text-muted-foreground" data-testid="prompt-test-summary">
            {cases.length} cases · {passCount} passed · {failCount} failed
          </div>
        </div>
        {onRunAll ? (
          <Button
            className="ml-auto"
            variant="secondary"
            size="sm"
            disabled={busy || cases.length === 0}
            data-testid="prompt-test-run-all"
            onClick={onRunAll}
          >
            Run all
          </Button>
        ) : null}
      </header>

      <div className="rounded-md border bg-background">
        <DataTable
          columns={columns}
          rows={cases}
          getRowId={(r) => r.id}
          ariaLabel="Prompt test cases"
          emptyMessage="No test cases."
        />
      </div>
    </div>
  );
}
