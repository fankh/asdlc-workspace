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

### 3.2 Change or extend the application

The contract drives everything, so changes enter through the specs:

1. **Change the input** — edit/add documents in `00_input/`, or
   **change the contract directly** — edit `02_specs/PRODUCT_BACKLOG.md`.
2. Clear the markers from the first affected stage onward, e.g. for a spec
   change:

   ```powershell
   del 02_specs\.status_done 03_architecture\.status_done 04_source\.status_done 05_test_reports\.status_done 06_docs\.status_done
   ```

   (Or `run-pipeline.py reset` to redo everything from ingestion.)
3. `run-pipeline.py run` — downstream stages regenerate and the QA gate
   re-verifies the full contract.

> Current limitation: the coder agents regenerate from specs rather than
> patching incrementally. Small manual code edits are often faster for tiny
> tweaks — the QA gate (`run --stage qa`) still protects you either way.

### 3.3 Mine an existing app for requirements (discovery)

With the app running (dev servers or compose) and an Anthropic key set:

```powershell
run-pipeline.py run --stage discover
```

The sibling `discovery-agent` crawls the UI with a real browser + Claude
vision and writes deduplicated tickets to `01_requirements/discovered/tickets/`.
Delete `02_specs/.status_done` and `run` again to fold the tickets into the
backlog — this is how the cycle feeds itself.

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
run-pipeline.py run --stage X          run exactly one stage (incl. discover)
run-pipeline.py run --dry-run          walk stages as no-ops (exercises markers)
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
