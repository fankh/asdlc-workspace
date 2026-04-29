# 06_docs/

Generated, end-user-facing documentation. Only written after the QA gate passes.

| Property | Value |
|---|---|
| **Goes here** | `README.md`, `API_REFERENCE.md`, `USER_MANUAL.md` (or `.pdf`), `CHANGELOG.md` |
| **Produced by** | Documentation Agent, Localization Agent, Release Agent |
| **Consumed by** | Humans (end users, integrators) and the Marketing Agent |
| **Trigger** | All tests in `../05_test_reports/results.json` are green |

## Files you'll see here

| File | Origin |
|---|---|
| `README.md` | Doc Agent — generated from source code + OpenAPI spec |
| `API_REFERENCE.md` | Doc Agent — endpoint-by-endpoint reference from `../03_architecture/openapi.yaml` |
| `USER_MANUAL.md` | Doc Agent — task-oriented end-user guide, generated from Gherkin scenarios in `../02_specs/` |
| `CHANGELOG.md` | Release Agent — generated from git commit history (Conventional Commits format) |
| `i18n/<locale>.json` | Localization Agent — extracted strings, one file per locale enabled in `.pipeline/config.yaml` |

## Style mandate

Per `../CODING_PATTERNS.md` Section 7: write like Google / AWS / Microsoft / IBM, NOT like academic papers.

- Code examples first, theory second.
- Imperative voice: "Run this", "Configure that".
- Concise, scannable, actionable.
- No abstracts, literature reviews, or citations.

## Empty?

Means the QA gate hasn't passed yet. Docs are deliberately the *last* phase — generating documentation for code that fails its tests would lie to users.
