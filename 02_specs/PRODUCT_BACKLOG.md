# Product Backlog

Acceptance criteria are **the contract**. The QA agent passes when every Gherkin scenario here passes, and not before.

Format: INVEST stories with Gherkin (Given/When/Then). One scenario per behaviour, not per page.

---

## STORY-001 — Landing Page First Impression & Navigation

**As a** visitor
**I want** to see a heading with the product name and a primary 'Get Started' call-to-action that navigates to '/onboarding'
**So that** I can confirm I am in the correct application and proceed immediately to onboarding.

### Acceptance criteria

```gherkin
Feature: [Pre-bound to existing tests]

  Scenario: Render product name and primary CTA
    Given I navigate to the URL '/'
    When the page fully renders
    Then visible text 'My Local Agent App' is present in a heading element
    And a button with visible text 'Get Started' is rendered as the primary call-to-action

  Scenario: CTA navigates to onboarding route
    Given I am viewing the URL '/'
    When I click the button with visible text 'Get Started'
    Then the browser URL updates to '/onboarding'

  Scenario: Accessibility compliance on landing page
    Given I am viewing the URL '/'
    When an axe-core accessibility scan executes against the DOM
    Then zero violations with severity 'serious' or higher are reported
```

### Bound tests

- Playwright: `04_source/frontend/e2e/home.spec.ts`
- AI vision scenario: `scenarios/home.yaml`

### Status

`PENDING` — awaiting implementation.

---

## STORY-002 — Agent Onboarding & Registration Form

**As a** user
**I want** to complete a registration form on '/onboarding' with a required agent name and optional description
**So that** I can persist a new agent record and proceed to manage it.

### Acceptance criteria

```gherkin
Feature: Onboarding Page & Form Submission

  Scenario: Display welcome message and form fields
    Given I navigate to the URL '/onboarding'
    When the page loads
    Then visible text 'Welcome' is present on the page
    And an input field for 'agent name' is visible
    And an optional input or text area for 'description' is visible

  Scenario: Valid submission saves record and redirects to list
    Given I am viewing the URL '/onboarding'
    When I enter valid data into the agent name field and submit the form
    Then the browser navigates to '/agents'
    And an HTTP GET request to the agents endpoint returns status 200
    And visible text matching the entered name appears in the table body

  Scenario: Default agent status reflects as idle after creation
    Given I have just submitted the onboarding form and the URL is '/agents'
    When the page renders the new agent row
    Then visible text 'idle' is displayed in the status column for that row

  Scenario: Accessibility compliance on onboarding page
    Given I am viewing the URL '/onboarding'
    When an axe-core accessibility scan executes against the DOM
    Then zero violations with severity 'serious' or higher are reported
```

### Status

`PENDING` — awaiting implementation.

---

## STORY-003 — Agent List Display, Empty State & Inline Deletion

**As a** user
**I want** to view registered agents in a structured table, handle empty states contextually, and remove records without page reloads
**So that** I can monitor and maintain my local agent roster efficiently.

### Acceptance criteria

```gherkin
Feature: Agent List Page & Management

  Scenario: Table renders with required column headers
    Given I have one or more registered agents
    When I navigate to the URL '/agents'
    Then visible text 'name' is present in the table header
    And visible text 'description' is present in the table header
    And visible text 'status' is present in the table header
    And visible text 'creation date' is present in the table header

  Scenario: Empty state displays with link when no agents exist
    Given there are zero registered agents in the system
    When I navigate to the URL '/agents'
    Then an empty state message is rendered on the page
    And a link within the empty state navigates to '/onboarding'

  Scenario: Deletion removes agent row without full page reload
    Given I am viewing the URL '/agents' with at least one agent listed
    When I trigger the delete action for that specific agent
    Then the corresponding table row is removed from the visible DOM
    And the browser URL remains '/agents'
    And no full page load event is fired in the navigation history

  Scenario: Accessibility compliance on agents list page
    Given I am viewing the URL '/agents'
    When an axe-core accessibility scan executes against the DOM
    Then zero violations with severity 'serious' or higher are reported
```

### Status

`PENDING` — awaiting implementation.

---
