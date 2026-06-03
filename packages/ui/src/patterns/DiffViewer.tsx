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
import { DiffEditor } from "@monaco-editor/react";
import { Card, CardContent, CardHeader } from "../components/card/Card";
import { toMonacoLanguage, useCloudDogMonacoTheme, type CodeLanguage } from "./codeShared";

export interface DiffViewerProps {
  original: string;
  modified: string;
  language?: CodeLanguage;
  mode: "side-by-side" | "unified";
  title?: string;
  height?: string | number;
}

export function DiffViewer({
  original,
  modified,
  language = "text",
  mode,
  title,
  height = 480,
}: DiffViewerProps) {
  const theme = useCloudDogMonacoTheme();

  return (
    <Card>
      {title ? (
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">{title}</h3>
            <span className="text-xs text-muted-foreground">
              {mode === "side-by-side" ? "Side by side" : "Unified"}
            </span>
          </div>
        </CardHeader>
      ) : null}
      <CardContent>
        <div className="overflow-hidden rounded-xl border bg-card text-card-foreground shadow-sm">
          <DiffEditor
            height={height}
            language={toMonacoLanguage(language)}
            original={original}
            modified={modified}
            theme={theme}
            options={{
              automaticLayout: true,
              fontSize: 13,
              minimap: { enabled: false },
              readOnly: true,
              renderSideBySide: mode === "side-by-side",
              scrollBeyondLastLine: false,
              wordWrap: "on",
            }}
          />
        </div>
      </CardContent>
    </Card>
  );
}
