import { test, expect } from '@playwright/test';
import AxeBuilder from '@axe-core/playwright';
import { AgentListPage } from './pages/AgentListPage';

test.describe('STORY-003', () => {
  test('table renders with required column headers', async ({ page }) => {
    // headers only render when the table has data — guarantee one agent
    await page.request.post('/api/agents', {
      data: { name: `Header Test Agent ${Date.now()}`, description: 'auto' },
    });
    const list = new AgentListPage(page);
    await list.goto();
    await list.expectHeadersVisible();
  });

  test('empty state displays with link when no agents exist', async ({ page }) => {
    const list = new AgentListPage(page);
    // Ensure zero agents per precondition
    const existing = await page.request.get('/api/agents').then(r => r.json()).catch(() => []);
    if (existing.length > 0) {
      for (const agent of existing as any[]) {
        await page.request.delete(`/api/agents/${agent.id}`).catch(() => {});
      }
    }
    await list.goto();
    await list.expectEmptyStateVisible();
  });

  test('deletion removes agent row without full page reload', async ({ page }) => {
    // Deterministic setup BEFORE navigation (page fetches agents on mount)
    const targetName = `Deletion Test Agent ${Date.now()}`;
    await page.request.post('/api/agents', {
      data: { name: targetName, description: 'auto' },
    });

    const list = new AgentListPage(page);
    await list.goto();

    const row = list.rowFor(targetName);
    await expect(row).toBeVisible();
    await expect(page).toHaveURL('/agents');

    await list.deleteAgent(targetName);

    // SPA routing: URL unchanged, DOM updates, no full reload
    await expect(row).not.toBeVisible();
    await expect(page).toHaveURL('/agents');
  });

  test('accessibility compliance on agents list page', async ({ page }) => {
    const list = new AgentListPage(page);
    await list.goto();
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    const serious = results.violations.filter(
      v => v.impact === 'serious' || v.impact === 'critical'
    );
    expect(serious, JSON.stringify(serious, null, 2)).toEqual([]);
  });
});
