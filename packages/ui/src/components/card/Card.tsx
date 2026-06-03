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

// @cloud-dog/ui — Card composition components.

import * as React from "react";
import { cn } from "../../utils/cn";

export function Card(props: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      {...props}
      className={cn("rounded-xl border bg-card text-card-foreground shadow-sm", props.className)}
    />
  );
}

export function CardHeader(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("p-6 pb-0", props.className)} />;
}

export function CardContent(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("p-6", props.className)} />;
}

export function CardFooter(props: React.HTMLAttributes<HTMLDivElement>) {
  return <div {...props} className={cn("p-6 pt-0", props.className)} />;
}
