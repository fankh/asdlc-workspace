import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { AgentsListPage } from './pages/AgentsListPage';

// Bound to STORY-004 in 02_specs/PRODUCT_BACKLOG.md.
// The API only creates idle agents (status is server-assigned), so the
// filter contract is exercised as: 'idle' shows the created rows, 'active'
// leaves only active rows visible (none exist -> zero rows), 'All' restores.

test.describe('STORY-004: Status Filter Dropdown & Client-Side Filtering', () => {
  test.beforeEach(async ({ page, request }) => {
    await request.post('/api/agents', {
      data: { name: `Filter Agent ${Date.now()}`, description: 'status filter test' },
    });
    await page.goto('/agents');
  });

  test('renders status filter dropdown with required options', async ({ page }) => {
    const list = new AgentsListPage(page);
    await expect(list.filterDropdown).toBeVisible();
    // dropdown sits above the table
    const dropdownBox = await list.filterDropdown.boundingBox();
    const tableBox = await page.locator('table').first().boundingBox();
    expect(dropdownBox!.y).toBeLessThan(tableBox!.y);

    await list.openFilterDropdown();
    await list.assertDropdownOptionsContains('All', 'idle', 'active', 'paused');
  });

  test('filters agent list by selected status without page reload', async ({ page }) => {
    const list = new AgentsListPage(page);
    const urlBefore = page.url();

    await list.selectFilterStatus('idle');
    await expect(list.tableRows.first()).toBeVisible();
    await list.assertOnlyVisibleRowsMatchStatus('idle');

    await list.selectFilterStatus('active');
    await list.assertOnlyVisibleRowsMatchStatus('active');

    await list.selectFilterStatus('All');
    await expect(list.tableRows.first()).toBeVisible();

    // SPA: same document, no navigation
    expect(page.url()).toBe(urlBefore);
  });

  test('is accessible (no serious axe violations)', async ({ page }) => {
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const serious = results.violations.filter(
      v => v.impact === 'serious' || v.impact === 'critical',
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
});
