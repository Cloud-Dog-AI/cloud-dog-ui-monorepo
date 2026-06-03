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

// @cloud-dog/ui — ComposeDialog pattern (message authoring on top of EntityDialog).

import * as React from "react";
import { Button } from "../components/button/Button";
import { Input } from "../components/input/Input";
import { Label } from "../components/input/Label";
import { Select } from "../components/input/Select";
import { Textarea } from "../components/input/Textarea";
import { FileDropZone } from "./FileDropZone";
import { EntityDialog } from "./EntityDialog";

export type ComposeChannelOption = Readonly<{
  value: string;
  label: string;
}>;

export type ComposeTemplate = Readonly<{
  id: string;
  label: string;
  subject?: string;
  body?: string;
  channel?: string;
}>;

export type ComposedMessage = Readonly<{
  to: string;
  subject: string;
  channel: string;
  templateId?: string;
  body: string;
  attachments: File[];
}>;

export type ComposeDialogProps = Readonly<{
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSend: (message: ComposedMessage) => void | Promise<void>;
  channels?: Array<string | ComposeChannelOption>;
  templates?: Array<string | ComposeTemplate>;
  defaultChannel?: string;
}>;

const DEFAULT_CHANNELS: ComposeChannelOption[] = [
  { value: "email", label: "Email" },
];

function normalizeChannel(channel: string | ComposeChannelOption): ComposeChannelOption {
  return typeof channel === "string" ? { value: channel, label: channel } : channel;
}

function normalizeTemplate(template: string | ComposeTemplate): ComposeTemplate {
  return typeof template === "string" ? { id: template, label: template } : template;
}

export function ComposeDialog(props: ComposeDialogProps) {
  const channels = React.useMemo(
    () => (props.channels?.length ? props.channels.map(normalizeChannel) : DEFAULT_CHANNELS),
    [props.channels],
  );
  const templates = React.useMemo(
    () => props.templates?.map(normalizeTemplate) ?? [],
    [props.templates],
  );

  const [to, setTo] = React.useState("");
  const [subject, setSubject] = React.useState("");
  const [channel, setChannel] = React.useState(props.defaultChannel ?? channels[0]?.value ?? "email");
  const [templateId, setTemplateId] = React.useState("");
  const [body, setBody] = React.useState("");
  const [attachments, setAttachments] = React.useState<File[]>([]);
  const [sending, setSending] = React.useState(false);

  React.useEffect(() => {
    if (!props.open) {
      return;
    }
    setChannel(props.defaultChannel ?? channels[0]?.value ?? "email");
  }, [channels, props.defaultChannel, props.open]);

  const applyTemplate = (nextTemplateId: string) => {
    setTemplateId(nextTemplateId);
    const template = templates.find((item) => item.id === nextTemplateId);
    if (!template) {
      return;
    }
    if (template.subject) {
      setSubject(template.subject);
    }
    if (template.body) {
      setBody(template.body);
    }
    if (template.channel) {
      setChannel(template.channel);
    }
  };

  const handleSend = async () => {
    setSending(true);
    try {
      await props.onSend({
        to,
        subject,
        channel,
        templateId: templateId || undefined,
        body,
        attachments,
      });
      setTo("");
      setSubject("");
      setTemplateId("");
      setBody("");
      setAttachments([]);
      props.onOpenChange(false);
    } finally {
      setSending(false);
    }
  };

  return (
    <EntityDialog
      open={props.open}
      onOpenChange={props.onOpenChange}
      title="Compose Message"
      body={
        <form
          className="space-y-4"
          onSubmit={(event) => {
            event.preventDefault();
            void handleSend();
          }}
        >
          <div className="grid gap-4 md:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="compose-channel">Channel</Label>
              <Select
                id="compose-channel"
                value={channel}
                onChange={(event) => setChannel(event.target.value)}
                aria-label="Message channel"
              >
                {channels.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </div>

            <div className="space-y-1">
              <Label htmlFor="compose-template">Template</Label>
              <Select
                id="compose-template"
                value={templateId}
                onChange={(event) => applyTemplate(event.target.value)}
                aria-label="Message template"
              >
                <option value="">No template</option>
                {templates.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.label}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="compose-recipient">To</Label>
            <Input
              id="compose-recipient"
              value={to}
              onChange={(event) => setTo(event.target.value)}
              placeholder="user@example.com"
              aria-label="Recipient"
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="compose-subject">Subject</Label>
            <Input
              id="compose-subject"
              value={subject}
              onChange={(event) => setSubject(event.target.value)}
              placeholder="Message subject"
              aria-label="Subject"
              required
            />
          </div>

          <div className="space-y-1">
            <Label htmlFor="compose-body">Body</Label>
            <Textarea
              id="compose-body"
              value={body}
              onChange={(event) => setBody(event.target.value)}
              placeholder="Write your message..."
              aria-label="Message body"
              className="min-h-40"
              required
            />
          </div>

          <div className="space-y-3">
            <div className="space-y-1">
              <Label>Attachments</Label>
              <FileDropZone
                onDrop={(files) => setAttachments((current) => [...current, ...files])}
                className="p-4"
              />
            </div>

            {attachments.length ? (
              <ul className="space-y-2 rounded-md border bg-muted/20 p-3 text-sm">
                {attachments.map((file, index) => (
                  <li key={`${file.name}-${file.size}-${index}`} className="flex items-center justify-between gap-3">
                    <span className="min-w-0 truncate">
                      {file.name} ({Math.max(1, Math.round(file.size / 1024))} KB)
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => setAttachments((current) => current.filter((_, itemIndex) => itemIndex !== index))}
                    >
                      Remove
                    </Button>
                  </li>
                ))}
              </ul>
            ) : null}
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <Button type="button" variant="secondary" onClick={() => props.onOpenChange(false)} disabled={sending}>
              Cancel
            </Button>
            <Button type="submit" loading={sending}>
              Send Message
            </Button>
          </div>
        </form>
      }
    />
  );
}
