import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { AgentsListPage } from './pages/AgentsListPage';

// Bound to STORY-004 in 02_specs/PRODUCT_BACKLOG.md.

test.describe('STORY-004: Status Filter Dropdown & Client-Side Filtering', () => {
  let agentsListPage: AgentsListPage;

  // Backend API is live: create exactly the data required for filtering assertions
  test.beforeAll(async ({ request, page }) => {
    const baseUrl = process.env.BASE_URL || 'http://localhost:3000';
    await request.post(`${baseUrl}/api/agents`, { data: { name: 'Filter Idle Agent', description: 'Status filter test 1', status: 'idle' } });
    await request.patch(`${baseUrl}/api/agents?name=Filter%20Idle%20Agent`, { data: { status: 'active' } });
    await request.post(`${baseUrl}/api/agents`, { data: { name: 'Filter Paused Agent', description: 'Status filter test 2', status: 'paused' } });
    // Ensure list is rendered & populated before tests run
    await page.goto('/agents');
  });

  test('renders status filter dropdown with required options', async ({ page }) => {
    agentsListPage = new AgentsListPage(page);
    await agentsListPage.goto();
    
    // Per Gherkin: dropdown visible above table, contains specific options
    await expect(agentsListPage.filterDropdown).toBeVisible();
    
    await agentsListPage.openFilterDropdown();
    await agentsListPage.assertDropdownOptionsContains('All', 'idle', 'active', 'paused');
  });

  test('filters agent list by selected status without page reload', async ({ page }) => {
    agentsListPage = new AgentsListPage(page);
    await agentsListPage.goto();
    const urlBeforeFilter = page.url();
    
    // Per Gherkin: select 'active', verify only active remain, no navigation event
    await agentsListPage.selectFilterStatus('active');
    await agentsListPage.assertOnlyVisibleRowsMatchStatus('active');
    expect(page.url()).toBe(urlBeforeFilter);
  });

  test('is accessible (no serious axe violations)', async ({ page }) => {
    agentsListPage = new AgentsListPage(page);
    await agentsListPage.goto();
    
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    
    const serious = results.violations.filter(
      v => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
});
