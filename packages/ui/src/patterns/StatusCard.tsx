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

// @cloud-dog/ui — StatusCard pattern (operational summary card).

import * as React from "react";
import { cn } from "../utils/cn";
import { Card, CardContent, CardHeader } from "../components/card/Card";

export type StatusTone = "ok" | "warning" | "error" | "neutral";

export type StatusCardProps = Readonly<{
  title: string;
  value: string;
  tone?: StatusTone;
  trend?: string;
  className?: string;
}>;

function toneClass(tone: StatusTone): string {
  if (tone === "ok") return "bg-primary/10 border-primary/20";
  if (tone === "warning") return "bg-accent/10 border-accent/20";
  if (tone === "error") return "bg-destructive/10 border-destructive/20";
  return "";
}

export function StatusCard(props: StatusCardProps) {
  const tone = props.tone ?? "neutral";

  return (
    <Card className={cn("overflow-hidden", toneClass(tone), props.className)}>
      <CardHeader className="pb-3">
        <div className="text-xs uppercase tracking-wide text-foreground/80">{props.title}</div>
      </CardHeader>
      <CardContent className="pt-0">
        <div className="flex items-baseline gap-3">
          <div className="text-2xl font-semibold">{props.value}</div>
          {props.trend ? <div className="text-xs text-foreground/70">{props.trend}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}
