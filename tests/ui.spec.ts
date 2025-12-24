import { expect, test } from '@playwright/test';

test('touch targets meet the fintech minimum sizes', async ({ page }) => {
  await page.goto('/');
  await page.waitForLoadState('networkidle');

  const primaryButton = page.locator('#fab-action');
  await expect(primaryButton).toBeVisible();
  const primaryBounding = await primaryButton.boundingBox();
  expect(primaryBounding?.height ?? 0).toBeGreaterThanOrEqual(48);

  const iconButton = page.locator('[data-ui="icon-button"]').first();
  await expect(iconButton).toBeVisible();
  const iconBounding = await iconButton.boundingBox();
  expect(iconBounding?.height ?? 0).toBeGreaterThanOrEqual(44);
  expect(iconBounding?.width ?? 0).toBeGreaterThanOrEqual(44);

  const reportsButton = page.locator('nav.md\\:hidden button:has-text("Relatórios")');
  await reportsButton.click();
  await page.waitForSelector('h1:has-text("Relatórios")');
  const personFilterChip = page.locator('[data-ui="chip"]:has-text("Alan")').first();
  await personFilterChip.waitFor({ state: 'visible' });
  await personFilterChip.click();
  const chip = page.locator('[data-ui="chip"]').first();
  await expect(chip).toBeVisible();
  const chipBounding = await chip.boundingBox();
  expect(chipBounding?.height ?? 0).toBeGreaterThanOrEqual(44);
});
