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

// @cloud-dog/ui — A2aConsole pattern (A2A WebSocket test console).

import * as React from "react";
import { cn } from "../utils/cn";
import { Button } from "../components/button/Button";
import { Input } from "../components/input/Input";
import { Select } from "../components/input/Select";
import { Textarea } from "../components/input/Textarea";
import { JsonBlock } from "./JsonBlock";

type HistoryEntry = Readonly<{
  id: string;
  topic: string;
  payload: unknown;
  result: unknown;
  timestamp: string;
}>;

export type A2aConsoleProps = Readonly<{
  endpointUrl: string;
  onSend: (topic: string, payload: unknown) => Promise<unknown>;
  topics?: readonly string[];
  className?: string;
}>;

export function A2aConsole(props: A2aConsoleProps) {
  const [topic, setTopic] = React.useState("");
  const [payloadText, setPayloadText] = React.useState("{}");
  const [sending, setSending] = React.useState(false);
  const [history, setHistory] = React.useState<HistoryEntry[]>([]);

  const send = async () => {
    if (!topic.trim()) return;
    let parsed: unknown;
    try {
      parsed = JSON.parse(payloadText);
    } catch {
      return;
    }
    setSending(true);
    try {
      const result = await props.onSend(topic, parsed);
      setHistory((h) => [
        { id: crypto.randomUUID(), topic, payload: parsed, result, timestamp: new Date().toISOString() },
        ...h,
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className={cn("space-y-4 rounded-md border bg-background p-4", props.className)}>
      <div className="text-xs text-muted-foreground">{props.endpointUrl}</div>

      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Topic
      </label>
      {props.topics && props.topics.length > 0 ? (
        <Select value={topic} onChange={(e) => setTopic(e.target.value)} aria-label="Topic">
          <option value="">Select a topic…</option>
          {props.topics.map((t) => <option key={t} value={t}>{t}</option>)}
        </Select>
      ) : (
        <Input
          value={topic}
          onChange={(e) => setTopic(e.target.value)}
          placeholder='e.g. "root", "health", or a skill name from the agent card'
          aria-label="Topic"
        />
      )}

      <label className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        Parameters (JSON)
      </label>
      <Textarea
        value={payloadText}
        onChange={(e) => setPayloadText(e.target.value)}
        placeholder='{"key": "value"}'
        className="font-mono text-xs"
        aria-label="Payload JSON"
        rows={5}
      />

      <Button onClick={send} disabled={sending || !topic.trim()}>
        {sending ? "Sending..." : "Send"}
      </Button>

      {history.length > 0 ? (
        <div className="space-y-3">
          <div className="text-sm font-semibold">Response History</div>
          {history.map((entry) => (
            <JsonBlock
              key={entry.id}
              title={`Result: ${entry.topic} @ ${entry.timestamp}`}
              value={entry.result}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
