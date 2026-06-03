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

// @cloud-dog/testing — Component-scoped axe scan.

import AxeBuilder from "@axe-core/playwright";
import type { Locator } from "@playwright/test";

export async function checkComponentA11y(locator: Locator): Promise<void> {
  const page = locator.page();
  const results = await new AxeBuilder({ page })
    .include(await locator.evaluate((el) => {
      (el as HTMLElement).setAttribute("data-a11y-scope", "1");
      return "[data-a11y-scope='1']";
    }))
    .withTags(["wcag2a", "wcag2aa"])
    .analyze();

  const violations = results.violations;
  if (violations.length === 0) return;
  const details = violations
    .map((v) => `  [${v.impact}] ${v.id}: ${v.description} (${v.nodes.length} nodes)`)
    .join("\n");
  throw new Error(`WCAG 2.x AA violations found:\n${details}`);
}
