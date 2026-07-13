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

// @cloud-dog/ui — PromptEditor pattern (CRUD form for a prompt template).
//
// Presentation-only: data fetching and persistence stay at the app level.
// The host owns `values` and reacts to `onChange`/`onSave`/`onCancel`.
// Built on top of the shared EntityForm pattern.

import * as React from "react";
import { EntityForm } from "./EntityForm";
import type { EntityFieldDef, EntityFormMode } from "./EntityForm";

/** Shape of a prompt template managed by the editor. */
export type PromptTemplateValues = Readonly<{
  name: string;
  description: string;
  /** Free-form tags applied to the template. */
  tags: string[];
  /** The prompt body / template text (supports `{{variable}}` placeholders). */
  body: string;
  /** Declared variables the body interpolates. */
  variables: string[];
}>;

/** Canonical field names the editor always renders, in order. */
const CANONICAL_FIELD_NAMES: ReadonlyArray<keyof PromptTemplateValues> = [
  "name",
  "description",
  "tags",
  "body",
  "variables",
];

export type PromptEditorProps = Readonly<{
  /** Current field values. The host owns this state (presentation-only). */
  values: PromptTemplateValues;
  /** Fired with the changed canonical field name and its new value. */
  onChange: (name: keyof PromptTemplateValues, value: unknown) => void;
  /** Fired when the form is submitted (save). */
  onSave: () => void;
  /** Fired when the user cancels. */
  onCancel: () => void;
  /** add | edit | view. Defaults to "edit". */
  mode?: EntityFormMode;
  /** Per-field validation errors keyed by canonical or extra field name. */
  errors?: Partial<Record<keyof PromptTemplateValues, string>> & Record<string, string>;
  /** Options offered for the tags multiselect. */
  tagOptions?: string[];
  /** Options offered for the variables multiselect. */
  variableOptions?: string[];
  /** Override the submit button label (default: "Save"). */
  submitLabel?: string;
  /**
   * PS-WEBUI-STYLE-COMPONENTS §10.8 no-loss extension point. Additive
   * service-domain fields appended AFTER the canonical name/description/tags/
   * body/variables set, rendered inside the form before the footer. Services
   * preserve domain fields (channel type, language, expert binding, runtime,
   * corpus, etc.) here instead of forking the shared component.
   */
  extraFields?: EntityFieldDef[];
  /** Values for `extraFields`, merged into the form values by field name. */
  extraValues?: Record<string, unknown>;
  /** Fired when an `extraFields` value changes (canonical changes use onChange). */
  onExtraChange?: (name: string, value: unknown) => void;
  /**
   * Supplementary domain UI rendered after the form inside the editor wrapper
   * (e.g. PromptVersionPicker, PromptTestRunner, a variable picker, or a
   * validation-result panel). No-loss extension point (§10.8).
   */
  children?: React.ReactNode;
  className?: string;
}>;

/**
 * CRUD form for a prompt template. Thin, opinionated wrapper over EntityForm
 * that fixes the canonical field set (name / description / tags / body /
 * variables) so prompt-engineering surfaces across the platform stay
 * consistent, with an additive `extraFields`/`children` extension point
 * (PS-WEBUI-STYLE-COMPONENTS §10.8) for service-domain fields and panels.
 */
export function PromptEditor(props: PromptEditorProps) {
  const {
    values,
    onChange,
    onSave,
    onCancel,
    mode = "edit",
    errors,
    tagOptions = [],
    variableOptions = [],
    submitLabel,
    extraFields = [],
    extraValues,
    onExtraChange,
    children,
    className,
  } = props;

  // Tag/variable options must include any currently-selected values so the
  // multiselect can render them even when the host did not pre-seed options.
  const mergedTagOptions = React.useMemo(
    () => Array.from(new Set([...tagOptions, ...values.tags])),
    [tagOptions, values.tags],
  );
  const mergedVariableOptions = React.useMemo(
    () => Array.from(new Set([...variableOptions, ...values.variables])),
    [variableOptions, values.variables],
  );

  const fields: EntityFieldDef[] = React.useMemo(
    () => [
      { name: "name", label: "Name", type: "text", required: true, placeholder: "my-prompt" },
      { name: "description", label: "Description", type: "text", placeholder: "What this prompt does" },
      { name: "tags", label: "Tags", type: "multiselect", options: mergedTagOptions },
      {
        name: "body",
        label: "Body",
        type: "textarea",
        required: true,
        rows: 10,
        placeholder: "You are a helpful assistant. {{question}}",
      },
      { name: "variables", label: "Variables", type: "multiselect", options: mergedVariableOptions },
      ...extraFields,
    ],
    [mergedTagOptions, mergedVariableOptions, extraFields],
  );

  // Canonical field values + any extra-field values, in one record for EntityForm.
  const mergedValues = React.useMemo(
    () => ({ ...(values as unknown as Record<string, unknown>), ...(extraValues ?? {}) }),
    [values, extraValues],
  );

  const isCanonical = (name: string): name is keyof PromptTemplateValues =>
    (CANONICAL_FIELD_NAMES as ReadonlyArray<string>).includes(name);

  return (
    <div className={className} data-testid="prompt-editor">
      <EntityForm
        idPrefix="prompt"
        fields={fields}
        values={mergedValues}
        onChange={(name, value) => {
          if (isCanonical(name)) onChange(name, value);
          else onExtraChange?.(name, value);
        }}
        onSubmit={onSave}
        onCancel={onCancel}
        mode={mode}
        errors={errors as Record<string, string> | undefined}
        submitLabel={submitLabel}
      />
      {children}
    </div>
  );
}
