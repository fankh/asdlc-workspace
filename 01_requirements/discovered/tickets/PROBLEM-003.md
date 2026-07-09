# P0 — E2E Locator Mismatch on Form Submission Flow

**Area:** Frontend / E2E Testing

The test waits for `getByText('Submit')` but times out after 8s. This indicates the rendered button text does not match the locator, or the element is hidden/disabled during the test execution. This blocks verification of the core save-and-redirect acceptance criterion.

## Acceptance criteria

```gherkin
Given I am on the record submission form
When all required fields are filled and validation passes
Then a visible button should exist with the label "Submit"
And clicking it saves the record and redirects to the list page
```
