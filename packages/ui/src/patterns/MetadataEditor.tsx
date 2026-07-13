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

// @cloud-dog/ui — MetadataEditor pattern (W28E-1878 CC-18 / IR-39).
//
// A schema-aware editor for a metadata JSON object. Given a `schema` describing
// the known metadata keys (the "metadata standard"), it renders a typed form
// field per key (text/number/boolean/select) with per-field validation, plus an
// "additional keys" section for free-form metadata, plus a raw-JSON escape hatch
// (CodeEditor) for power users. It replaces the bespoke plain <textarea> + manual
// JSON.parse validation that services previously duplicated.

import * as React from "react";
import { cn } from "../utils/cn";
import { Button } from "../components/button/Button";
import { Input } from "../components/input/Input";
import { Label } from "../components/input/Label";
import { Select } from "../components/input/Select";
import { Switch } from "../components/input/Switch";
import { CodeEditor } from "./CodeEditor";

export type MetadataFieldType = "string" | "number" | "boolean" | "select";

/** One known metadata key — the schema the editor is bound to. */
export type MetadataFieldSpec = Readonly<{
  key: string;
  label?: string;
  type: MetadataFieldType;
  description?: string;
  required?: boolean;
  /** Allowed values for a `select` field. */
  options?: string[];
  placeholder?: string;
}>;

export type MetadataEditorProps = Readonly<{
  /** Current metadata value: a JSON object OR a JSON string. */
  value: Record<string, unknown> | string;
  /**
   * Emitted on every edit with the parsed object, the canonical JSON string, and
   * whether the current content is valid (parses AND satisfies the schema).
   */
  onChange: (next: Record<string, unknown>, json: string, valid: boolean) => void;
  /** Schema describing the known keys. Omit for a purely free-form editor. */
  schema?: MetadataFieldSpec[];
  /** Allow keys beyond the schema (default true). */
  allowAdditionalKeys?: boolean;
  ariaLabel?: string;
  readOnly?: boolean;
  className?: string;
  /** Prefix for field IDs to avoid collisions when several editors coexist. */
  idPrefix?: string;
  /** Height of the raw-JSON editor (default 200). */
  jsonHeight?: number | string;
}>;

type ParseResult = {
  obj: Record<string, unknown>;
  error: string | null;
};

function toText(value: Record<string, unknown> | string): string {
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value ?? {}, null, 2);
  } catch {
    return "{}";
  }
}

function parseMetadata(value: Record<string, unknown> | string): ParseResult {
  if (typeof value !== "string") {
    if (value && typeof value === "object" && !Array.isArray(value)) {
      return { obj: value as Record<string, unknown>, error: null };
    }
    return { obj: {}, error: "Metadata must be a JSON object." };
  }
  const trimmed = value.trim();
  if (trimmed === "") return { obj: {}, error: null };
  let parsed: unknown;
  try {
    parsed = JSON.parse(trimmed);
  } catch (err) {
    return { obj: {}, error: err instanceof Error ? err.message : "Invalid JSON." };
  }
  if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
    return { obj: {}, error: "Metadata must be a JSON object, not an array or scalar." };
  }
  return { obj: parsed as Record<string, unknown>, error: null };
}

function canonicalJson(obj: Record<string, unknown>): string {
  return JSON.stringify(obj, null, 2);
}

/** Schema-level validation → map of key → error message. */
function validateSchema(
  obj: Record<string, unknown>,
  schema: readonly MetadataFieldSpec[],
): Record<string, string> {
  const errors: Record<string, string> = {};
  for (const spec of schema) {
    const present = Object.prototype.hasOwnProperty.call(obj, spec.key);
    const raw = obj[spec.key];
    const empty = raw === undefined || raw === null || raw === "";
    if (spec.required && (!present || empty)) {
      errors[spec.key] = `${spec.label ?? spec.key} is required.`;
      continue;
    }
    if (empty) continue;
    if (spec.type === "number" && Number.isNaN(Number(raw))) {
      errors[spec.key] = `${spec.label ?? spec.key} must be a number.`;
    } else if (spec.type === "select" && spec.options && !spec.options.includes(String(raw))) {
      errors[spec.key] = `${spec.label ?? spec.key} must be one of: ${spec.options.join(", ")}.`;
    }
  }
  return errors;
}

