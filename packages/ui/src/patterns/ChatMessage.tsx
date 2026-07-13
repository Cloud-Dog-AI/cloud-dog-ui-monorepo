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

// @cloud-dog/ui — ChatMessage pattern (role variants; safe markdown-ish rendering).

import * as React from "react";
import { cn } from "../utils/cn";
import { RelativeTime } from "./RelativeTime";

export type ChatRole = "user" | "assistant" | "system" | "tool";

export type ChatMessageProps = Readonly<{
  role: ChatRole;
  content: string;
  timestamp?: string;
  footer?: React.ReactNode;
  className?: string;
  /**
   * Optional human display name shown in the message header instead of the raw
   * role. Callers pass the logged-in user's name for their own messages so the
   * header reads e.g. "Ada Lovelace" rather than "USER" (CL-25, W28E-1876).
   * Falls back to the role when absent.
   */
  displayName?: string;
}>;

function renderContent(content: string): React.ReactNode {
  // Intentionally safe: render text with basic code-fence handling only.
  const parts: React.ReactNode[] = [];
  const lines = content.split("\n");
  let inCode = false;
  let buf: string[] = [];

  const flush = (asCode: boolean) => {
    const text = buf.join("\n");
    buf = [];
    if (!text) return;
    parts.push(
      asCode ? (
        <pre
          key={parts.length}
          className="bg-muted/20 border rounded-md p-3 overflow-auto text-xs font-mono"
        >
          {text}
        </pre>
      ) : (
        <p key={parts.length} className="whitespace-pre-wrap text-sm leading-6">
          {text}
        </p>
      )
    );
  };

  for (const line of lines) {
    if (line.trim().startsWith("```")) {
      flush(inCode);
      inCode = !inCode;
      continue;
    }
    buf.push(line);
  }
  flush(inCode);

  return <div className="space-y-2">{parts}</div>;
}

export function ChatMessage(props: ChatMessageProps) {
  const isUser = props.role === "user";
  const bubble =
    props.role === "assistant"
      ? "bg-card"
      : props.role === "system"
      ? "bg-muted/30"
      : props.role === "tool"
      ? "bg-accent/20"
      : "bg-primary text-primary-foreground";

  const align = isUser ? "justify-end" : "justify-start";

  return (
    <div className={cn("flex", align, props.className)}>
      <article
        className={cn(
          "max-w-[42rem] w-fit rounded-xl border px-4 py-3 shadow-sm",
          bubble
        )}
        aria-label={`Message from ${props.role}`}
      >
        <div className="flex items-baseline gap-2 mb-2">
          <span
            className={cn(
              "text-xs font-semibold uppercase tracking-wide",
              isUser ? "text-primary-foreground" : "opacity-80"
            )}
          >
            {props.displayName && props.displayName.trim() ? props.displayName : props.role}
          </span>
          {props.timestamp ? (
            <RelativeTime
              timestamp={props.timestamp}
              className={cn(
                "text-xs",
                isUser ? "text-primary-foreground" : "text-muted-foreground"
              )}
            />
          ) : null}
        </div>
        {renderContent(props.content)}
        {props.footer ? <div className="mt-2">{props.footer}</div> : null}
      </article>
    </div>
  );
}
