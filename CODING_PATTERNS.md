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
| Frontend framework | React + TypeScript | TBD by Architect agent |
| UI library | Ant Design | per Section 0 |
| Backend framework | Spring Boot (Java 17) | TBD by Architect agent |
| Database | PostgreSQL | TBD by Architect agent |
| API style | REST + OpenAPI 3.1 | |

## Section 2 — Colors

> Established when Design Agent runs. Until then, use Ant Design tokens only. No hex literals.

## Section 3 — Typography

> System UI fonts. Body 14px minimum. Max 2 families.

## Section 4 — Spacing

> 8pt grid (4 / 8 / 16 / 24 / 32 / 48). No 13px, 17px, 23px.

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
