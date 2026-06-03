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

import * as React from "react";
import Editor from "@monaco-editor/react";
import { Alert } from "../components/feedback/Alert";
import { cn } from "../utils/cn";
import { maskText, toMonacoLanguage, useCloudDogMonacoTheme, type CodeLanguage } from "./codeShared";

export interface CodeEditorProps {
  value: string;
  onChange?: (value: string) => void;
  language: CodeLanguage;
  ariaLabel?: string;
  readOnly?: boolean;
  height?: string | number;
  minimap?: boolean;
  lineNumbers?: boolean;
  maskPatterns?: RegExp[];
  className?: string;
}

function getJsonParseError(value: string) {
  try {
    JSON.parse(value);
    return null;
  } catch (error) {
    return error instanceof Error ? error.message : "Invalid JSON";
  }
}

export function CodeEditor({
  value,
  onChange,
  language,
  ariaLabel,
  readOnly = false,
  height = 320,
  minimap = false,
  lineNumbers = true,
  maskPatterns,
  className,
}: CodeEditorProps) {
  const theme = useCloudDogMonacoTheme();
  const maskedValue = React.useMemo(() => maskText(value, maskPatterns), [maskPatterns, value]);
  const jsonError = React.useMemo(() => {
    if (language !== "json") {
      return null;
    }
    return getJsonParseError(value);
  }, [language, value]);

  return (
    <div className={cn("space-y-3", className)}>
      <div className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
        <Editor
          height={height}
          language={toMonacoLanguage(language)}
          theme={theme}
          value={maskedValue}
          onChange={(next) => {
            if (readOnly || !onChange) {
              return;
            }
            onChange(next ?? "");
          }}
          options={{
            automaticLayout: true,
            ariaLabel,
            fontSize: 13,
            lineNumbers: lineNumbers ? "on" : "off",
            minimap: { enabled: minimap },
            readOnly,
            renderValidationDecorations: "on",
            scrollBeyondLastLine: false,
            wordWrap: "on",
          }}
        />
      </div>
      {jsonError ? <Alert variant="warning">JSON parse error: {jsonError}</Alert> : null}
    </div>
  );
}
