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

// @cloud-dog/ui — W28A-871 ConnectionPicker.

import * as React from 'react';
import { Button } from '../components/button';
import { Select } from '../components/input';
import { StatusBadge } from '../components/layout';
import { cn } from '../utils/cn';

export type ConnectionPickerOption = Readonly<{
  name: string;
  label?: string;
  sourceType: string;
  status?: string;
  description?: string;
  disabled?: boolean;
}>;

export type ConnectionPickerTestResult = Readonly<{
  ok?: boolean;
  status?: string;
  message?: string;
  latencyMs?: number;
  lastTestedAt?: string;
}>;

export type ConnectionPickerProps = Readonly<{
  options: readonly ConnectionPickerOption[];
  value?: string;
  onChange: (connection: ConnectionPickerOption | null) => void;
  onTest?: (connection: ConnectionPickerOption) => void;
  testButton?: boolean;
  testButtonLabel?: string;
  testResult?: ConnectionPickerTestResult | null;
  id?: string;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
  loading?: boolean;
  error?: string;
  className?: string;
  'aria-label'?: string;
}>;

export function ConnectionPicker({
  options,
  value = '',
  onChange,
  onTest,
  testButton = false,
  testButtonLabel = 'Test connection',
  testResult,
  id,
  label,
  placeholder = 'Select source connection',
  disabled = false,
  loading = false,
  error,
  className,
  'aria-label': ariaLabel,
}: ConnectionPickerProps) {
  const selected = options.find((option) => option.name === value) ?? null;
  const shouldRenderTestButton = Boolean(testButton || onTest);
  const resultStatus =
    testResult?.status ??
    (testResult?.ok === true ? 'Healthy' : testResult?.ok === false ? 'Failing' : undefined);
  const resultMessage = [
    testResult?.message,
    testResult?.latencyMs != null ? `${testResult.latencyMs} ms` : null,
    testResult?.lastTestedAt,
  ]
    .filter(Boolean)
    .join(' - ');

  return (
    <div
      className={cn('space-y-2', className)}
      data-component="ConnectionPicker"
      data-testid="connection-picker"
    >
      {label ? (
        <label className="text-sm font-medium text-foreground" htmlFor={id}>
          {label}
        </label>
      ) : null}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <Select
          aria-invalid={Boolean(error)}
          aria-label={ariaLabel ?? label ?? 'Source connection'}
          className={error ? 'border-destructive' : undefined}
          disabled={disabled || loading}
          id={id}
          value={value}
          onChange={(event) => {
            const next = options.find((option) => option.name === event.target.value) ?? null;
            onChange(next);
          }}
        >
          <option value="">{loading ? 'Loading connections...' : placeholder}</option>
          {options.map((option) => (
            <option
              data-testid={`connection-picker-option-${option.name}`}
              key={option.name}
              disabled={option.disabled}
              value={option.name}
            >
              {option.label ?? option.name} ({option.sourceType})
            </option>
          ))}
        </Select>
        {shouldRenderTestButton ? (
          <Button
            data-testid="connection-picker-test-button"
            disabled={disabled || loading || !selected || !onTest}
            onClick={() => {
              if (selected) {
                onTest?.(selected);
              }
            }}
            size="sm"
            type="button"
            variant="secondary"
          >
            {testButtonLabel}
          </Button>
        ) : null}
      </div>
      {selected ? (
        <div
          className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
          data-testid="connection-picker-selected-meta"
        >
          <span className="rounded-sm bg-muted px-2 py-1 font-mono">{selected.sourceType}</span>
          {selected.status ? <StatusBadge value={selected.status} /> : null}
          {selected.description ? <span>{selected.description}</span> : null}
        </div>
      ) : null}
      {testResult ? (
        <div
          className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground"
          data-testid="connection-picker-test-result"
          role="status"
        >
          {resultStatus ? <StatusBadge value={resultStatus} /> : null}
          {resultMessage ? <span>{resultMessage}</span> : null}
        </div>
      ) : null}
      {error ? <p className="text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
