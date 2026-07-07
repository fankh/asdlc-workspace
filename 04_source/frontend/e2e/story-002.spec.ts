import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { OnboardingPage } from './pages/OnboardingPage';
import { AgentListPage } from './pages/AgentListPage';

test.describe('STORY-002', () => {
  test('displays welcome message and form fields', async ({ page }) => {
    const onboarding = new OnboardingPage(page);
    await onboarding.goto();
    await onboarding.expectVisible();
  });

  test('valid submission saves record and redirects to list', async ({ page }) => {
    const agentName = `Test Agent ${Date.now()}`;
    const onboarding = new OnboardingPage(page);
    const list = new AgentListPage(page);

    await onboarding.goto();
    await onboarding.fillAgentName(agentName);
    await onboarding.submit();

    await expect(page).toHaveURL(/\/agents$/);

    // Backend is live; verify persistence via API contract
    const response = await page.request.get('/api/agents');
    expect(response.status()).toBe(200);
    const agents = await response.json();
    expect(Array.isArray(agents)).toBeTruthy();
    expect(agents.some((a: any) => a.name === agentName)).toBeTruthy();

    // Verify visible copy in table body
    await expect(list.rowBodyFor(agentName)).toBeVisible();
  });

  test('default agent status reflects as idle after creation', async ({ page }) => {
    const agentName = `Idle Status Agent ${Date.now()}`;
    const onboarding = new OnboardingPage(page);
    const list = new AgentListPage(page);

    await onboarding.goto();
    await onboarding.fillAgentName(agentName);
    await onboarding.submit();

    await expect(list.statusCellFor(agentName)).toHaveText(/idle/i);
  });

  test('accessibility compliance on onboarding page', async ({ page }) => {
    const onboarding = new OnboardingPage(page);
    await onboarding.goto();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const serious = results.violations.filter(
      v => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
});
