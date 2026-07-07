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

# Section 2 — Colors
- Primary Actions & Links: `colorPrimary`
- Base Text: `colorTextBase`
- Muted/Placeholders/Accents: `colorTextSecondary`
- Error/Validation: `colorError`
- Container/Card Backgrounds: `colorBgContainer`
- Page Background (B2B Console): `colorBgLayout`
- Borders: `colorBorder`
(All values resolved via Ant Design theme provider; zero hex literals.)

## Section 3 — Typography

# Section 3 — Typography
- Families: System UI default (`-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif`) + Monospace fallback for technical payloads only (not used in current scope).
- Body Size: 14px (minimum per policy)
- Heading Scale: h1=24px/600, h2=20px/600, h3=18px/500
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

> One pattern per layer. Established by Architect + first Coder run. Must be filled in before second feature.

## Section 7 — Writing standards

- **Code comments:** explain WHY, not WHAT. No academic tone.
- **UI copy:** Apple/Mailchimp style. Specific button labels ("Save changes", not "Submit"). Actionable error messages.
- **Docs:** Google/AWS imperative voice. Code first, theory second.

## Section 8 — Visual design (Option A: Ant Design)

- Colors: Ant Design palette only.
- Typography: Ant defaults.
- Spacing: 8pt grid.
- Elevation: Ant `boxShadow` tokens only — no custom shadows.
- Accessibility: WCAG AA, 4.5:1 minimum contrast.

## Section 9 — Anti-patterns (always forbidden)

- Field injection (`@Autowired` on fields) → use constructor injection.
- Inline styles (`style="..."`).
- CSS `!important`.
- Hardcoded hex colors.
- Random spacing not on the 8pt grid.
- Direct entity exposure in REST responses (use DTOs).
- Two utilities doing the same job (e.g. `formatDate` and `dateFormat`).
- Hardcoded user-facing strings — must go through i18n once enabled.
