import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { HomePage } from './pages/HomePage';

// Bound to STORY-001 in 02_specs/PRODUCT_BACKLOG.md.

test.describe('Home page first impression', () => {
  test('page loads and shows product name', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();
    await home.expectVisible();
  });

  test('Get Started navigates to onboarding', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();
    await home.clickGetStarted();
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole('heading', { name: /onboarding/i })).toBeVisible();
  });

  test('page is accessible (no serious axe violations)', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const serious = results.violations.filter(
      v => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
});
