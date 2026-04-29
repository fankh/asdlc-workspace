# Product Backlog

Acceptance criteria are **the contract**. The QA agent passes when every Gherkin scenario here passes, and not before.

Format: INVEST stories with Gherkin (Given/When/Then). One scenario per behaviour, not per page.

---

## STORY-001 — Visitor sees the home page

**As a** first-time visitor
**I want** to land on a page that names the product and offers a clear next action
**So that** I know what this is and what to do next

### Acceptance criteria

```gherkin
Feature: Home page first impression

  Scenario: Page loads and shows product name
    Given the app is running on the local dev server
    When the visitor navigates to "/"
    Then the page returns HTTP 200
    And a heading containing "My Local Agent App" is visible
    And a primary call-to-action button labelled "Get Started" is visible

  Scenario: Get Started navigates to onboarding
    Given the visitor is on "/"
    When they click "Get Started"
    Then the URL becomes "/onboarding"
    And the onboarding heading is visible

  Scenario: Page is accessible
    Given the visitor is on "/"
    Then there are no axe-core violations of severity "serious" or higher
```

### Bound tests

- Playwright: `04_source/frontend/e2e/home.spec.ts`
- AI vision scenario: `scenarios/home.yaml`

### Status

`PENDING` — no implementation yet. Tests should fail RED until the coder agent runs.
