// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
//
// Storybook demo for the W28E-1852 prompts/templates/message-assets family
// (PS-WEBUI-STYLE-COMPONENTS section 10): PromptEditor with the additive
// §10.8 no-loss extension point (extraFields + children) composed with
// PromptVersionPicker and PromptTestRunner.

import * as React from "react";
import { PromptEditor } from "../src/patterns/PromptEditor";
import type { PromptTemplateValues } from "../src/patterns/PromptEditor";
import type { EntityFieldDef } from "../src/patterns/EntityForm";
import { PromptVersionPicker } from "../src/patterns/PromptVersionPicker";
import { PromptTestRunner } from "../src/patterns/PromptTestRunner";

export default { title: "W28E-1852/PromptEditor", component: PromptEditor };

const seed: PromptTemplateValues = {
  name: "welcome-email",
  description: "Greets a new user",
  tags: ["onboarding"],
  body: "Hello {{name}}, welcome to {{product}}.",
  variables: ["name", "product"],
};

export const Default = {
  args: {
    values: seed,
    onChange: () => undefined,
    onSave: () => undefined,
    onCancel: () => undefined,
    submitLabel: "Save Prompt",
  },
};

// §10.8 no-loss extension: service-domain fields via extraFields + supplementary
// version/test panels via children. Stateful render so edits are visible.
export const WithDomainExtensionAndPanels = {
  render: () => {
    const [values, setValues] = React.useState<PromptTemplateValues>(seed);
    const [extra, setExtra] = React.useState<Record<string, unknown>>({
      channel_type: "email",
      language: "en",
    });
    const extraFields: EntityFieldDef[] = [
      { name: "channel_type", label: "Channel type", type: "select", options: ["email", "sms", "slack"] },
      { name: "language", label: "Language", type: "select", options: ["en", "fr", "de"] },
      { name: "priority", label: "Priority", type: "number" },
    ];
    return (
      <div className="max-w-2xl space-y-6 p-4">
        <PromptEditor
          values={values}
          onChange={(name, value) => setValues((v) => ({ ...v, [name]: value }))}
          onSave={() => undefined}
          onCancel={() => undefined}
          submitLabel="Save Prompt"
          extraFields={extraFields}
          extraValues={extra}
          onExtraChange={(name, value) => setExtra((e) => ({ ...e, [name]: value }))}
        >
          <PromptVersionPicker
            versions={[
              { id: "v3", label: "v3 — adds few-shot", createdAt: "2026-06-01", author: "ops" },
              { id: "v2", label: "v2", createdAt: "2026-05-10" },
            ]}
            selectedVersion="v3"
            pinnedVersion="v2"
            onSelect={() => undefined}
            onPinToggle={() => undefined}
          />
          <PromptTestRunner
            cases={[
              { id: "c1", name: "greets by name", input: "name=Ada", expected: "Hello Ada" },
              { id: "c2", name: "includes product", input: "product=Cloud-Dog" },
            ]}
            results={[{ caseId: "c1", status: "pass", duration: "0.4s" }]}
            onRun={() => undefined}
            onRunAll={() => undefined}
          />
        </PromptEditor>
      </div>
    );
  },
};
