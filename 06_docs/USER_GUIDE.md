# User Guide

## Overview
My Local Agent App manages agent lifecycles through a browser-based console. The application handles registration, roster monitoring, status filtering, and record removal via a single-page interface backed by Express and SQLite.

## Installation & Local Execution
Prerequisites: Node 20+, npm or pnpm.

1. Initialize the database and apply seeds:
   ```bash
   npx prisma db push
   npx prisma db seed
   ```
2. Start the backend service on port `:3001`:
   ```bash
   cd backend && npm run dev
   ```
3. Start the frontend service on port `:3000` in a separate terminal:
   ```bash
   cd frontend && npm run dev
   ```
4. Open `http://localhost:3000` in your browser.

## Workflows

### Landing Page (STORY-001)
1. Navigate to `http://localhost:3000`.
2. Verify the application heading displays "My Local Agent App".
3. Click **Get Started**. The interface routes to `/onboarding`.

### Agent Onboarding (STORY-002)
1. Proceed to the `/onboarding` screen.
2. Enter a display name in the required `agent name` field.
3. Provide context in the `description` text area (optional).
4. Submit the form.
5. The system persists the record, redirects to `/agents`, and populates the roster table. Default status is `idle`.

### Agent List & Management (STORY-003)
1. Navigate to `/agents` to view the registered roster.
2. Review columns: `name`, `description`, `status`, `creation date`.
3. Remove a record by clicking the delete action in the target row. The row removes from the DOM immediately. No page reload occurs.

### Status Filtering (STORY-004)
1. Locate the dropdown control above the table on `/agents`.
2. Select `All`, `idle`, `active`, or `paused`.
3. The table updates visibility instantly using client-side filtering. Browser navigation history records no new page load event.

### Empty State Handling
1. Navigate to `/agents` with zero registered agents.
2. Observe the empty state prompt.
3. Select the provided link to route to `/onboarding`. Create an agent to populate the table.

## Accessibility & UX Notes
- All inputs and interactive controls support keyboard navigation and screen reader focus order.
- Status badges render with WCAG AA contrast ratios using the console token palette.
- Error banners appear inline for validation failures and as dismissible alerts for network faults.
