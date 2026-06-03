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

// @cloud-dog/testing — Playwright axe-core wrapper.

import AxeBuilder from "@axe-core/playwright";
import type { Page } from "@playwright/test";

export type A11yOptions = Readonly<{
  include?: string[];
  exclude?: string[];
  disableRules?: string[];
}>;

export async function checkA11y(page: Page, options?: A11yOptions): Promise<void> {
  let builder = new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]);
  if (options?.include) builder = builder.include(options.include);
  if (options?.exclude) builder = builder.exclude(options.exclude);
  if (options?.disableRules) builder = builder.disableRules(options.disableRules);

  const results = await builder.analyze();
  const violations = results.violations;
  if (violations.length === 0) return;

  const details = violations
    .map((v) => {
      const nodes = v.nodes
        .slice(0, 3)
        .map((n) => {
          const targets = n.target.join(", ");
          const summary = n.failureSummary ? `\n      ${n.failureSummary}` : "";
          return `    - ${targets}${summary}`;
        })
        .join("\n");
      const more = v.nodes.length > 3 ? `\n    - ... (${v.nodes.length - 3} more)` : "";
      return `  [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} nodes)\n${nodes}${more}`;
    })
    .join("\n");
  throw new Error(`WCAG 2.x AA violations found:\n${details}`);
}
