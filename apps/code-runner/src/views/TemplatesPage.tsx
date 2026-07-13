// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
import * as React from "react";
import { Card, CardContent, CardHeader } from "@cloud-dog/ui";
const TEMPLATES = [
  { name: "python-script", language: "python", body: "print('hello')" },
  { name: "node-script", language: "node", body: "console.log('hello')" },
  { name: "data-transform", language: "python", body: "import json\nprint(json.dumps({'ok': True}))" },
];
export function TemplatesPage() {
  return (
    <section aria-labelledby="templates-heading" className="space-y-4">
      <h1 id="templates-heading" className="text-xl font-semibold">templates</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {TEMPLATES.map((t) => (
          <Card key={t.name}>
            <CardHeader><div className="flex items-center justify-between"><span className="font-medium">{t.name}</span><span className="text-xs text-muted-foreground">{t.language}</span></div></CardHeader>
            <CardContent><pre className="overflow-x-auto rounded bg-muted p-2 text-xs">{t.body}</pre></CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
