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
import { Button } from "../components/button/Button";
import { Card, CardContent, CardHeader } from "../components/card/Card";
import { CodeEditor } from "./CodeEditor";
import { copyText, type CodeLanguage } from "./codeShared";

export interface CodeViewerProps {
  code: string;
  language: CodeLanguage;
  title?: string;
  showLineNumbers?: boolean;
  maxHeight?: string | number;
  copyEnabled?: boolean;
}

export function CodeViewer({
  code,
  language,
  title,
  showLineNumbers = true,
  maxHeight = 480,
  copyEnabled = true,
}: CodeViewerProps) {
  const [copied, setCopied] = React.useState(false);

  return (
    <Card>
      {title || copyEnabled ? (
        <CardHeader>
          <div className="flex items-center justify-between gap-3">
            <h3 className="text-sm font-semibold">{title ?? "Code"}</h3>
            {copyEnabled ? (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  void copyText(code).then(() => {
                    setCopied(true);
                    window.setTimeout(() => setCopied(false), 2000);
                  });
                }}
              >
                {copied ? "Copied!" : "Copy"}
              </Button>
            ) : null}
          </div>
        </CardHeader>
      ) : null}
      <CardContent>
        <CodeEditor
          value={code}
          language={language}
          readOnly
          height={maxHeight}
          lineNumbers={showLineNumbers}
        />
      </CardContent>
    </Card>
  );
}
