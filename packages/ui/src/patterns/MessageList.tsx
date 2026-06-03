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

// @cloud-dog/ui — MessageList pattern (message/inbox list with bulk actions).

import * as React from "react";
import { Badge } from "../components/layout/Badge";
import { Checkbox } from "../components/input/Checkbox";
import { Button } from "../components/button/Button";
import { RelativeTime } from "./RelativeTime";
import { cn } from "../utils/cn";

export type MessageBulkAction = "mark-read" | "delete" | "archive";

export type MessageItem = Readonly<{
  id: string;
  subject: string;
  sender: string;
  preview: string;
  timestamp: string | number | Date;
  status: string;
  unread: boolean;
  attachmentCount?: number;
}>;

export type MessageListProps = Readonly<{
  messages: MessageItem[];
  selectedId?: string;
  onSelect: (id: string) => void;
  onBulkAction?: (action: MessageBulkAction, ids: string[]) => void;
  loading?: boolean;
  className?: string;
}>;

const BULK_ACTIONS: ReadonlyArray<Readonly<{ action: MessageBulkAction; label: string }>> = [
  { action: "mark-read", label: "Mark read" },
  { action: "archive", label: "Archive" },
  { action: "delete", label: "Delete" },
];

function badgeVariantForStatus(status: string): "default" | "secondary" | "destructive" {
  const normalized = status.trim().toLowerCase();
  if (["failed", "bounced", "deleted", "error"].includes(normalized)) {
    return "destructive";
  }
  if (["draft", "queued", "archived", "pending"].includes(normalized)) {
    return "secondary";
  }
  return "default";
}

export function MessageList(props: MessageListProps) {
  const [selectedIds, setSelectedIds] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    setSelectedIds((current) => {
      const validIds = new Set(props.messages.map((message) => message.id));
      const next = new Set([...current].filter((id) => validIds.has(id)));
      return next.size === current.size ? current : next;
    });
  }, [props.messages]);

  const allSelected = props.messages.length > 0 && props.messages.every((message) => selectedIds.has(message.id));

  const toggleSelection = (id: string, checked: boolean) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (checked) {
        next.add(id);
      } else {
        next.delete(id);
      }
      return next;
    });
  };

  const toggleAll = (checked: boolean) => {
    setSelectedIds(checked ? new Set(props.messages.map((message) => message.id)) : new Set());
  };

  const runBulkAction = (action: MessageBulkAction) => {
    if (!props.onBulkAction || selectedIds.size === 0) {
      return;
    }
    props.onBulkAction(action, [...selectedIds]);
  };

  return (
    <section className={cn("rounded-xl border bg-card text-card-foreground shadow-sm", props.className)}>
      <header className="flex flex-wrap items-center gap-2 border-b px-4 py-3">
        <div>
          <h2 className="text-sm font-semibold">Messages</h2>
          <p className="text-xs text-muted-foreground">
            {props.loading ? "Loading messages..." : `${props.messages.length} total`}
          </p>
        </div>
        {props.onBulkAction ? (
          <div className="ml-auto flex flex-wrap items-center gap-2">
            <label className="flex items-center gap-2 text-xs text-muted-foreground">
              <Checkbox
                checked={allSelected}
                onChange={(event) => toggleAll(event.currentTarget.checked)}
                aria-label="Select all messages"
              />
              Select all
            </label>
            {BULK_ACTIONS.map((item) => (
              <Button
                key={item.action}
                type="button"
                variant={item.action === "delete" ? "destructive" : "secondary"}
                size="sm"
                disabled={selectedIds.size === 0}
                onClick={() => runBulkAction(item.action)}
              >
                {item.label}
              </Button>
            ))}
          </div>
        ) : null}
      </header>

      <div className="divide-y">
        {props.loading ? (
          <div className="px-4 py-8 text-sm text-muted-foreground">Loading message list...</div>
        ) : props.messages.length === 0 ? (
          <div className="px-4 py-8 text-sm text-muted-foreground">No messages available.</div>
        ) : (
          props.messages.map((message) => {
            const active = props.selectedId === message.id;
            const bulkSelected = selectedIds.has(message.id);

            return (
              <article
                key={message.id}
                role="button"
                tabIndex={0}
                aria-pressed={active}
                className={cn(
                  "flex gap-3 px-4 py-3 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                  active ? "bg-primary/5" : "hover:bg-muted/40",
                )}
                onClick={() => props.onSelect(message.id)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    props.onSelect(message.id);
                  }
                }}
              >
                {props.onBulkAction ? (
                  <div className="pt-1">
                    <Checkbox
                      checked={bulkSelected}
                      aria-label={`Select message ${message.subject}`}
                      onClick={(event) => event.stopPropagation()}
                      onChange={(event) => toggleSelection(message.id, event.currentTarget.checked)}
                    />
                  </div>
                ) : null}

                <div
                  className={cn(
                    "mt-1 h-2.5 w-2.5 flex-none rounded-full",
                    message.unread ? "bg-primary" : "bg-transparent",
                  )}
                  aria-hidden="true"
                />

                <div className="min-w-0 flex-1 space-y-1">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p
                        className={cn(
                          "truncate text-sm",
                          message.unread ? "font-semibold text-foreground" : "font-medium text-foreground",
                        )}
                      >
                        {message.sender}
                      </p>
                      <p className="truncate text-sm text-foreground">{message.subject}</p>
                    </div>
                    <RelativeTime timestamp={message.timestamp} className="text-xs text-muted-foreground" />
                  </div>

                  <p className="line-clamp-2 text-sm text-muted-foreground">{message.preview}</p>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={badgeVariantForStatus(message.status)}>{message.status}</Badge>
                    {message.attachmentCount ? (
                      <Badge variant="secondary">
                        {message.attachmentCount} attachment{message.attachmentCount === 1 ? "" : "s"}
                      </Badge>
                    ) : null}
                    {message.unread ? <span className="text-xs font-medium text-primary">Unread</span> : null}
                  </div>
                </div>
              </article>
            );
          })
        )}
      </div>
    </section>
  );
}
