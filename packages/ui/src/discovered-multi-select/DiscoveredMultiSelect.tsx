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

// @cloud-dog/ui — W28A-871 DiscoveredMultiSelect.

import * as React from 'react';
import { RefreshCw, X } from 'lucide-react';
import { Button } from '../components/button';
import { Checkbox } from '../components/input';
import { cn } from '../utils/cn';

export type DiscoveredOption = Readonly<{
  value: string;
  label?: string;
  stale?: boolean;
  disabled?: boolean;
}>;

export type DiscoveredMultiSelectProps = Readonly<{
  options: readonly DiscoveredOption[];
  values: readonly string[];
  onChange: (values: string[]) => void;
  label?: string;
  placeholder?: string;
  allowWildcard?: boolean;
  staleValues?: readonly string[];
  loading?: boolean;
  disabled?: boolean;
  mode?: 'multiple' | 'single';
  onRefresh?: () => void;
  className?: string;
  'aria-label'?: string;
}>;

export function DiscoveredMultiSelect({
  options,
  values,
  onChange,
  label,
  placeholder = 'No discovered values',
  allowWildcard = false,
  staleValues = [],
  loading = false,
  disabled = false,
  mode = 'multiple',
  onRefresh,
  className,
  'aria-label': ariaLabel,
}: DiscoveredMultiSelectProps) {
  const staleSet = React.useMemo(() => new Set(staleValues), [staleValues]);
  const optionMap = React.useMemo(
    () => new Map(options.map((option) => [option.value, option])),
    [options],
  );
  const effectiveOptions = React.useMemo(() => {
    const merged: DiscoveredOption[] = allowWildcard
      ? [{ value: '*', label: 'All discovered values' }]
      : [];
    merged.push(...options);
    for (const value of values) {
      if (!optionMap.has(value) && value !== '*') {
        merged.push({ value, label: value, stale: true });
      }
    }
    return merged;
  }, [allowWildcard, optionMap, options, values]);

  function setValue(value: string, checked: boolean) {
    if (mode === 'single') {
      onChange(checked ? [value] : []);
      return;
    }
    if (checked) {
      onChange(Array.from(new Set([...values, value])));
      return;
    }
    onChange(values.filter((item) => item !== value));
  }

  return (
    <div
      className={cn('space-y-2', className)}
      data-component="DiscoveredMultiSelect"
      data-testid="discovered-multiselect"
    >
      <div className="flex items-center justify-between gap-2">
        {label ? <span className="text-sm font-medium text-foreground">{label}</span> : <span />}
        {onRefresh ? (
          <Button
            aria-label="Refresh discovered values"
            data-testid="discovered-multiselect-refresh"
            disabled={disabled || loading}
            onClick={onRefresh}
            size="sm"
            type="button"
            variant="secondary"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            Refresh
          </Button>
        ) : null}
      </div>
      <div className="flex min-h-10 flex-wrap gap-1 rounded-md border border-input bg-background p-2">
        {values.length === 0 ? (
          <span className="text-sm text-muted-foreground">
            {loading ? 'Loading...' : placeholder}
          </span>
        ) : null}
        {values.map((value) => {
          const option = optionMap.get(value);
          const stale = Boolean(option?.stale || staleSet.has(value) || (!option && value !== '*'));
          const labelText = value === '*' ? 'All discovered values' : (option?.label ?? value);
          return (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-sm px-2 py-1 text-xs font-medium',
                stale
                  ? 'bg-muted text-muted-foreground line-through ring-1 ring-border'
                  : 'bg-primary/10 text-foreground',
              )}
              data-stale={stale ? 'true' : undefined}
              data-testid={`discovered-multiselect-selected-${value}`}
              key={value}
            >
              {labelText}
              {stale ? <span className="font-normal">(stale)</span> : null}
              <button
                aria-label={`Remove ${labelText}`}
                className="text-muted-foreground hover:text-foreground"
                disabled={disabled}
                onClick={() => onChange(values.filter((item) => item !== value))}
                type="button"
              >
                <X className="h-3 w-3" />
              </button>
            </span>
          );
        })}
      </div>
      <div
        aria-label={ariaLabel ?? label ?? 'Discovered values'}
        className="max-h-56 overflow-auto rounded-md border border-border"
        role={mode === 'single' ? 'radiogroup' : 'group'}
      >
        {effectiveOptions.length === 0 ? (
          <p className="px-3 py-2 text-sm text-muted-foreground">{placeholder}</p>
        ) : (
          effectiveOptions.map((option) => {
            const checked = values.includes(option.value);
            const stale = Boolean(option.stale || staleSet.has(option.value));
            return (
              <label
                className={cn(
                  'flex cursor-pointer items-center gap-2 px-3 py-2 text-sm',
                  stale && 'bg-muted/70 text-muted-foreground',
                  option.disabled && 'cursor-not-allowed opacity-50',
                )}
                data-stale={stale ? 'true' : undefined}
                data-testid={`discovered-multiselect-option-${option.value}`}
                key={option.value}
              >
                <Checkbox
                  checked={checked}
                  disabled={disabled || option.disabled}
                  onChange={(event) => setValue(option.value, event.target.checked)}
                  type={mode === 'single' ? 'radio' : 'checkbox'}
                />
                <span
                  data-testid={option.value === '*' ? 'discovered-multiselect-wildcard' : undefined}
                >
                  {option.label ?? option.value}
                </span>
              </label>
            );
          })
        )}
      </div>
    </div>
  );
}
