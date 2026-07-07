import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { HomePage } from './pages/HomePage';

test.describe('STORY-001', () => {
  test('renders product name and primary CTA', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();
    await expect(home.heading).toBeVisible();
    await expect(home.getStartedButton).toBeVisible();
  });

  test('CTA navigates to onboarding route', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();
    await home.clickGetStarted();
    await expect(page).toHaveURL(/\/onboarding$/);
    await expect(page.getByRole('heading', { name: /onboarding/i })).toBeVisible();
  });

  test('accessibility compliance on landing page', async ({ page }) => {
    const home = new HomePage(page);
    await home.goto();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const serious = results.violations.filter(
      v => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
});
