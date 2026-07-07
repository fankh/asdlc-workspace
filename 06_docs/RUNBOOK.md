# Pipeline Runbook (Windows-first)

Fresh clone → running app at http://localhost:8088, plus recovery procedures.

## Prerequisites

- Node.js 20+, Python 3.11+, Git for Windows (bundled bash runs the hooks)
- LLM: an Anthropic API key **or** a local Ollama with a capable model
  (recommended: `ollama pull qwen2.5-coder:32b` or `qwen3.6`; avoid
  `llama3:70b` for codegen)
- Docker Desktop (WSL2 backend) — only needed for the deploy phase
- `git config core.longpaths true` recommended on Windows

## One-time setup

```powershell
git clone https://github.com/fankh/asdlc-workspace
git clone https://github.com/fankh/discovery-agent   # sibling, optional
cd asdlc-workspace
git checkout -b dev                    # pre-commit blocks direct commits to main
git config core.hooksPath .githooks

copy .env.example .env                 # then edit:
#   LLM_PROVIDER=anthropic + LLM_API_KEY=sk-ant-...   (best quality)
#   or LLM_PROVIDER=ollama + OLLAMA_MODEL=qwen2.5-coder:32b

python -m venv .venv
.venv\Scripts\pip install anthropic pyyaml python-dotenv pdfplumber python-docx jsonschema pytest requests openapi-spec-validator

cd 04_source\frontend && npm install && npx playwright install chromium && cd ..\..
cd tools\ui-test-agent && npm install && cd ..\..
```

## Running the pipeline

```powershell
# 1. Drop input documents (PDF/DOCX/MD/TXT/HWP) into 00_input\
# 2. Advance the whole pipeline (or stop at a phase):
.venv\Scripts\python run-pipeline.py run
.venv\Scripts\python run-pipeline.py run --stop-after specs        # or architecture | code | test
.venv\Scripts\python run-pipeline.py status                        # stage/marker/cost table
.venv\Scripts\python run-pipeline.py reset                         # wipe markers + state

# On-demand: crawl a live app into backlog tickets (needs Anthropic key)
.venv\Scripts\python run-pipeline.py run --stage discover
```

Each completed stage writes its folder's `.status_done` marker and (with
`PIPELINE_AUTO_COMMIT=true`) one git commit. Progress and per-stage LLM cost
live in `.pipeline/state.json`.

## Deploy + smoke test

```powershell
docker compose up --build -d          # app at http://localhost:8088
powershell scripts\smoke.ps1          # build, boot, Playwright + AI-vision smoke, teardown
```

## Failure playbook

| Symptom | Fix |
|---|---|
| `HUMAN_INTERVENTION_REQUIRED` in status | QA stayed red after 5 refinement loops. Read `05_test_reports/REPORT.md`, fix the code manually (tests are the contract — don't edit `e2e/`), then run `run --stage qa`. Clear the flag by editing `.pipeline/state.json` (`human_intervention_required: false`, `refinement_loops: 0`). |
| Stage FAILED: schema still failing (Ollama) | The local model can't hold the output schema. Use a stronger model (`qwen2.5-coder:32b`) or switch that run to Anthropic. |
| `LLM_PROVIDER=anthropic but ... placeholder` | Put a real key in `.env` or set `LLM_PROVIDER=ollama`. |
| Playwright: `webServer ... exited early` | Backend failed to boot: `cd 04_source/backend && npm run dev` and read the error. Usually a Prisma schema/seed mismatch — rerun `npx prisma db push --force-reset` + `npm run db:seed`. |
| Ports 3000/3001 already in use | Kill strays: `taskkill /F /IM node.exe` (QA normally cleans up its own servers). |
| Vision checks all `skipped` | Expected on Ollama (no vision model). Playwright + axe still gate; add an Anthropic key for the vision layer. |
| Auto-commit skipped on main | By design. Work on a branch (`git checkout -b dev`). |

## Ollama validation results (2026-07-07, qwen3.6 24GB)

The full pipeline ran end-to-end on `qwen3.6:latest` with zero API cost:

- **Works on Ollama**: every stage completed — ingestion, product (11 Gherkin
  scenarios), design, architect (valid OpenAPI 3.1), both coders, testgen,
  secops, QA, docs. Structured outputs up to 32k tokens held schema.
- **Speed**: codegen stages take 10–30+ min each; a full run is hours, not
  minutes. Use `--stop-after` to iterate on one phase at a time.
- **Quality line**: the refinement loop auto-fixed a Prisma/SQLite enum bug,
  TypeScript errors, a nested-Router crash (loop 4), and WCAG contrast tokens
  — but exhausted its 5 loops on selector/copy-level issues and needed one
  round of human intervention to reach 28/28 green. Expect the same: Ollama is
  solid for specs/design/docs, workable-with-supervision for code/refinement.
- **No vision**: ui-test-agent runs its Playwright/axe layers and marks
  AI-vision observes `skipped`. Add an Anthropic key for the full oracle.
- Anthropic-only features: `--stage discover` (Claude vision crawler), vision
  observes/ux_review, Batch API, prompt caching.

## Cost expectations (Anthropic path)

- Full pipeline run: ~$6–15 all-Sonnet; ~$12–30 with Opus for coder/refinement.
- Refinement loops are the wildcard: ~$1–4 per loop. `--stop-after` avoids
  paying for stages you aren't iterating on.
- Prompt caching (CODING_PATTERNS.md + agent prompt as cached system blocks)
  cuts repeat input cost ~90%; verify via `usage` in `.pipeline/state.json`.
  Note: prefixes under ~2048 tokens (Sonnet 4.6) silently don't cache.
- `PIPELINE_PARALLEL_AGENTS=true` routes fan-out stages through the Batch API
  at 50% price (Anthropic only).
