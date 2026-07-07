# Requirements: My Local Agent App

## Functional
- Display a home page naming the product "My Local Agent App" with a primary call-to-action button labelled "Get Started".
- Navigate the "Get Started" button to `/onboarding`.
- Display an onboarding page welcoming the user and providing a form to register a new agent.
- Accept a required agent name and optional description as form inputs.
- Save submitted agent data upon form submission and redirect to `/agents`.
- Display an agent list at `/agents` showing all registered agents in a table.
- Render table columns for name, description, status (defaulting to "idle"), and creation date.
- Display an empty state with a link to `/onboarding` when no agents exist.
- Allow deletion of individual agents from the list without a full page reload.
- Provide a status filter dropdown above the table with options "All", "idle", "active", and "paused".
- Filter the agent list by selected status without a full page reload.

## Non-functional
- Deploy as a desktop-first web application.
- Pass WCAG AA accessibility checks with no serious or critical axe-core violations on any page.
- Expose a backend REST API documented via OpenAPI for frontend consumption.

## Constraints
- Restrict data storage to local single-user deployment.
- Omit authentication in v1.
- Exclude multi-tenancy, agent log streaming, and notifications from v1.
