import { expect } from '@playwright/test';
import { ensureAuthenticated, isRealMode, test } from '../tests/fixtures';

test('ui-review2 dashboard landing shows live metrics and quick actions', async ({ page }) => {
  await ensureAuthenticated(page);
  await page.goto('/');
  await expect(page.getByRole('heading', { level: 1, name: /^dashboard$/i })).toBeVisible();
  await expect(page.getByText(/queue depth/i)).toBeVisible();
  await expect(page.getByText(/active jobs/i)).toBeVisible();
  // W28A-307: W28A-276 removed QuickActionBar; verify HealthWidget
  await expect(page.getByText(/api/i).first()).toBeVisible();
});

test('ui-review2 monitoring uses live status and audit panels', async ({ page }) => {
  await ensureAuthenticated(page);
  await page.goto('/admin/monitoring');
  await expect(page.getByRole('heading', { level: 1, name: /^monitoring$/i })).toBeVisible();
  await expect(page.getByText(/uptime/i)).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/^memory$/i)).toBeVisible({ timeout: 15000 });
  if (isRealMode()) {
    await expect(page.getByLabel(/log source/i)).toBeVisible();
    await expect(page.getByRole('button', { name: /^columns$/i }).first()).toBeVisible();
    await expect(page.getByRole('columnheader', { name: /event type/i })).toBeVisible();
    await expect(page.getByText(/loaded .* entries from|no log entries match the current filter/i).first()).toBeVisible();
  } else {
    await expect(page.getByText(/user.updated/i)).toBeVisible();
  }
});

test('ui-review2 users table exposes page jump and column picker controls', async ({ page }) => {
  await ensureAuthenticated(page);
  await page.goto('/');
  await page.getByRole('link', { name: /^users$/i }).click();
  await expect(page.getByRole('heading', { level: 1, name: /^users$/i })).toBeVisible();
  await expect(page.getByText(/^page$/i)).toBeVisible();
  await page.getByRole('button', { name: /^columns$/i }).first().click();
  await expect(page.getByText(/visible columns/i)).toBeVisible();
  // The Users table renders via the shared @cloud-dog/idam UsersPage, whose column
  // header (and hence the column-picker "Show <header>" label) is the field id
  // `display_name`. Assert the column picker hides that shipped column.
  await page.getByLabel(/show display_name/i).uncheck();
  await expect(page.getByRole('columnheader', { name: /^display_name$/i })).toHaveCount(0);
});

test('ui-review2 jobs page shows shared jobs surface and structured detail', async ({ page }) => {
  await ensureAuthenticated(page);
  await page.goto('/');
  await page.getByRole('link', { name: /^jobs$/i }).click();
  await expect(page.getByRole('heading', { level: 1, name: /^jobs$/i })).toBeVisible();
  if (isRealMode()) {
    await expect(page.getByText(/status/i).first()).toBeVisible();
    const detailButtons = page.getByRole('button', { name: /^detail$/i });
    if (await detailButtons.count()) {
      await detailButtons.first().click();
      await expect(page.getByRole('button', { name: /copy json/i })).toBeVisible();
    } else {
      await expect(page.getByText(/no jobs found/i)).toBeVisible();
    }
  } else {
    await page.getByRole('button', { name: /^detail$/i }).first().click();
    await expect(page.getByRole('heading', { level: 2, name: /^job \d+ detail$/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /copy json/i }).first()).toBeVisible();
  }
});

test('ui-review2 api docs page renders embedded docs and links', async ({ page }) => {
  await ensureAuthenticated(page);
  await page.goto('/');
  await page.getByRole('link', { name: /^api docs$/i }).click();
  await expect(page.getByRole('heading', { level: 1, name: /^api docs$/i })).toBeVisible();
  await expect(page.getByRole('link', { name: /openapi json/i })).toBeVisible();
  // The shipped API reference embeds SwaggerUI (shared @cloud-dog/ui ApiDocsPanel,
  // default mode) rather than a raw <iframe>; assert the embedded OpenAPI surface.
  await expect(page.locator('[data-testid="api-docs-openapi-swagger"]')).toBeVisible();
});
