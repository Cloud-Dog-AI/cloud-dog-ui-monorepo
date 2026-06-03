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

// @cloud-dog/ui — Combobox: searchable single-select with optional custom input.

import * as React from "react";
import { cn } from "../../utils/cn";

export type ComboboxOption = Readonly<{
  value: string;
  label: string;
  disabled?: boolean;
}>;

export type ComboboxProps = Readonly<{
  options: ComboboxOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  allowCustom?: boolean;
  disabled?: boolean;
  error?: string;
  "aria-label"?: string;
  className?: string;
  loading?: boolean;
  emptyMessage?: string;
}>;

export function Combobox(props: ComboboxProps) {
  const {
    options,
    value,
    onChange,
    placeholder = "Select or type...",
    allowCustom = false,
    disabled = false,
    error,
    loading = false,
    emptyMessage = "No options found.",
    className,
  } = props;

  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState("");
  const inputRef = React.useRef<HTMLInputElement>(null);
  const listRef = React.useRef<HTMLUListElement>(null);
  const containerRef = React.useRef<HTMLDivElement>(null);
  const [activeIndex, setActiveIndex] = React.useState(-1);

  const filtered = React.useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter(
      (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
    );
  }, [options, query]);

  const selectedLabel = options.find((o) => o.value === value)?.label ?? value;

  React.useEffect(() => {
    if (!open) return;
    function handleClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [open]);

  function handleSelect(optValue: string) {
    onChange(optValue);
    setQuery("");
    setOpen(false);
    setActiveIndex(-1);
  }

  function handleKeyDown(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && open) {
      e.preventDefault();
      if (activeIndex >= 0 && activeIndex < filtered.length) {
        handleSelect(filtered[activeIndex].value);
      } else if (allowCustom && query.trim()) {
        handleSelect(query.trim());
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setActiveIndex(-1);
    }
  }

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <input
        ref={inputRef}
        type="text"
        role="combobox"
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={props["aria-label"]}
        aria-invalid={!!error}
        disabled={disabled}
        placeholder={placeholder}
        value={open ? query : selectedLabel}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => {
          setOpen(true);
          setQuery("");
        }}
        onKeyDown={handleKeyDown}
        className={cn(
          "flex h-10 w-full rounded-md border bg-background px-3 py-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
          error ? "border-destructive" : "border-input",
        )}
      />
      {open && (
        <ul
          ref={listRef}
          role="listbox"
          className="absolute z-50 mt-1 max-h-60 w-full overflow-auto rounded-md border border-input bg-popover p-1 shadow-md"
        >
          {loading ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">Loading...</li>
          ) : filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-muted-foreground">{emptyMessage}</li>
          ) : (
            filtered.map((opt, i) => (
              <li
                key={opt.value}
                role="option"
                aria-selected={opt.value === value}
                aria-disabled={opt.disabled}
                data-active={i === activeIndex || undefined}
                className={cn(
                  "cursor-pointer rounded-sm px-3 py-2 text-sm",
                  opt.value === value && "bg-primary/10 font-medium",
                  i === activeIndex && "bg-muted",
                  opt.disabled && "cursor-not-allowed opacity-50",
                )}
                onMouseDown={(e) => {
                  e.preventDefault();
                  if (!opt.disabled) handleSelect(opt.value);
                }}
                onMouseEnter={() => setActiveIndex(i)}
              >
                {opt.label}
              </li>
            ))
          )}
        </ul>
      )}
      {error ? <p className="mt-1 text-xs text-destructive">{error}</p> : null}
    </div>
  );
}
