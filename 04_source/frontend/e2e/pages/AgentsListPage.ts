import { Page, Locator, expect } from '@playwright/test';

export class AgentsListPage {
  readonly page: Page;
  readonly filterDropdown: Locator;
  readonly tableRows: Locator;

  constructor(page: Page) {
    this.page = page;
    // the Select root is the visible/clickable surface (the inner combobox
    // input is a zero-width search field that swallows clicks)
    this.filterDropdown = page.locator('.control-bar .ant-select');
    this.tableRows = this.page.locator('table tbody tr.ant-table-row'); // data rows only
  }

  async goto() {
    await this.page.goto('/agents');
  }

  async openFilterDropdown() {
    await expect(this.filterDropdown).toBeVisible();
    await this.filterDropdown.locator('.ant-select-selector').click();
  }

  // Ant renders role=option nodes in a hidden a11y list; the visible
  // options live in the dropdown portal as .ant-select-item-option
  private visibleOption(option: string) {
    return this.page.locator(
      `.ant-select-dropdown .ant-select-item-option[title="${option}"]`);
  }

  async assertDropdownOptionsContains(...expectedOptions: string[]) {
    for (const option of expectedOptions) {
      await expect(this.visibleOption(option)).toBeVisible();
    }
  }

  async selectFilterStatus(option: string) {
    await this.openFilterDropdown();
    await this.visibleOption(option).click();
    // Ant renders the chosen value in the selection item, not the combobox input
    await expect(
      this.page.locator('.ant-select-selection-item'),
    ).toHaveText(new RegExp(`^${option}$`, 'i'));
  }

  /** Every visible data row must carry the status; zero matching rows also
   *  satisfies "only <status> agents remain visible" when none exist. */
  async assertOnlyVisibleRowsMatchStatus(expectedStatus: string) {
    const rowCount = await this.tableRows.count();
    for (let i = 0; i < rowCount; i++) {
      const statusText = await this.tableRows.nth(i).locator('td').nth(2).innerText();
      expect(statusText.trim().toLowerCase()).toBe(expectedStatus.toLowerCase());
    }
  }
}
