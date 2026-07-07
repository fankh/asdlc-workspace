import { Page, Locator, expect } from '@playwright/test';

export class AgentsListPage {
  readonly page: Page;
  readonly filterDropdown: Locator;
  readonly tableRows: Locator;

  constructor(page: Page) {
    this.page = page;
    // Ant Design Select rendered as combobox with visible status label
    this.filterDropdown = page.getByRole('combobox', { name: /status/i });
    // Matches STORY-003 table structure: <table><tbody><tr>...
    this.tableRows = page.locator('table tbody tr');
  }

  async goto() {
    await this.page.goto('/agents');
  }

  async openFilterDropdown() {
    await expect(this.filterDropdown).toBeVisible();
    await this.filterDropdown.click();
  }

  // Verifies the dropdown popup contains the expected option labels
  async assertDropdownOptionsContains(...expectedOptions: string[]) {
    const optionTexts = await this.page.getByRole('option').allTextContents();
    const matches = expectedOptions.every(opt => optionTexts.some(text => text.includes(opt)));
    expect(matches).toBe(true);
  }

  async selectFilterStatus(option: string) {
    await this.openFilterDropdown();
    // Ant Design renders status options with matching visible text & role=option
    await this.page.getByRole('option', { name: option, exact: true }).click();
    // Verify the combobox reflects the selection
    await expect(this.filterDropdown).toHaveText(new RegExp(`^${option}$`, 'i'));
  }

  // Asserts all currently visible rows report the expected status text in the 3rd column
  async assertOnlyVisibleRowsMatchStatus(expectedStatus: string) {
    const rowCount = await this.tableRows.count();
    expect(rowCount).toBeGreaterThan(0);
    for (let i = 0; i < rowCount; i++) {
      const row = this.tableRows.nth(i);
      // Column order per STORY-003: name, description, status, creation date
      const statusText = await row.locator('td').nth(2).innerText().then(t => t.trim());
      expect(statusText.toLowerCase()).toBe(expectedStatus.toLowerCase());
    }
  }
}
