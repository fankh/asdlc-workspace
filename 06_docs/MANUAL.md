# ASDLC Pipeline — User Manual

How to use this workspace to turn a requirements document into a tested,
deployed web application — and how to keep iterating on it.

Companion docs: [RUNBOOK.md](RUNBOOK.md) (setup details, failure playbook,
costs) · [README](../README.md) (architecture overview).

---

## 1. What this is

A local AI software factory. You provide **input documents** (RFP, product
brief, meeting notes) and the pipeline runs a chain of LLM agents through a
seven-folder state machine:

```
00_input          your documents (PDF / DOCX / HWP / MD / TXT)
  └▶ 01_requirements   Ingestion agent → normalized requirements
      └▶ 02_specs           Product agent → Gherkin backlog (THE CONTRACT)
          └▶ 03_architecture     Design + Architect agents → UI specs, OpenAPI, ADRs
              └▶ 04_source           Coder + Testgen agents → app + Playwright tests
                  └▶ 05_test_reports     SecOps + QA agents → gate (must be green)
                      └▶ 06_docs             Docs agent → user guide, API reference
```

Each folder gets a `.status_done` marker when its stage finishes; the
orchestrator always resumes from the first unfinished stage. Every completed
stage is auto-committed to git.

**The one rule that matters:** the Gherkin scenarios in
`02_specs/PRODUCT_BACKLOG.md` are the acceptance contract. The QA gate passes
only when every scenario passes as a Playwright test. Agents (and humans) fix
the *application*, never the tests.

---

## 2. One-time setup

```powershell
git clone https://github.com/fankh/asdlc-workspace && cd asdlc-workspace
git checkout -b dev                       # pre-commit hook blocks commits to main
git config core.hooksPath .githooks

copy .env.example .env                    # then edit — see below

python -m venv .venv
.venv\Scripts\pip install anthropic pyyaml python-dotenv pdfplumber python-docx jsonschema pytest requests openapi-spec-validator

cd 04_source\frontend && npm install && npx playwright install chromium && cd ..\..
cd tools\ui-test-agent && npm install && cd ..\..
```

### Choosing the LLM in `.env`

| Setting | Cloud (recommended for codegen) | Local (free) |
|---|---|---|
| `LLM_PROVIDER` | `anthropic` | `ollama` |
| Credentials | `LLM_API_KEY=sk-ant-...` | — |
| Model | `LLM_MODEL=claude-sonnet-4-6` | `OLLAMA_MODEL=qwen2.5-coder:32b` or `qwen3.6` |
| Speed / quality | minutes per stage, strong refinement | 10–30+ min per code stage, may need a human assist |
| Extras | prompt caching, Batch API, vision tests, `discover` stage | vision checks auto-skip |

Other knobs: `PIPELINE_MAX_REFINEMENT_LOOPS` (default 5),
`PIPELINE_AUTO_COMMIT` (one commit per stage), `PIPELINE_PARALLEL_AGENTS`
(routes fan-out stages through the 50%-price Batch API, Anthropic only).

Project shape lives in `.pipeline/config.yaml`: project type
(`b2b_console`, `website`, …), which agents are enabled, backend framework
(`express` implemented; pluggable), and the refinement circuit breaker.

---

## 3. Everyday workflows

### 3.1 Build a new application

1. Drop one or more source documents into `00_input/`
   (one file per document; name them meaningfully).
2. Run the pipeline:

   ```powershell
   .venv\Scripts\python run-pipeline.py run
   ```

3. Watch progress any time from another terminal:

   ```powershell
   .venv\Scripts\python run-pipeline.py status
   ```

   ```
   stage          folder            marker  state
   ingest         01_requirements   yes     done
   product        02_specs          yes     done
   ...
   refinement loops: 0 / 5
   total LLM cost:   $0.0413
   ```

4. When every stage is `done`, deploy:

   ```powershell
   docker compose up --build -d      # → http://localhost:8088
   powershell scripts\smoke.ps1      # full build+boot+test+teardown check
   ```

**Work phase-by-phase instead** (recommended while you're learning the
pipeline, mandatory patience on Ollama):

```powershell
run-pipeline.py run --stop-after specs         # review 02_specs/PRODUCT_BACKLOG.md
run-pipeline.py run --stop-after architecture  # review openapi.yaml + ADRs
run-pipeline.py run --stop-after code          # review the generated app
run-pipeline.py run --stop-after test          # QA gate + refinement loop
run-pipeline.py run                            # docs, finish
```

Reviewing the backlog after `--stop-after specs` is the highest-leverage
checkpoint: everything downstream is built and tested against it. Edit the
Gherkin there if the stories miss the point, then continue.

### 3.2 Change or extend the application (maintenance mode)

Once `04_source/` contains generated code, the pipeline **auto-detects
maintenance mode** (`.pipeline/config.yaml` `mode: new` + existing app →
maintenance). Every agent switches from "generate" to "evolve":

