import { Page, Locator, expect } from '@playwright/test';

export class OnboardingPage {
  readonly page: Page;
  readonly welcomeHeading: Locator;
  readonly agentNameInput: Locator;
  readonly descriptionInput: Locator;
  readonly submitButton: Locator;

  constructor(page: Page) {
    this.page = page;
    this.welcomeHeading = page.getByRole('heading', { name: /welcome/i });
    this.agentNameInput = page.getByLabel('Agent name');
    this.descriptionInput = page.getByRole('textbox', { name: /description/i });
    this.submitButton = page.getByRole('button', { name: /submit|create agent/i }).first();
  }

  async goto() {
    return this.page.goto('/onboarding');
  }

  async expectVisible() {
    await expect(this.welcomeHeading).toBeVisible();
    await expect(this.agentNameInput).toBeVisible();
    await expect(this.descriptionInput).toBeVisible();
  }

  async fillAgentName(name: string) {
    await this.agentNameInput.fill(name);
  }

  async fillDescription(text: string) {
    if (this.descriptionInput) {
      await this.descriptionInput.fill(text);
    }
  }

  async submit() {
    await this.submitButton.click();
  }
}
