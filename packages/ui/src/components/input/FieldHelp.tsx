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

// @cloud-dog/ui — PFW-1 FieldHelp form-field wrapper with label, help, and validation.

import * as React from "react";
import { cn } from "../../utils/cn";

export interface FieldHelpProps {
  /** Visible label text. */
  label: string;
  /** HTML id for the input element (links label via htmlFor). */
  htmlFor: string;
  /** Inline help text shown below the label. */
  help?: string;
  /** Validation error message. Replaces help text when present. */
  error?: string;
  /** Whether the field is required. Appends visual indicator. */
  required?: boolean;
  /** Extra className for the wrapper. */
  className?: string;
  children: React.ReactNode;
}

export function FieldHelp(props: FieldHelpProps) {
  const { label, htmlFor, help, error, required, className, children } = props;
  const descriptionId = `${htmlFor}-description`;
  const errorId = `${htmlFor}-error`;

  return (
    <div className={cn("space-y-1.5", className)}>
      <label
        htmlFor={htmlFor}
        className="text-sm font-medium leading-none"
      >
        {label}
        {required && (
          <span className="text-destructive ml-0.5" aria-hidden="true">
            *
          </span>
        )}
      </label>

      {React.Children.map(children, (child) => {
        if (!React.isValidElement(child)) return child;
        const extraProps: Record<string, string> = {};
        if (error) {
          extraProps["aria-invalid"] = "true";
          extraProps["aria-errormessage"] = errorId;
        }
        if (help && !error) {
          extraProps["aria-describedby"] = descriptionId;
        }
        return React.cloneElement(child as React.ReactElement<Record<string, unknown>>, extraProps);
      })}

      {error ? (
        <p
          id={errorId}
          role="alert"
          className="text-sm text-destructive"
          data-testid="field-error"
        >
          {error}
        </p>
      ) : help ? (
        <p
          id={descriptionId}
          className="text-sm text-muted-foreground"
          data-testid="field-help"
        >
          {help}
        </p>
      ) : null}
    </div>
  );
}