| Agent | New mode | Maintenance mode |
|---|---|---|
| Product | writes fresh backlog | keeps existing stories/IDs verbatim, **appends** new ones |
| Design | establishes CODING_PATTERNS tokens | tokens **frozen**; UI specs only for new stories (skips cleanly if none) |
| Architect | full OpenAPI + ADRs | preserves every live path/schema (no breaking changes), additive ADRs |
| Coders | full app + scaffold | **delta only** — returns just changed/new files, scaffold untouched |
| Testgen | specs for all stories | specs only for uncovered stories; refuses to overwrite shipped specs; merges test-map |

The change workflow:

1. **Change the input** — add/edit documents in `00_input/`, run
   `--stage discover` or `--stage audit` to generate tickets, or edit
   `02_specs/PRODUCT_BACKLOG.md` directly.
2. Clear markers from the first affected stage onward, e.g. for a spec change:

   ```powershell
   del 02_specs\.status_done, 03_architecture\.status_done, 04_source\.status_done, 05_test_reports\.status_done, 06_docs\.status_done
   ```

3. `run-pipeline.py run` — stages re-run in maintenance mode and the QA gate
   re-verifies the **whole** contract (old stories + new), so regressions
   can't slip through.

Small manual code edits remain fine too — `run --stage qa` protects you.

### 3.2b Hunt for problems (audit mode)

Beyond the contract, the audit stage actively probes a running app for
defects the tests never asserted:

```powershell
# against the deployed container:
$env:AUDIT_URL="http://localhost:8088"; .venv\Scripts\python run-pipeline.py run --stage audit
# or with no AUDIT_URL it boots the dev servers itself
```

What it checks:
- **UI probe** (real browser, every route from `App.tsx`): console/page
  errors, failed network requests, **all** axe-core violations at any impact
  (incl. best-practice rules), broken internal links.
- **API probe** (driven by `03_architecture/openapi.yaml`): invalid payloads
  must return 4xx with the error envelope (never 500), unknown resource ids
  and routes must 404 cleanly.

Raw findings land in `05_test_reports/audit/findings.json`; the LLM triages
them (dedupes, drops noise) into `01_requirements/discovered/tickets/PROBLEM-*.md`
with Gherkin reproduction scenarios, plus a human summary in
`05_test_reports/audit/AUDIT.md`. Delete `02_specs/.status_done` and `run`
to fold the tickets into the backlog — audit → tickets → maintenance run →
green QA is the full self-improvement loop.

The audit stage never fails on findings — finding problems is its job.

### 3.3 Mine an existing app for requirements (discovery)

With the app running (dev servers or compose) and an Anthropic key set:

```powershell
run-pipeline.py run --stage discover
```

The sibling `discovery-agent` crawls the UI with a real browser + Claude
vision and writes deduplicated tickets to `01_requirements/discovered/tickets/`.
Delete `02_specs/.status_done` and `run` again to fold the tickets into the
backlog — this is how the cycle feeds itself.

### 3.3b Automatic development loop (watch mode)

Instead of running the pipeline by hand, let it run itself. Watch mode polls
for work and runs the whole maintenance cycle when it finds any:

```powershell
run-pipeline.py watch --interval 300 --deploy
```

- Watches `00_input/` — a changed/new document → re-runs from the **ingest**
  stage.
- Watches `01_requirements/discovered/tickets/` — new tickets (from
  `--stage discover` or `--stage audit`) → re-runs from the **product** stage.
- On a green run with `--deploy`, it rebuilds and restarts the container at
  http://localhost:8088.
- If the refinement circuit breaker trips (`HUMAN_INTERVENTION_REQUIRED`), the
  loop **idles** and logs it rather than thrashing — clear the flag (see §4)
  and it resumes on the next tick.
- A lockfile (`.pipeline/watch.lock`) guarantees only one watcher runs even if
  started twice. Activity is logged to `.pipeline/watch.log`.

The first tick records a baseline and does nothing, so enabling it on an
already-built workspace won't trigger a rebuild.

**Run it at logon (Windows, no admin):** `scripts/auto-dev.cmd` launches the
watcher minimized; a shortcut to it in the Startup folder
(`shell:startup`) starts it automatically each logon. To run once manually:
double-click `scripts/auto-dev.cmd`. To stop: end the `pythonw.exe` running
`run-pipeline.py watch` (Task Manager) or delete `.pipeline/watch.lock` after
killing it.

> On the local Ollama a triggered cycle can take **hours** and may still need a
> human-intervention round on hard changes (see §4). Watch mode is
> "fire-and-forget with a safety net", not instant CI. With an Anthropic key it
> becomes minutes per cycle.

### 3.3c Pipeline control panel (web screen)

Instead of the CLI, manage the pipeline from a browser:

