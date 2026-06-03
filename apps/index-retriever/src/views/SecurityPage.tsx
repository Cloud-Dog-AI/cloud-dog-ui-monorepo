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
import { Card, CardContent, CardHeader, CodeEditor, JsonExplorer } from "@cloud-dog/ui";
import { useIndexRetrieverState } from "../state/AppState";
import type { JsonRecord } from "../lib/types";
import { SecurityAdminSectionView } from "./SecurityAdminSections";

function asRecord(value: unknown): JsonRecord {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as JsonRecord;
}

export function SecurityPage() {
  const app = useIndexRetrieverState();
  const [bindingSnapshot, setBindingSnapshot] = React.useState<unknown>({});
  const [editorValue, setEditorValue] = React.useState('{\\n  "entity_type": "user",\\n  "entity_id": "alice",\\n  "role": "admin"\\n}');
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    let cancelled = false;
    const load = async () => {
      try {
        const out = asRecord(await app.api.listRbacBindings());
        if (cancelled) return;
        const snapshot = {
          bindings: out.bindings ?? [],
          count: Array.isArray(out.bindings) ? out.bindings.length : 0,
        };
        setBindingSnapshot(snapshot);
        setEditorValue(JSON.stringify(snapshot, null, 2));
      } catch (loadError) {
        if (!cancelled) {
          setError(app.captureFailure(loadError));
        }
      }
    };

    void load();
    return () => {
      cancelled = true;
    };
  }, [app]);

  return (
    <div className="space-y-6">
      {error ? <p role="alert" className="text-sm text-destructive">{error}</p> : null}

      <div className="grid gap-4 xl:grid-cols-2">
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">RBAC Binding Explorer</h2>
          </CardHeader>
          <CardContent>
            <JsonExplorer data={bindingSnapshot} defaultExpanded />
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <h2 className="text-lg font-semibold">Security JSON Editor</h2>
          </CardHeader>
          <CardContent>
            <CodeEditor value={editorValue} onChange={setEditorValue} language="json" height={320} />
          </CardContent>
        </Card>
      </div>

      <SecurityAdminSectionView section="all" />
    </div>
  );
}
