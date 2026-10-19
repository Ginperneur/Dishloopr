import { test, expect } from '@playwright/test';

test('restaurant back arrow preserves the poke bowl selection', async ({ page }) => {
  await page.goto('http://localhost:8080/search?dish=Poke%20bowl');
  const cards = page.locator('a.restaurant-card');
  await expect(cards.first()).toBeVisible({ timeout: 60000 });
  const searchUrl = page.url();
  const restaurantUrls = await cards.evaluateAll(links => links.map(link => link.getAttribute('href')));
  await cards.first().click();
  const back = page.getByRole('link', { name: 'Terug', exact: true });
  await expect(back).toBeVisible({ timeout: 30000 });
  await expect(back).toHaveAttribute('href', new URL(searchUrl).pathname + new URL(searchUrl).search);
  await back.click();
  await expect(page).toHaveURL(searchUrl);
  await expect(cards.first()).toBeVisible({ timeout: 60000 });
  expect(await cards.evaluateAll(links => links.map(link => link.getAttribute('href')))).toEqual(restaurantUrls);
});