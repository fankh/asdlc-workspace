import { Page, Locator, expect } from '@playwright/test';

export class AgentListPage {
  readonly page: Page;
  readonly tableHeaderName: Locator;
  readonly tableHeaderDescription: Locator;
  readonly tableHeaderStatus: Locator;
  readonly tableHeaderCreationDate: Locator;
  readonly emptyStateMessage: Locator;
  readonly emptyStateLinkToOnboarding: Locator;

  constructor(page: Page) {
    this.page = page;
    this.tableHeaderName = page.getByRole('columnheader', { name: 'name' });
    this.tableHeaderDescription = page.getByRole('columnheader', { name: 'description' });
    this.tableHeaderStatus = page.getByRole('columnheader', { name: 'status' });
    this.tableHeaderCreationDate = page.getByRole('columnheader', { name: 'creation date' });
    this.emptyStateMessage = page.getByText(/no data available/i).first();
    this.emptyStateLinkToOnboarding = page.getByRole('link', { name: /onboarding|add agent/i }).first();
  }

  async goto() {
    return this.page.goto('/agents');
  }

  rowFor(agentName: string): Locator {
    return this.page.getByRole('row').filter({ hasText: agentName });
  }

  rowBodyFor(agentName: string): Locator {
    return this.rowFor(agentName).getByRole('cell').first();
  }

  statusCellFor(agentName: string): Locator {
    const row = this.rowFor(agentName);
    // Status is the 3rd column in Ant Design default Table layout
    return row.getByRole('cell').nth(2);
  }

  async expectHeadersVisible() {
    await expect(this.tableHeaderName).toBeVisible();
    await expect(this.tableHeaderDescription).toBeVisible();
    await expect(this.tableHeaderStatus).toBeVisible();
    await expect(this.tableHeaderCreationDate).toBeVisible();
  }

  async expectEmptyStateVisible() {
    await expect(this.emptyStateMessage).toBeVisible();
    await expect(this.emptyStateLinkToOnboarding).toBeVisible();
  }

  async deleteAgent(agentName: string) {
    const row = this.rowFor(agentName);
    await row.getByRole('button', { name: /delete|remove/i }).click();
    // Auto-wait for row detachment before proceeding
    await expect(row).not.toBeVisible();
  }
}
