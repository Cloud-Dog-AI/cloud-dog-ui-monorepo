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

// @cloud-dog/testing — Embedded page recipe (smoke + a11y).

import type { Page } from "@playwright/test";
import { checkA11y } from "../a11y/check-a11y";

export async function embeddedPageRecipe(options: {
  page: Page;
  url: string;
  title?: string | RegExp;
}): Promise<void> {
  await options.page.goto(options.url);

  if (options.title) {
    const actual = await options.page.title();
    if (typeof options.title === "string") {
      if (actual !== options.title) {
        throw new Error(`Expected title '${options.title}' but got '${actual}'.`);
      }
    } else if (!options.title.test(actual)) {
      throw new Error(`Expected title to match ${String(options.title)} but got '${actual}'.`);
    }
  }

  await checkA11y(options.page);
}
