# CODING_PATTERNS.md

The single source of truth all agents read before generating code. Empty sections are filled in as patterns are *established* during the NEW-project phase, then enforced by the Validator agent.

## Section 0 — Project Type Strategy

- **Mode:** `new`
- **Project type:** `b2b_console` (see `../03-PROJECT_TYPE_UI_PATTERNS.md`)
- **Design system option:** A — established system (Ant Design)
  - Switch to Option B by replacing this section and creating `DESIGN_SYSTEM.md`.

## Section 1 — Stack

| Layer | Choice | Notes |
|---|---|---|
| Frontend framework | React + TypeScript (Vite) | |
| UI library | Ant Design | per Section 0 |
| Backend framework | Express + TypeScript (Node 20) | single Node toolchain for fast refinement loops |
| Database | SQLite via Prisma | Postgres available via Docker in deploy phase |
| API style | REST + OpenAPI 3.1 | |

## Section 2 — Colors

Dark "agent ops console" theme (Ant `darkAlgorithm` + token overrides).
All values live in `src/theme.ts` — components reference tokens/classes only,
never hex literals. Every text/bg pair clears WCAG AA 4.5:1 (axe-gated).

| Token | Value | Use |
|---|---|---|
| `colorPrimary` | `#2DD4A7` (teal-green) | primary actions, accent dot/eyebrow |
| `colorLink` | `#4CC2FF` | links |
| `colorBgBase` / `colorBgLayout` | `#0B1016` | page background (dot-grid texture) |
| `colorBgContainer` | `#111823` | cards, table header |
| `colorTextBase` | `#E8EEF4` | body text |
| `colorTextSecondary` / `Description` | `#A9B7C6` | muted text, empty states |
| `colorBorder` | `#243244` | borders, chips |
| Button `primaryColor` | `#08110D` | dark text on bright primary (contrast) |

Deliberately NOT: purple gradients, cream/serif editorial styling, or stock
light-console look — house style is dark, technical, restrained glow.

## Section 3 — Typography

# Section 3 — Typography
- Families (max 2): System UI default for prose + `ui-monospace/JetBrains Mono/Consolas`
  for technical accents (eyebrow labels, status tags, dates, count chips — via
  `.mono-cell` / `.eyebrow` classes and `mono` export in `src/theme.ts`).
- Body Size: 14px (minimum per policy)
- Heading Scale: hero h1=56px/700/-0.02em, page h2=24px/600, h3=18px/500
- Body Weight: `fontWeightRegular` (400)
- Strong/Meta Weight: `fontWeightStrong` (600)
(Strictly max 2 families. Ant Design `fontFamily` token applied globally.)

## Section 4 — Spacing

# Section 4 — Spacing
- Page/Region Padding: 32px
- Component/Card Padding: 24px
- Form Item Margin: 16px vertical, 0 horizontal
- Table Cell Padding: 16px
- Button Height: 40px (default Ant)
- Gaps/Breaks: 8px (tight), 16px (standard), 32px (section separators)
(All values strictly on 4/8/16/24/32 grid.)

## Section 5 — Components

> Established as the coder agent builds. Every new component must be listed here with: name, location, props, when to use.

## Section 6 — Error handling

## Section 6 — Error Handling Patterns

### Layer 1: API Error Envelope
All backend failures return a unified JSON envelope matching the OpenAPI `ErrorEnvelope` schema:
```json
{
  "code": "VALIDATION_FAILED",
  "message": "Agent name is required."
}
```
- Use HTTP status codes semantically (`400` for validation, `404` for missing entities, `500` for unhandled server errors).
- Never return raw stack traces or internal field names.
- Validation failures must include the failing field name in metadata (optional extension) but keep the envelope minimal per spec.

### Layer 2: Express Error Middleware
Centralized middleware (`src/backend/middleware/errorHandler.ts`):
```typescript
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';
  const message = status === 500 ? 'An unexpected error occurred. Please try again.' : (err.message || 'Request failed.');
  res.status(status).json({ code, message });
});
```
- Catches synchronous/async errors from route handlers.
- Strips internal stack traces; logs full error to console in `NODE_ENV !== 'production'`.
- Express default handler is disabled to prevent framework leakage.

### Layer 3: Frontend Fetch Wrapper & UI Feedback
A single `src/frontend/api/fetchWrapper.ts` intercepts all HTTP responses:
```typescript
export async function fetchJson<T>(url: string, opts?: RequestInit): Promise<T> {
  const res = await fetch(url, { ...opts, headers: { 'Content-Type': 'application/json', ...opts?.headers } });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ code: 'NETWORK_ERROR', message: 'Request failed.' }));
    throw new ApiError(res.status, err.code, err.message);
  }
  return res.json();
}
```
**UI Feedback Rules (Ant Design):**
- **Validation errors:** `form.setFields([{ name: ['fieldName'], errors: [error.message] }])` using Ant's internal form state.
- **Network/Server errors on list pages:** `<Alert type="error" message={err.message} banner action={<Button>Retry</Button>} />`
- **Fatal/Unrecoverable errors:** `message.error({ key: 'global-error', content: err.message, duration: 6 });` (single instance, dismissible).
- All error text uses `colorError` token via Ant's theme context. No custom colors or inline styles.

## Section 7 — Writing standards

- **Code comments:** explain WHY, not WHAT. No academic tone.
- **UI copy:** Apple/Mailchimp style. Specific button labels ("Save changes", not "Submit"). Actionable error messages.
- **Docs:** Google/AWS imperative voice. Code first, theory second.

## Section 8 — Visual design (Option A: Ant Design, dark console theme)

- Colors: theme tokens from `src/theme.ts` only (Section 2). No hex in components.
- Typography: system UI + mono accents per Section 3.
- Spacing: 8pt grid.
- Texture: page-level dot grid + top aurora glow (`src/styles.css`, decorative
  only, `pointer-events: none`, never behind body text at AA-relevant contrast).
- Elevation: Ant `boxShadow` tokens; the one custom glow (eyebrow status dot)
  is decorative and `aria-hidden`.
- Accessibility: WCAG AA, 4.5:1 minimum contrast — enforced by axe-core e2e.

## Section 9 — Anti-patterns (always forbidden)

- Field injection (`@Autowired` on fields) → use constructor injection.
- Inline styles (`style="..."`).
- CSS `!important`.
- Hardcoded hex colors.
- Random spacing not on the 8pt grid.
- Direct entity exposure in REST responses (use DTOs).
- Two utilities doing the same job (e.g. `formatDate` and `dateFormat`).
- Hardcoded user-facing strings — must go through i18n once enabled.
