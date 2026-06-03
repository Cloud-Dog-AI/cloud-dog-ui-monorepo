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

// @cloud-dog/ui — ChatTimeline pattern (scroll-to-bottom container).

import * as React from "react";
import type { ChatRole } from "./ChatMessage";
import { ChatMessage } from "./ChatMessage";

export type TimelineMessage = Readonly<{
  id: string;
  role: ChatRole;
  content: string;
  timestamp?: string;
  footer?: React.ReactNode;
}>;

export type ChatTimelineProps = Readonly<{
  messages: TimelineMessage[];
  autoScroll?: boolean;
  className?: string;
}>;

export function ChatTimeline(props: ChatTimelineProps) {
  const autoScroll = props.autoScroll ?? true;
  const ref = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
    if (!autoScroll) return;
    const el = ref.current;
    if (!el) return;
    el.scrollTop = el.scrollHeight;
  }, [props.messages, autoScroll]);

  return (
    <div ref={ref} className={props.className ?? "h-full overflow-auto p-4 space-y-3"}>
      {props.messages.map((m) => (
        <ChatMessage
          key={m.id}
          role={m.role}
          content={m.content}
          timestamp={m.timestamp}
          footer={m.footer}
        />
      ))}
    </div>
  );
}
