import { chromium } from '@playwright/test';
import fs from 'node:fs';

const apiKey = fs.readFileSync('/opt/iac/Development/cloud-dog-ai/git-mcp-server/working/w28a-649/seed_api_key.txt', 'utf8').trim();
const browser = await chromium.launch({ headless: true });
const page = await browser.newPage();
page.on('response', async (resp) => {
  const url = resp.url();
  if (url.includes('/git-api/api/v1/admin/api-keys') && resp.request().method() === 'POST') {
    let body = '';
    try { body = await resp.text(); } catch {}
    console.log('CREATE_API_KEY_RESPONSE', body);
  }
});
await page.goto('http://127.0.0.1:5177/login');
await page.getByRole('textbox', { name: 'API key' }).fill(apiKey);
await page.getByRole('button', { name: 'Sign in' }).click();
await page.getByRole('heading', { name: 'Dashboard' }).waitFor({ timeout: 30000 });
const stamp = Date.now();
const userId = `probe-user-${stamp}`;
await page.goto('http://127.0.0.1:5177/admin/users');
await page.getByRole('button', { name: 'Add User' }).click();
await page.locator('#ef-userId').fill(userId);
await page.locator('#ef-username').fill(userId);
await page.locator('#ef-email').fill(`${userId}@example.test`);
await page.getByRole('button', { name: 'Save' }).click();
await page.getByRole('row', { name: new RegExp(userId) }).waitFor({ timeout: 30000 });
await page.goto('http://127.0.0.1:5177/admin/api-keys');
await page.getByRole('button', { name: 'Add API Key' }).click();
await page.locator('#ef-name').fill(`probe-key-${stamp}`);
await page.locator('#ef-ownerUserId').fill(userId);
await page.locator('#ef-capabilities').fill('tools:read, tools:write');
await page.locator('#ef-ttlDays').fill('5');
await page.getByRole('button', { name: 'Save' }).click();
await page.waitForTimeout(3000);
const exists = await page.locator('#generated-api-key').count();
const value = exists ? await page.locator('#generated-api-key').inputValue() : '';
console.log('GENERATED_API_KEY_EXISTS', exists);
console.log('GENERATED_API_KEY_VALUE', value);
console.log('STATUS_TEXT', await page.getByRole('status').allTextContents().catch(() => []));
await browser.close();
