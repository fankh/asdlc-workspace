# 05_test_reports/

The pass/fail signal that gates the rest of the pipeline. The QA Agent writes here; the Refinement Agent reads here.

| Property | Value |
|---|---|
| **Goes here** | `junit.xml`, `results.json`, `playwright/` (HTML report), `security-audit.json` |
| **Produced by** | QA Agent (`mvn test`, `npx playwright test`), SecOps Agent |
| **Consumed by** | Refinement Agent (on fail) → patches `04_source/` and re-runs |
| **Advances when** | All tests green AND security-audit clean → `06_docs/.status_done` is written |

## Files you'll see here

| File | Origin |
|---|---|
| `junit.xml` | Backend unit + integration tests (Maven Surefire format) |
| `results.json` | Playwright JSON reporter — the canonical pass/fail record |
| `playwright/index.html` | Playwright HTML report (browse failures with screenshots/traces) |
| `security-audit.json` | SecOps Agent — SAST findings, dependency CVEs |
| `axe-violations.json` | Accessibility violations from `@axe-core/playwright` |

## Path config

`04_source/frontend/playwright.config.ts` is configured to write reports here:

```typescript
reporter: [
  ['html', { outputFolder: '../../05_test_reports/playwright' }],
  ['json', { outputFile: '../../05_test_reports/results.json' }],
  ['junit', { outputFile: '../../05_test_reports/junit.xml' }],
],
```

## The refinement loop

If `results.json` shows failures, the Refinement Agent reads the failing test names + stack traces, patches `04_source/`, deletes `05_test_reports/.status_done`, and the QA Agent runs again. Bounded by `PIPELINE_MAX_REFINEMENT_LOOPS=5` in `.env` — beyond that, `HUMAN_INTERVENTION_REQUIRED` halts the loop.

## Empty?

Means the QA Agent hasn't run, or the Coder Agent hasn't produced anything for it to test. The seeded Playwright tests in `../04_source/frontend/e2e/` will write here on first run — see `../README.md` "first runnable thing".
