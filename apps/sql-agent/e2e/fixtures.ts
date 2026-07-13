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

// @cloud-dog/app-sql-agent — Real E2E fixtures.

import { test as base, expect, type Page } from '@playwright/test';

function requireEnvValue(...names: string[]): string {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) {
      return value.trim();
    }
  }
  throw new Error(`Missing required environment variable. Tried: ${names.join(', ')}`);
}

export async function login(page: Page): Promise<void> {
  const username = requireEnvValue(
    'E2E_USERNAME',
    'E2E_WEB_USERNAME',
    'CLOUD_DOG_WEB_LOGIN_USERNAME',
    'CLOUD_DOG__WEB_SERVER__USERNAME',
  );
  const password = requireEnvValue(
    'E2E_PASSWORD',
    'E2E_WEB_PASSWORD',
    'CLOUD_DOG_WEB_LOGIN_PASSWORD',
    'CLOUD_DOG__WEB_SERVER__PASSWORD',
  );

  await page.goto('/login', { waitUntil: 'networkidle', timeout: 60_000 });
  // W28A-286: increased timeout for SPA render on loaded preprod
  await expect(page.getByRole('heading', { name: /^sign in$/i })).toBeVisible({ timeout: 60_000 });
  await page.getByLabel('Username', { exact: true }).fill(username);
  await page.getByLabel('Password', { exact: true }).fill(password);
  await page.getByRole('button', { name: /^sign in$/i }).click();
  await expect(page.getByRole('heading', { name: /^dashboard$/i })).toBeVisible({ timeout: 60_000 });
}

export async function gotoNav(page: Page, label: string, heading?: RegExp): Promise<void> {
  await page.getByRole('link', { name: new RegExp(`^${label}$`, 'i') }).first().click();
  if (heading) {
    await expect(page.getByRole('heading', { name: heading })).toBeVisible({ timeout: 30_000 });
  }
}

export async function submitBackgroundQuery(page: Page, question: string): Promise<void> {
  await page.goto('/query', { waitUntil: 'domcontentloaded' });
  await expect(page.getByRole('heading', { name: /^new query$/i })).toBeVisible();
  await page.locator('#queryInput').fill(question);
  await page.locator('#submitQueryBtn').click();
  await expect(page.locator('dd').filter({ hasText: /JOB-\d+/ }).first()).toBeVisible({ timeout: 120_000 });
}

export async function browserJson<T = unknown>(
  page: Page,
  method: string,
  path: string,
  payload?: unknown,
): Promise<{ ok: boolean; status: number; data: T | string | null }> {
  return page.evaluate(
    async ({ requestMethod, requestPath, requestPayload }) => {
      const runtimeBaseUrl =
        typeof window !== 'undefined' && (window as Window & { __RUNTIME_CONFIG__?: { API_BASE_URL?: string } }).__RUNTIME_CONFIG__
          ? (window as Window & { __RUNTIME_CONFIG__?: { API_BASE_URL?: string } }).__RUNTIME_CONFIG__?.API_BASE_URL
          : null;
      const resolvedPath =
        runtimeBaseUrl && (requestPath.startsWith('/api/') || requestPath === '/openapi.json' || requestPath.startsWith('/auth/'))
          ? `${runtimeBaseUrl}${requestPath}`
          : requestPath;
      const response = await fetch(resolvedPath, {
        method: requestMethod,
        credentials: 'same-origin',
        headers: requestPayload === undefined ? {} : { 'Content-Type': 'application/json' },
        body: requestPayload === undefined ? undefined : JSON.stringify(requestPayload),
      });
      const text = await response.text();
      let data: unknown = null;
      try {
        data = text ? JSON.parse(text) : null;
      } catch {
        data = text;
      }
      return { ok: response.ok, status: response.status, data };
    },
    { requestMethod: method, requestPath: path, requestPayload: payload },
  ) as Promise<{ ok: boolean; status: number; data: T | string | null }>;
}

export const test = base.extend({
  page: async ({ page }, use) => {
    await page.addInitScript(() => {
      const globalWindow = window as Window & {
        __sqlAgentDownloadLog__?: Array<{ filename: string; href: string }>;
      };
      const existingLog = Array.isArray(globalWindow.__sqlAgentDownloadLog__)
        ? globalWindow.__sqlAgentDownloadLog__
        : [];
      globalWindow.__sqlAgentDownloadLog__ = existingLog;

      const originalClick = HTMLAnchorElement.prototype.click;
      if (!(HTMLAnchorElement.prototype.click as HTMLAnchorElement['click'] & { __sqlAgentWrapped__?: boolean }).__sqlAgentWrapped__) {
        const wrappedClick = function (this: HTMLAnchorElement) {
          if (this.download) {
            globalWindow.__sqlAgentDownloadLog__?.push({
              filename: this.download,
              href: this.href,
            });
          }
          return originalClick.call(this);
        };
        (wrappedClick as typeof HTMLAnchorElement.prototype.click & { __sqlAgentWrapped__?: boolean }).__sqlAgentWrapped__ = true;
        HTMLAnchorElement.prototype.click = wrappedClick;
      }
    });
    page.setDefaultTimeout(30_000);
    await use(page);
  },
});

export { expect };
