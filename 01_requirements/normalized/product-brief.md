# Requirements: My Local Agent App

## Functional
- Render a home page displaying "My Local Agent App" and a primary call-to-action button labeled "Get Started".
- Navigate to `/onboarding` when the user clicks the "Get Started" button.
- Display an onboarding page that welcomes the user and provides a form to register a new agent.
- Require an "agent name" field in the registration form and make a "description" field optional.
- Save the agent record upon form submission and redirect the user to the agent list page.
- Display all registered agents on the `/agents` page.
- Render a table on `/agents` with columns for name, description, status, and creation date.
- Default the newly created agent's status to "idle".
- Show an empty state containing a link back to `/onboarding` when zero agents are registered.
- Remove a deleted agent from the list without triggering a full page reload.

## Non-functional
- Deploy as a desktop-first web application.
- Pass WCAG AA accessibility checks with no serious or critical axe-core violations on any page.
- Keep all data local to a single-user deployment model.
- Omit authentication for v1.
- Expose a REST API documented with OpenAPI for frontend consumption.

## Constraints
- Exclude authentication, multi-tenancy, agent log streaming, and notifications from v1 scope.
