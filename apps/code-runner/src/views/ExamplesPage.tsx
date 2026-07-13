// Copyright 2026 Cloud-Dog, Viewdeck Engineering Limited
import * as React from "react";
import { Card, CardContent, CardHeader } from "@cloud-dog/ui";
const EXAMPLES = [
  { title: "Fibonacci", language: "python", code: "def fib(n):\n    a,b=0,1\n    for _ in range(n): a,b=b,a+b\n    return a\nprint(fib(10))" },
  { title: "Factorial", language: "python", code: "import math\nprint(math.factorial(5))" },
  { title: "JSON echo", language: "node", code: "console.log(JSON.stringify({sum: 1+2}))" },
];
export function ExamplesPage() {
  return (
    <section aria-labelledby="examples-heading" className="space-y-4">
      <h1 id="examples-heading" className="text-xl font-semibold">examples</h1>
      <div className="grid gap-3 sm:grid-cols-2">
        {EXAMPLES.map((e) => (
          <Card key={e.title}>
            <CardHeader><div className="flex items-center justify-between"><span className="font-medium">{e.title}</span><span className="text-xs text-muted-foreground">{e.language}</span></div></CardHeader>
            <CardContent><pre className="overflow-x-auto rounded bg-muted p-2 text-xs">{e.code}</pre></CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}
