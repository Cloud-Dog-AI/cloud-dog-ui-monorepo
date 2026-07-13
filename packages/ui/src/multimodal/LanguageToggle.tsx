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

// @cloud-dog/ui — LanguageToggle (W28F-948): output-synthesis language selector.
//
// Reuses the shared Select + Label primitives. Emits the chosen `synthesise_in`
// language so subsequent research actions re-synthesise output in that language.

import * as React from "react";
import { cn } from "../utils/cn";
import { Select } from "../components/input/Select";
import { Label } from "../components/input/Label";
import { OUTPUT_LANGUAGE_LABELS } from "./types";
import type { OutputLanguage } from "./types";

export type LanguageToggleProps = Readonly<{
  /** Currently selected output language. */
  current: OutputLanguage;
  /** Called with the newly selected language. */
  onChange: (lang: OutputLanguage) => void;
  /** Languages to offer. Defaults to the full canonical set. */
  languages?: ReadonlyArray<OutputLanguage>;
  /** Visible label text. */
  label?: string;
  disabled?: boolean;
  dataTestId?: string;
  className?: string;
}>;

export const DEFAULT_OUTPUT_LANGUAGES: ReadonlyArray<OutputLanguage> = [
  "en",
  "de",
  "fr",
  "pl",
  "ja",
  "ar",
  "ru",
  "zh",
];

export function LanguageToggle(props: LanguageToggleProps) {
  const {
    current,
    onChange,
    languages = DEFAULT_OUTPUT_LANGUAGES,
    label = "Output language",
    disabled,
    dataTestId = "mm-language-toggle",
    className,
  } = props;
  const selectId = React.useId();

  return (
    <div data-testid={dataTestId} className={cn("flex items-center gap-2", className)}>
      <Label htmlFor={selectId} className="whitespace-nowrap text-xs text-muted-foreground">
        {label}
      </Label>
      <Select
        id={selectId}
        value={current}
        disabled={disabled}
        data-testid={`${dataTestId}-select`}
        aria-label={label}
        className="h-8 w-auto py-1 text-sm"
        onChange={(e) => onChange(e.target.value as OutputLanguage)}
      >
        {languages.map((lang) => (
          <option key={lang} value={lang}>
            {OUTPUT_LANGUAGE_LABELS[lang] ?? lang}
          </option>
        ))}
      </Select>
    </div>
  );
}