```powershell
run-pipeline.py serve            # dashboard at http://localhost:8099
```

The dashboard shows live **stage status** (per-marker, colour-coded), refinement
loops, LLM cost, mode (new/maintenance), ticket/deferred counts, and the last QA
result. From it you can **trigger runs** (full, `--stop-after` specs/architecture/
code/QA, audit, discover, reset) and **start/stop the watch and improve loops** —
all as safe whitelisted actions (one job at a time, bound to localhost). A log
viewer tails the active job / watch / improve logs. If a run trips
`HUMAN_INTERVENTION_REQUIRED`, a banner explains it.

### 3.4 Run a single stage

```powershell
run-pipeline.py run --stage qa        # re-verify after manual code edits
run-pipeline.py run --stage secops    # dependency audit + secret scan only
run-pipeline.py run --stage docs      # regenerate documentation
```

### 3.5 Verify the UI like we do

```powershell
# full e2e contract against the deployed container
cd 04_source\frontend
$env:BASE_URL="http://localhost:8088"; $env:NO_WEB_SERVER="1"; npx playwright test

# AI-vision scenario runner (scenarios/*.yaml)
cd ..\..\tools\ui-test-agent
npm run test -- --base-url http://localhost:8088
```

Note: the e2e suite performs real CRUD (one test empties the agent list).
Restore demo data afterward with
`docker exec asdlc-workspace-backend-1 npm run db:seed`.

---

## 4. When the pipeline stops

### QA red → refinement loop (automatic)

A failing QA gate triggers the refinement agent: it reads
`05_test_reports/report.json`, patches application source (never tests), and
re-runs QA — up to `PIPELINE_MAX_REFINEMENT_LOOPS` times.

### Circuit breaker → your turn

If loops run out, the run halts with `HUMAN_INTERVENTION_REQUIRED`
(visible in `status`). Then:

1. Read `05_test_reports/REPORT.md` — failures listed per test with errors.
2. Fix the app code under `04_source/` (tests are the contract; only fix a
   test when its *selector* is objectively broken, not its expectation).
3. Clear the flag in `.pipeline/state.json`
   (`human_intervention_required: false`, `refinement_loops: 0`).
4. `run-pipeline.py run --stage qa` until green, then `run` to continue.

The full failure table (ports, Prisma, Ollama quirks) is in
[RUNBOOK.md](RUNBOOK.md#failure-playbook).

---

## 5. Where things live

| You want | Look in |
|---|---|
| The acceptance contract | `02_specs/PRODUCT_BACKLOG.md` |
| API contract | `03_architecture/openapi.yaml` |
| Architecture decisions | `03_architecture/adr/` |
| The generated app | `04_source/frontend`, `04_source/backend` |
| Test results | `05_test_reports/REPORT.md`, `playwright/` HTML report |
| Security findings | `05_test_reports/security/report.json` |
| AI-vision results + screenshots | `05_test_reports/ui/` |
| Progress, loop count, LLM spend | `.pipeline/state.json` / `status` command |
| Design system rules agents obey | `CODING_PATTERNS.md` |
| Generated end-user docs | `06_docs/USER_GUIDE.md`, `06_docs/API_REFERENCE.md` |

## 6. Command reference

```
run-pipeline.py run                     advance through all remaining stages
run-pipeline.py run --stop-after X     halt after stage/alias (specs|architecture|code|test)
run-pipeline.py run --stage X          run exactly one stage (incl. discover, audit)
run-pipeline.py run --dry-run          walk stages as no-ops (exercises markers)
run-pipeline.py watch [--interval N] [--deploy] [--once]   automatic dev loop
run-pipeline.py improve [--target URL] [--interval N] [--once]   self-improvement loop
run-pipeline.py serve [--port 8099]     web control panel (status + run/loop controls)
run-pipeline.py status                 stage table + refinement loops + cost
run-pipeline.py reset                  clear all markers and state — full redo
pytest tests/                          pipeline's own unit tests
docker compose up --build -d           deploy the generated app on :8088
scripts\smoke.ps1                      build + boot + smoke + teardown
```

## 7. Practical tips

- **Branch first.** The pre-commit hook blocks commits to `main`/`master` by
  design; auto-commit silently skips there too.
- **Commit your own edits before `run`** — stage auto-commits use `git add -A`
  and will sweep uncommitted changes into a "pipeline: …" commit.
- **On Ollama, budget hours not minutes** for code stages, and expect to play
  the human-intervention role once per app. Details and model recommendations:
  RUNBOOK "Ollama validation results".
- **Review at `--stop-after specs`.** Fixing a wrong story costs one file
  edit there; downstream it costs a regeneration.
- **Port 8088** is the deployed app; dev servers use 3000 (frontend) and
  3001 (backend). Change the mapping in `docker-compose.yml` if taken.
