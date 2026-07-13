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

// @cloud-dog/ui — RelativeTime pattern (live-updating relative timestamp).

import * as React from "react";
import { cn } from "../utils/cn";
import { formatRelativeTime } from "../utils/formatRelativeTime";

export type RelativeTimeProps = Readonly<{
  timestamp: string | Date | number;
  className?: string;
}>;

function toDate(value: string | Date | number): Date {
  if (value instanceof Date) return value;
  return new Date(value);
}

export function RelativeTime(props: RelativeTimeProps) {
  const date = React.useMemo(() => toDate(props.timestamp), [props.timestamp]);
  const [text, setText] = React.useState(() => formatRelativeTime(date));

  React.useEffect(() => {
    // Update immediately in case timestamp prop changed.
    setText(formatRelativeTime(date));

    const id = window.setInterval(() => {
      setText(formatRelativeTime(date));
    }, 60_000);

    return () => window.clearInterval(id);
  }, [date]);

  return (
    <time
      data-testid="relative-time"
      dateTime={date.toISOString()}
      title={date.toISOString()}
      className={cn(props.className ?? "text-sm text-muted-foreground")}
    >
      {text}
    </time>
  );
}
