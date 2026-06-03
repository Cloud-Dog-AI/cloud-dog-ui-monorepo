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

// @cloud-dog/testing — Playwright config preset for CI.

import { defineConfig } from "@playwright/test";

export const playwrightPreset = defineConfig({
  testDir: "./tests/e2e",
  timeout: 30_000,
  retries: process.env.CI ? 1 : 0,
  use: {
    headless: true,
    viewport: { width: 1280, height: 720 },
    locale: "en-GB",
    timezoneId: "Europe/London",
    screenshot: "only-on-failure",
    trace: "on-first-retry",
  },
  reporter: process.env.CI ? [["html"]] : [["html"]],
});
