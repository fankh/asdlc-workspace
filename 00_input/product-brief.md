# Product Brief — My Local Agent App

## What we are building

A small B2B console called **My Local Agent App** that lets an operations team
register and monitor local automation agents running on their machines.

## Verbal requirements (from kickoff meeting)

1. Visitors land on a home page that clearly names the product
   ("My Local Agent App") and shows one primary call-to-action button labelled
   "Get Started". Clicking it takes them to an onboarding page at `/onboarding`.
2. The onboarding page welcomes the user and lets them register a new agent by
   entering an agent name (required) and an optional description. Submitting
   the form saves the agent and takes the user to the agent list.
3. The agent list page at `/agents` shows all registered agents in a table with
   name, description, status (defaults to "idle"), and creation date. When no
   agents exist it shows an empty state with a link back to onboarding.
4. Users can delete an agent from the list; the row disappears without a full
   page reload.

## Non-functional

- Web app, desktop-first, must pass WCAG AA accessibility checks
  (no serious/critical axe-core violations on any page).
- All data stays local (single-user deployment, no auth for v1).
- Backend exposes a REST API (OpenAPI-documented) that the frontend consumes.

## Out of scope for v1

- Authentication, multi-tenancy, agent log streaming, notifications.
