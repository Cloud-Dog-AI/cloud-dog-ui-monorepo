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

// @cloud-dog/ui — W28A-871 ActionableError.

import * as React from "react";
import { AlertTriangle } from "lucide-react";
import { Button } from "../components/button";
import { cn } from "../utils/cn";

export type ActionableErrorAction = Readonly<{
  label: string;
  href?: string;
  onClick?: () => void;
}>;

export type ActionableErrorProps = Readonly<{
  title?: string;
  message: string;
  action?: ActionableErrorAction;
  details?: React.ReactNode;
  className?: string;
  "data-testid"?: string;
}>;

export function ActionableError({ title = "Action required", message, action, details, className, "data-testid": testId }: ActionableErrorProps) {
  return (
    <div
      className={cn("flex items-start gap-3 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm", className)}
      data-component="ActionableError"
      data-testid={testId}
      role="alert"
    >
      <AlertTriangle aria-hidden="true" className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
      <div className="min-w-0 flex-1 space-y-1">
        <div className="font-medium text-foreground">{title}</div>
        <div className="text-muted-foreground">{message}</div>
        {details ? <div className="text-xs text-muted-foreground">{details}</div> : null}
      </div>
      {action ? (
        action.href ? (
          <Button asChild size="sm" variant="secondary">
            <a href={action.href}>{action.label}</a>
          </Button>
        ) : (
          <Button onClick={action.onClick} size="sm" type="button" variant="secondary">
            {action.label}
          </Button>
        )
      ) : null}
    </div>
  );
}
