import { Page, Locator, expect } from '@playwright/test';

export class HomePage {
  readonly page: Page;
  readonly heading: Locator;
  readonly getStartedButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.heading = page.getByRole('heading', { name: /my local agent app/i });
    this.getStartedButton = page.getByRole('button', { name: /get started/i });
  }

  async goto() {
    const response = await this.page.goto('/');
    expect(response?.status()).toBe(200);
  }

  async expectVisible() {
    await expect(this.heading).toBeVisible();
    await expect(this.getStartedButton).toBeVisible();
  }

  async clickGetStarted() {
    await this.getStartedButton.click();
  }
}