export function MetadataEditor(props: MetadataEditorProps) {
  const schema = props.schema ?? [];
  const allowAdditional = props.allowAdditionalKeys ?? true;
  const idPrefix = props.idPrefix ?? "meta";
  const readOnly = props.readOnly ?? false;

  const { obj, error: parseError } = parseMetadata(props.value);
  const schemaErrors = React.useMemo(() => validateSchema(obj, schema), [obj, schema]);
  const [showRaw, setShowRaw] = React.useState<boolean>(false);
  const [newKey, setNewKey] = React.useState<string>("");

  const schemaKeys = React.useMemo(() => new Set(schema.map((s) => s.key)), [schema]);
  const additionalKeys = React.useMemo(
    () => Object.keys(obj).filter((k) => !schemaKeys.has(k)),
    [obj, schemaKeys],
  );

  // Any parse error forces the raw editor so the user can repair the JSON.
  const rawActive = showRaw || parseError !== null;

  const emit = React.useCallback(
    (nextObj: Record<string, unknown>) => {
      const json = canonicalJson(nextObj);
      const valid = Object.keys(validateSchema(nextObj, schema)).length === 0;
      props.onChange(nextObj, json, valid);
    },
    [props, schema],
  );

  const emitRaw = React.useCallback(
    (text: string) => {
      const parsed = parseMetadata(text);
      const valid = parsed.error === null && Object.keys(validateSchema(parsed.obj, schema)).length === 0;
      // Pass the raw text through so intermediate invalid JSON is preserved.
      props.onChange(parsed.obj, text, valid);
    },
    [props, schema],
  );

  const setField = React.useCallback(
    (key: string, value: unknown) => {
      const next = { ...obj };
      if (value === undefined) delete next[key];
      else next[key] = value;
      emit(next);
    },
    [obj, emit],
  );

  const addAdditional = React.useCallback(() => {
    const key = newKey.trim();
    if (!key || Object.prototype.hasOwnProperty.call(obj, key)) return;
    emit({ ...obj, [key]: "" });
    setNewKey("");
  }, [newKey, obj, emit]);

  return (
    <div
      className={cn("space-y-3", props.className)}
      data-testid="metadata-editor"
      data-cc-18="schema-aware"
      role="group"
      aria-label={props.ariaLabel ?? "Metadata editor"}
    >
      {/* Header: mode toggle + validity summary. */}
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs text-muted-foreground">
          {schema.length > 0 ? `Schema-aware · ${schema.length} known field${schema.length === 1 ? "" : "s"}` : "Free-form metadata"}
        </span>
        <Button
          type="button"
          variant="secondary"
          onClick={() => setShowRaw((s) => !s)}
          disabled={parseError !== null && showRaw}
          aria-pressed={rawActive}
          data-testid="metadata-editor-toggle"
        >
          {rawActive ? "Form view" : "JSON view"}
        </Button>
      </div>

      {parseError ? (
        <p className="text-xs text-destructive" role="alert" data-testid="metadata-editor-parse-error">
          {parseError}
        </p>
      ) : null}

      {rawActive ? (
        <CodeEditor
          ariaLabel={props.ariaLabel ?? "Metadata JSON"}
          language="json"
          height={props.jsonHeight ?? 200}
          readOnly={readOnly}
          value={toText(props.value)}
          onChange={(text) => emitRaw(text)}
        />
      ) : (
        <div className="space-y-3">
          {/* Known (schema) fields. */}
          {schema.map((spec) => {
            const fieldId = `${idPrefix}-meta-${spec.key}`;
            const err = schemaErrors[spec.key];
            const raw = obj[spec.key];
            return (
              <div key={spec.key} className="space-y-1" data-testid="metadata-field" data-meta-key={spec.key}>
                <Label htmlFor={fieldId}>
                  {spec.label ?? spec.key}
                  {spec.required ? <span aria-hidden="true" className="text-destructive ml-1">*</span> : null}
                </Label>
                {spec.type === "boolean" ? (
                  <div className="pt-1">
                    <Switch
                      id={fieldId}
                      checked={Boolean(raw)}
                      onCheckedChange={(v) => setField(spec.key, v)}
                      disabled={readOnly}
                      aria-label={spec.label ?? spec.key}
                    />
                  </div>
                ) : spec.type === "select" ? (
                  <Select
                    id={fieldId}
                    value={raw === undefined || raw === null ? "" : String(raw)}
                    onChange={(e) => setField(spec.key, e.target.value === "" ? undefined : e.target.value)}
                    disabled={readOnly}
                    aria-label={spec.label ?? spec.key}
                    aria-invalid={!!err}
                  >
                    <option value="">-- select --</option>
                    {(spec.options ?? []).map((opt) => (
                      <option key={opt} value={opt}>{opt}</option>
                    ))}
                  </Select>
                ) : (
                  <Input
                    id={fieldId}
                    type={spec.type === "number" ? "number" : "text"}
                    value={raw === undefined || raw === null ? "" : String(raw)}
                    placeholder={spec.placeholder}
                    onChange={(e) => {
                      const v = e.target.value;
                      if (v === "") { setField(spec.key, undefined); return; }
                      setField(spec.key, spec.type === "number" ? Number(v) : v);
                    }}
                    disabled={readOnly}
                    aria-label={spec.label ?? spec.key}
                    aria-invalid={!!err}
                  />
                )}
                {spec.description ? <p className="text-xs text-muted-foreground">{spec.description}</p> : null}
                {err ? <p className="text-xs text-destructive" role="alert">{err}</p> : null}
              </div>
            );
          })}

          {/* Additional (free-form) keys. */}
          {allowAdditional ? (
            <div className="space-y-2" data-testid="metadata-additional">
              {additionalKeys.length > 0 ? (
                <p className="text-xs font-medium text-muted-foreground">Additional metadata</p>
              ) : null}
              {additionalKeys.map((key) => {
                const fieldId = `${idPrefix}-meta-extra-${key}`;
                const raw = obj[key];
                const display = typeof raw === "string" ? raw : JSON.stringify(raw);
                return (
                  <div key={key} className="flex items-end gap-2" data-testid="metadata-extra-row" data-meta-key={key}>
                    <div className="flex-1 space-y-1">
                      <Label htmlFor={fieldId}>{key}</Label>
                      <Input
                        id={fieldId}
                        value={display}
                        onChange={(e) => setField(key, e.target.value)}
                        disabled={readOnly}
                        aria-label={`${key} value`}
                      />
                    </div>
                    {!readOnly ? (
                      <Button
                        type="button"
                        variant="secondary"
                        onClick={() => setField(key, undefined)}
                        aria-label={`Remove ${key}`}
                        data-testid="metadata-extra-remove"
                      >
                        Remove
                      </Button>
                    ) : null}
                  </div>
                );
              })}
              {!readOnly ? (
                <div className="flex items-end gap-2">
                  <div className="flex-1 space-y-1">
                    <Label htmlFor={`${idPrefix}-meta-newkey`}>Add field</Label>
                    <Input
                      id={`${idPrefix}-meta-newkey`}
                      value={newKey}
                      placeholder="key name"
                      onChange={(e) => setNewKey(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); addAdditional(); }
                      }}
                      aria-label="New metadata key"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={addAdditional}
                    disabled={newKey.trim() === "" || Object.prototype.hasOwnProperty.call(obj, newKey.trim())}
                    data-testid="metadata-add"
                  >
                    Add
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      )}
    </div>
  );
}
