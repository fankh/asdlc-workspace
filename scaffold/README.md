# ASDLC Workspace — Bootstrap

Local AI-agent development pipeline with real-UI testing. Maps to the seven definitions in `../01-PIPELINE_ARCHITECTURE.md` and `../07-UI_TESTING_GUIDE.md`.

## What's wired up

| # | Definition | File |
|---|---|---|
| 1 | LLM execution mode | `.env.example` |
| 2 | Project type | `.pipeline/config.yaml` (`project.type`) |
| 3 | Success contract | `02_specs/PRODUCT_BACKLOG.md`, `04_source/frontend/playwright.config.ts`, `04_source/frontend/e2e/`, `scenarios/home.yaml` |
| 4 | Pattern source of truth | `CODING_PATTERNS.md` |
| 5 | Workspace + state machine | `00_input/` … `06_docs/`, `.pipeline/state.json` |
| 6 | Refinement circuit breaker | `.env.example` (`PIPELINE_MAX_REFINEMENT_LOOPS`), `.pipeline/config.yaml` |
| 7 | Pre-commit gates | `.githooks/pre-commit` |

## Bootstrap (first runnable thing)

```bash
# 1. Pick LLM mode
cp .env.example .env
# edit LLM_PROVIDER (anthropic | ollama) and LLM_API_KEY

# 2. Confirm project type in .pipeline/config.yaml — must be one of:
#    website | sns | ide | appliance | b2b_console | secops_console

# 3. Install + run Playwright against an empty 04_source/
cd 04_source/frontend
npm install
npx playwright install
npx playwright test
# Expect: RED. That proves the test oracle works before any code is generated.

# 4. Wire pre-commit hook (once)
cd ../..
git init
git config core.hooksPath .githooks
chmod +x .githooks/pre-commit
```

If step 3 goes red on the right assertion (page not reachable / heading missing), the feedback loop is sound and you can let the coding agent loose on `04_source/`.

## State machine

Phases advance when a `.status_done` marker appears in the corresponding directory:

```
00_input/         → 01_requirements/.status_done
01_requirements/  → 02_specs/.status_done
02_specs/         → 03_architecture/.status_done
03_architecture/  → 04_source/.status_done
04_source/        → 05_test_reports/.status_done
05_test_reports/  → 06_docs/.status_done   (only if QA passed)
```

`.pipeline/state.json` tracks the current phase. Refinement loop is bounded by `PIPELINE_MAX_REFINEMENT_LOOPS`; on overflow it writes `HUMAN_INTERVENTION_REQUIRED` and stops.

## Audit checkpoint — 2026-05-10

Two weeks after bootstrap. Put this on your calendar and run these by hand — the workspace is local-only, so a remote scheduled agent can't help here.

```bash
# 1. Did anything actually happen?
cd /home/khchoi/new-research/development-pipeline-agents/asdlc-workspace
ls 04_source/frontend/src 2>/dev/null || echo "still a stub — no app code yet"
git -C .. log --since=2026-04-26 -- asdlc-workspace/ --oneline 2>/dev/null

# 2. Does the test oracle still go RED on the right assertion?
cd 04_source/frontend && npx playwright test --reporter=line

# 3. Are there discovered tickets to act on?
ls ../../01_requirements/discovered/tickets/ 2>/dev/null | head
```

**Decide:**
- **Workspace alive** (commits exist, tickets in `01_requirements/discovered/`) → continue with the next pending ticket.
- **Workspace stalled** (no commits, no tickets) → either run the sibling [`discovery-agent`](https://github.com/fankh/discovery-agent) against a real target to seed the backlog, or hand the coder agent `02_specs/PRODUCT_BACKLOG.md` STORY-001 directly.

