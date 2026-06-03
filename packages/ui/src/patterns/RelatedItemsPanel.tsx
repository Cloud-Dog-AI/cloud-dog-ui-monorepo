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

// @cloud-dog/ui — RelatedItemsPanel pattern (linked entities display).

import * as React from "react";
import { cn } from "../utils/cn";
import { Card, CardHeader, CardContent } from "../components/card/Card";
import { Badge } from "../components/layout/Badge";

export type RelatedItem = Readonly<{
  id: string;
  label: string;
  href?: string;
}>;

export type RelatedItemsPanelProps = Readonly<{
  title: string;
  items: RelatedItem[];
  emptyMessage?: string;
  className?: string;
}>;

export function RelatedItemsPanel(props: RelatedItemsPanelProps) {
  return (
    <Card className={cn("overflow-hidden", props.className)}>
      <CardHeader className="pb-3">
        <div className="text-sm font-semibold">{props.title}</div>
      </CardHeader>
      <CardContent className="pt-0">
        {props.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            {props.emptyMessage ?? "No related items."}
          </p>
        ) : (
          <ul className="space-y-1" aria-label={props.title}>
            {props.items.map((item) => (
              <li key={item.id}>
                {item.href ? (
                  <a
                    href={item.href}
                    className="text-sm text-primary underline-offset-4 hover:underline"
                  >
                    {item.label}
                  </a>
                ) : (
                  <Badge variant="secondary">{item.label}</Badge>
                )}
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
