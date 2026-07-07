# user_guide

## Overview
Manage a local roster of autonomous agents through a browser-based console. Register new agents, monitor their status, and remove obsolete records without page reloads.

## Local Execution
Prerequisites: Node.js 20+, SQLite3 CLI.

1. Initialize database and seed sample data:
   ```bash
   cd backend
   npx prisma db push
   npm run db:seed
   ```
2. Start backend service:
   ```bash
   npm run dev
   # Runs on http://localhost:3001
   ```
3. Start frontend service:
   ```bash
   cd frontend
   npm install
   npm run dev
   # Runs on http://localhost:3000
   ```
4. Open `http://localhost:3000` in a supported browser.

## Workflow & Screens

### Landing Page (`/`)
- Renders the product title and a primary "Get Started" call-to-action button.
- Clicking "Get Started" navigates directly to `/onboarding`.
- Compliant with WCAG 2.1 AA standards. Keyboard focus order follows logical top-down sequence.

### Agent Onboarding (`/onboarding`)
- Displays a registration form under a "Welcome" heading.
- **Fields:**
  - `agent name` (Required). Accepts alphanumeric strings, spaces, and hyphens. Minimum 1 character.
  - `description` (Optional). Textarea accepting up to 500 characters.
- Submit the form to persist the agent record via POST `/api/agents`.
- On success, the interface redirects to `/agents`. The new row appears with status `idle`.

### Agent Management List (`/agents`)
- Renders a data table with columns: `name`, `description`, `status`, `creation date`.
- **Empty State:** When no agents exist, displays contextual text and a link navigating to `/onboarding`.
- **Row Actions:** Each row contains a delete control. Triggering it calls DELETE `/api/agents/{agentId}` and removes the row from the DOM instantly. The browser URL remains `/agents` without a full reload.
- **Status Values:** `idle`, `active`, `paused`. Reflects the agent's current lifecycle state.
