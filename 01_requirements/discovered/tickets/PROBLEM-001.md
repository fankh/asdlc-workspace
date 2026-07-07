# P1 — Missing Page-Level <h1> Headings

**Area:** /agents, /onboarding

Multiple primary console routes omit level-one headings, violating WCAG 2.4.1 (Bypass Blocks) and breaking screen reader landmark navigation.

## Acceptance criteria

```gherkin
Feature: Page-level heading presence across console routes
  Scenario: Verify H1 exists on all primary app pages
    Given I navigate to "/agents" or "/onboarding"
    When the application DOM is fully rendered
    Then document.querySelector('h1') must return a non-null element
      And its visible text content must exactly match the route title ("Agents" or "Onboarding")
```
