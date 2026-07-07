# STORY-002 — Agent Onboarding & Registration Form

## Layout & Regions
- **Region:** Centered card layout within main content area (`width: 480px`, `margin: 0 auto`)
- **Ant Components:** `Card` (body style), `Form`, `Typography.Text/Title`, `Input`, `TextArea`, `Button`

## Content Hierarchy
1. Page heading: `'Welcome'`
2. Form field 1: Agent Name (required)
3. Form field 2: Description (optional)
4. Primary submit action

## Exact Visible Copy
- Heading: `'Welcome'`
- Label 1: `'Agent name'` + `*` (visual required indicator)
- Label 2: `'Description'`
- Placeholder 1: `'Enter agent name'`
- Placeholder 2: `'Optional details about this agent'`
- Button: `'Create Agent'`

## States
- **Default:** Clean form layout, left-aligned labels, `Input`/`TextArea` borders use `colorBorder`
- **Loading:** Button state `loading="true"`, disabled while submitting
- **Error (Validation):** Inline below field: `'Agent name is required.'` (`colorError`, 14px)
- **Error (Network):** Banner above form: `'Failed to create agent. Please try again.'`
- **Success:** On HTTP 200, navigate to `/agents` (handled by router)

## Accessibility
- `Form.Item` wraps inputs with linked `<label>`
- Required field visually marked and programmatically flagged (`required` prop)
- Error messages use `role="alert"`
- Tab order: heading → name input → description textarea → submit button
