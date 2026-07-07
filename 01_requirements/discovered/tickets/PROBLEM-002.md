# P1 — /agents Table Contrast & Empty Header Violation

**Area:** /agents

Dark theme tokens are leaking or misapplied to the agents listing table, causing 3 nodes to fall below WCAG AA 4.5:1 thresholds and leaving a <th> cell empty during empty-state rendering.

## Acceptance criteria

```gherkin
Feature: WCAG Contrast & Table Header Compliance on Agents List
  Scenario: Validate contrast ratios and table header text in the agents listing
    Given I am on the "/agents" route with zero agents loaded (empty state)
    When the table component renders its header and rows (or empty-state placeholder)
    Then running an axe-core accessibility scan must return zero violations
      And all <th> elements in the first row must contain discernible text or a valid aria-label
```
