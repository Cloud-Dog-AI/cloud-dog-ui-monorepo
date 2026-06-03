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

// @cloud-dog/testing — Cookie-proxy authenticated page fixture.

import { test as base, request as requestFactory, type Page } from "@playwright/test";

type Fixtures = {
  proxyAuthPage: Page;
};

export const test = base.extend<Fixtures>({
  proxyAuthPage: async ({ browser }, use) => {
    const baseURL = process.env.E2E_BASE_URL;
    if (!baseURL) {
      throw new Error("E2E_BASE_URL is required for proxyAuthPage.");
    }

    const username = process.env.E2E_USERNAME ?? "admin";
    const password = process.env.E2E_PASSWORD ?? "admin";

    const api = await requestFactory.newContext({ baseURL });
    const resp = await api.post("/web/auth/login", {
      data: { username, password },
    });

    if (!resp.ok()) {
      throw new Error(`Proxy login failed (${resp.status()}).`);
    }

    const storageState = await api.storageState();
    await api.dispose();

    const context = await browser.newContext({ baseURL, storageState });
    const page = await context.newPage();
    await use(page);
    await context.close();
  },
});
