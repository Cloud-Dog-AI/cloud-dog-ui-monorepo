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

// @cloud-dog/ui — Alert component.

import * as React from "react";
import { cn } from "../../utils/cn";

export function Alert(props: React.HTMLAttributes<HTMLDivElement> & { variant?: "default" | "destructive" | "warning" | "success" }) {
  const v = props.variant ?? "default";
  const cls =
    v === "destructive"
      ? "border-destructive/30 bg-destructive/10 text-foreground"
      : v === "warning"
      ? "border-accent/30 bg-accent/10 text-foreground"
      : v === "success"
      ? "border-primary/30 bg-primary/10 text-foreground"
      : "border-border bg-card text-foreground";
  return (
    <div
      {...props}
      role="alert"
      className={cn("rounded-md border p-4 text-sm", cls, props.className)}
    />
  );
}
