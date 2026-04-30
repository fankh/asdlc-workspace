# Implementation Plan — Solo Edition

How to take this workspace from "scaffolded" to "actually runs end-to-end" as one person, working evenings and weekends.

This file is the **solo rescope** of `../ai-sdlc-research/06-implementation-plan.md`. The phase structure mirrors that plan so vocabulary stays consistent across the family of docs, but tools, budget, and deliverables are sized for one developer. If you have a 6-person team and $82-124K/month, read the source plan instead.

---

## 1. Status snapshot

The reader's TL;DR. Find the first row where status is `not started` — that's where you sit down to work next.

| # | Phase | Goal | Status | Evidence |
|---|---|---|---|---|
| 0 | Bootstrap | Workspace skeleton + test oracle + discovery-agent | ✅ done | `git log --oneline` on `main`; `discovery-agent/` at `fankh/discovery-agent` |
| 1 | Foundation | Orchestrator + Ingestion + Requirements | ⏳ not started | Targets: `run-pipeline.py`, `agents/ingestion.ts`, `02_specs/.status_done` |
| 2 | Architecture + Code | Architect + FE/BE Coder agents | ⏳ not started | Targets: `agents/architect.ts`, `04_source/.status_done`, first scenario green |
| 3 | Quality Gates | QA + SecOps + Refinement loop | ⏳ not started | Targets: `agents/qa.ts`, deliberate-bug fix in ≤5 loops, `05_test_reports/.status_done` |
| 4 | UI Testing + Local Deploy | Wire ui-test-agent + docker-compose + CI | ⏳ not started | Targets: `06_docs/.status_done`, container at `localhost:8080` |
| 5 | Optimization | Cache audit + Batch API + cost dashboard | ⏳ not started | Targets: `06_docs/RUNBOOK.md`, post-cache cost ≤30% of cold |

Update this table when a phase's exit criterion is met. The next phase becomes ⏳ in progress, the previous flips to ✅ done with the file/commit that proves it.

---

## 2. Reference & vocabulary

| You're reading | When to use it |
|---|---|
| **This file (`PLAN.md`)** | Day-to-day execution. What's next, what to build, how to verify. |
| `../ai-sdlc-research/06-implementation-plan.md` | Team-scale source-of-truth. Read when scaling up or hiring. |
| `../ai-sdlc-research/07-agent-specifications.md` | Per-agent system prompts + Zod schemas. Copy these into Phase 1-3 builds. |
| `../ai-sdlc-research/05-cost-analysis-and-risks.md` | Cost numbers and risk table. Source for §9 and §10 below. |
| `../04-LOCAL_EXECUTION.md` | Existing Python orchestrator scaffold (lines 160-428). Phase 1 build target. |
| `README.md` | Bootstrap guide — what's already here. |
| `ARCHITECTURE.md` | Runtime view of how planes/phases/agents fit. §10 lists the gap this PLAN fills. |
| `CODING_PATTERNS.md` | The constraint every agent reads first. Phase 2's prompt-cache wraps this. |

Phase numbers, agent names, and `.status_done` semantics are identical to the team plan and `01-PIPELINE_ARCHITECTURE.md`. Don't invent new vocabulary — it diverges fast.

---

## 3. Solo rescope — what's different from the team plan

| Dimension | Team plan | This plan |
|---|---|---|
| **People** | 6 (Tech Lead + 2 BE + 1 FE + 1 DevOps + 1 QA) | 1 |
| **Cadence** | 20 calendar weeks | Phases ordered, not timed. May stretch to months. |
| **Claude API budget** | $500-2,000/month | $20-80/month for dev runs |
| **State store** | PostgreSQL | `state.json` on local filesystem |
| **Artifact store** | S3/MinIO | Local filesystem (`05_test_reports/`, `04_source/`) |
| **SAST** | SonarQube | Semgrep OSS + ESLint + `tsc --strict` |
| **Dependency scan** | Snyk | `npm audit --audit-level=high` + `osv-scanner` |
| **Unit-test gen (Java)** | Diffblue Cover | Manual + Claude-generated |
| **Unit-test gen (TS)** | Qodo (CodiumAI) | Vitest scaffolds + Claude-generated |
| **PR review** | CodeRabbit + Greptile | Solo dev reviews own PR; trust the QA gate |
| **IaC** | Pulumi (cloud) | `docker-compose.yml` for local staging |
| **Monitoring** | OpenTelemetry + Grafana | `console.log` + the existing `pipeline.log` |
| **Multi-tenant** | Yes | No — one project per workspace clone |

### Things skipped entirely for solo

- Web-based human review UI — review your own PRs in GitHub
- Kubernetes / cloud deployment — Phase 4 stops at local Docker
- A2A protocol — Q3 2026 spec, not blocking solo work
- Jira/Confluence integration (`../06-JIRA_CONFLUENCE_INTEGRATION.md`) — solo dev doesn't need ticket sync
- Semantic caching layer — prompt caching alone gets you to ~70% savings; semantic caching adds engineering cost for diminishing returns at solo volume

The phase numbering and exit criteria stay identical — that's what makes this the same pipeline at a different staffing level.

---

## 4. Phase 1 — Foundation (Weeks 1-4)

**Goal:** Pipeline orchestrator runs. Document ingestion produces structured requirements. Product agent writes Gherkin stories the workspace's existing test oracle can consume.

**Status:** ⏳ not started

### Build

- [ ] **`run-pipeline.py`** — port lines 160-428 of `../04-LOCAL_EXECUTION.md`. Already 80% complete in source; just paste, fix the agent-runner stubs, and run.
- [ ] **`agents/ingestion.ts`** — wraps Docling (PDF/DOCX) + pyhwp (HWP) → JSON. System prompt from `../ai-sdlc-research/07-agent-specifications.md` §2.1.
- [ ] **`agents/requirements.ts`** — Claude Sonnet 4.6 + structured output (Zod schema in §2.2 of agent specs). Reads `01_requirements/RAW-PARSED-*.json`, writes `01_requirements/REQ_DATA.json`.
- [ ] **`agents/ambiguity.ts`** — flags `NEEDS_CLARIFICATION` items. Sonnet, cheap. §2.3 of agent specs.
- [ ] **`agents/product.ts`** — Sonnet. Reads `REQ_DATA.json`, writes Gherkin to `02_specs/PRODUCT_BACKLOG.md`. Existing Gherkin in that file is the format reference.
- [ ] **Wire `discovery-agent` as alternate input path** — orchestrator detects: if `00_input/` is empty AND `--url` is passed, run `fankh/discovery-agent` against the URL and skip ingestion. Tickets land in `01_requirements/discovered/` (already documented in that folder's README).
- [ ] **`agents/runner.ts`** — shared agent-class pattern. Mirror `../ui-test-agent/src/test-agent.ts` (entry class + `Result`-returning methods + structured logging). All other agents extend this.
- [ ] **Prompt caching wrapper** — every Claude call uses `cache_control: { type: "ephemeral" }` on the `CODING_PATTERNS.md` system prompt. Verify with `response.usage.cache_read_input_tokens > 0` after the second call.

### Validate

```bash
# Drop a test PDF + HWP into 00_input/
cp ~/test-fixtures/sample-rfp.pdf 00_input/
cp ~/test-fixtures/sample-rfp.hwp 00_input/

# Run Phase 1 only
python run-pipeline.py --stop-after specs

# Expected
test -f 02_specs/PRODUCT_BACKLOG.md && \
  grep -c "Scenario:" 02_specs/PRODUCT_BACKLOG.md  # ≥ 3 scenarios
test -f 02_specs/.status_done
```

**Numeric targets** (from `../ai-sdlc-research/05-cost-analysis-and-risks.md`):
- Requirement extraction accuracy: >85% (manual review of 10-20 requirements)
- Ambiguity detection rate: ≥ 1 flag per RFP page on average
- Stage cost: $5-15 per RFP

### Skipped for solo

- [ ] PostgreSQL state store — `state.json` is fine for one user
- [ ] MinIO artifact store — local FS
- [ ] Multi-document ingestion in parallel (process serially)

### Cost ceiling

| Agent | Model | Per RFP | Notes |
|---|---|---|---|
| Ingestion | Sonnet 4.6 | $1-3 | Cheap; mostly tool calls |
| Requirements | Sonnet 4.6 | $3-8 | Structured output, schema-validated |
| Ambiguity | Haiku 4.5 | $0.50-1 | Fast classifier |
| Product | Sonnet 4.6 | $2-5 | Gherkin generation |
| **Total** | | **$6-17** | First request without caching; subsequent ~30% cheaper |

### Exit criterion

`02_specs/.status_done` exists AND `02_specs/PRODUCT_BACKLOG.md` contains ≥ 3 Gherkin scenarios bound to user stories. Update §1 status table to ✅ done with the commit SHA.

---

## 5. Phase 2 — Architecture + Code Generation (Weeks 5-8)

**Goal:** Architect agent generates `openapi.yaml` + ADRs. Coder agents scaffold a working FE + BE skeleton that compiles and passes the seeded Playwright test (the one already in `04_source/frontend/e2e/home.spec.ts`).

**Status:** ⏳ not started

### Build

- [ ] **`agents/architect.ts`** — Claude **Opus 4.6** (complex reasoning worth the price). Reads `02_specs/`, writes `03_architecture/openapi.yaml`, `schema.sql`, and `ADRs/0001-*.md`. §2.5 of agent specs.
- [ ] **`agents/coder-frontend.ts`** — Sonnet 4.6. Reads OpenAPI + `CODING_PATTERNS.md`. Generates React+TypeScript scaffold under `04_source/frontend/src/`. Uses Orval to generate API client from OpenAPI.
- [ ] **`agents/coder-backend.ts`** — Sonnet 4.6. Generates Spring Boot scaffold under `04_source/backend/`. Uses OpenAPI Generator for server stubs.
- [ ] **Prompt-caching audit** — `CODING_PATTERNS.md` is the same prefix on every Coder call. Verify hits via `cache_read_input_tokens > 0` on call 2 onwards. Per `../ai-sdlc-research/05-cost-analysis-and-risks.md`, this is where caching pays off the most (~90% savings on the patterns prefix).
- [ ] **Validator agent** — Haiku 4.5. Reads generated source, scans for anti-patterns from `CODING_PATTERNS.md` §9. Flags violations as JSON; orchestrator decides reject/accept.
- [ ] **PR-as-checkpoint** — instead of building a web review UI, the orchestrator opens a PR after each Coder run. Solo dev reviews diff in GitHub; merging the PR is the "human approval" signal.

### Validate

```bash
# Run Phase 1 + 2
python run-pipeline.py --stop-after code

# Builds must succeed
cd 04_source/frontend && npm install && npm run build
cd 04_source/backend && mvn package

# First Gherkin scenario goes green
cd 04_source/frontend && npx playwright test home.spec.ts --grep "page loads"
```

**Numeric targets:**
- First-pass compile rate: >70% (team plan target is >80% — solo is allowed one round of fixes)
- `home.spec.ts` "page loads and shows product name" passes
- Validator findings: ≤ 5 violations after first run

### Skipped for solo

- [ ] Web-based human review UI — GitHub PR review is the equivalent
- [ ] Component diagram (Mermaid) — nice to have; defer to Phase 5 polish
- [ ] Multi-language backend (just Spring Boot for now; add NestJS only if a project demands it)

### Cost ceiling

| Agent | Model | Per app | Notes |
|---|---|---|---|
| Architect | Opus 4.6 | $10-25 | Worth the price; this is where structure is decided |
| Coder FE | Sonnet 4.6 | $15-40 | Caching pays back hard here |
| Coder BE | Sonnet 4.6 | $15-40 | Same |
| Validator | Haiku 4.5 | $1-3 | Cheap pattern check |
| **Total** | | **$41-108** | Drops to $15-30 with prompt caching working |

### Exit criterion

`04_source/.status_done` exists AND `npm run build` + `mvn package` exit zero AND `home.spec.ts` first scenario passes. Status table ✅ done.

---

## 6. Phase 3 — Quality Gates + Refinement Loop (Weeks 9-12)

**Goal:** QA + SecOps gates run automatically. Refinement loop (already wired in `.env.example`) actually fixes failures within the 5-iteration ceiling.

**Status:** ⏳ not started

### Build

- [ ] **`agents/qa.ts`** — runs `mvn test`, `npx playwright test`, `axe-core`. Writes `05_test_reports/junit.xml`, `results.json`, `playwright/index.html`. (Playwright config already points to those paths.)
- [ ] **`agents/secops.ts`** — Semgrep OSS (rules from registry + `auto`), `npm audit --audit-level=high`, `osv-scanner` against the lockfiles. Writes `05_test_reports/security-audit.json`.
- [ ] **`agents/test-generator.ts`** — Sonnet. Reads source + Gherkin scenarios, generates Vitest unit tests for FE and JUnit for BE. Targets >70% coverage (team plan is >80% — solo allows lower bar to keep iteration fast).
- [ ] **`agents/refinement.ts`** — Sonnet with thinking enabled. Reads `junit.xml` + failing diff, proposes minimal patch, applies it via the orchestrator, deletes `05_test_reports/.status_done` to re-trigger QA. Circuit breaker is `PIPELINE_MAX_REFINEMENT_LOOPS=5` (already in `.env.example`).
- [ ] **Pre-commit hook reuse** — `.githooks/pre-commit` already blocks `main` commits + secret patterns. SecOps agent should *invoke* this hook in CI mode (`pre-commit --all-files`) rather than reimplement the checks.

### Validate

```bash
# Inject a deliberate bug
echo "syntaxerror!" >> 04_source/frontend/src/App.tsx

# Pipeline should fix it
python run-pipeline.py --stop-after test

# Expected: refinement loop ran ≥1 time, ≤5 times, then turned green
test -f 05_test_reports/.status_done
jq '.refinement_loops' .pipeline/state.json   # ≥ 1, ≤ 5

# Security gate
test -f 05_test_reports/security-audit.json
jq '.findings | map(select(.severity == "critical")) | length' \
  05_test_reports/security-audit.json   # 0
```

**Numeric targets:**
- Refinement loop convergence: ≤3 iterations average (team target is ≤3, holds for solo)
- Critical/high security findings in final output: 0
- Test coverage: ≥70%

### Skipped for solo

- [ ] SonarQube — Semgrep covers most of what's actionable for solo
- [ ] Snyk — `npm audit` + `osv-scanner` cover OSS-known CVEs for free
- [ ] Diffblue Cover (Java unit-test gen) — Claude-generated tests are good enough at solo volume
- [ ] LLM-as-Judge formal eval framework — over-engineered for one user

### Cost ceiling

| Agent | Model | Per refinement cycle | Notes |
|---|---|---|---|
| QA | n/a (subprocess) | $0 | Just runs Maven + Playwright |
| SecOps | n/a (subprocess) | $0 | Semgrep + npm audit are free |
| Test gen | Sonnet 4.6 | $5-15 | One-time per feature |
| Refinement | Sonnet 4.6 + thinking | $3-8 per loop | × max 5 loops = $15-40 worst case |
| **Total** | | **$5-55** | Mostly bounded by refinement loop count |

### Exit criterion

`05_test_reports/.status_done` exists with all-green QA + zero critical/high security findings. The deliberate-bug test above passes. Status table ✅ done.

---

## 7. Phase 4 — UI Testing + Local Deployment (Weeks 13-16)

**Goal:** Full pipeline runs from `00_input/<rfp>` to a containerized app at `localhost:8080`, with E2E + AI vision + accessibility tests all green.

**Status:** ⏳ not started

### Build

- [ ] **Wire `../ui-test-agent/`** — already built and prototyped. Phase 4 work is *integration*, not rebuild: connect existing scenarios in `scenarios/home.yaml` to the Gherkin oracle in `02_specs/PRODUCT_BACKLOG.md` so they share a contract. Add scenario-generator agent that derives YAML from new Gherkin scenarios.
- [ ] **`agents/docs.ts`** — Sonnet 4.6. Reads source + OpenAPI spec, writes `06_docs/README.md`, `API_REFERENCE.md`, `USER_MANUAL.md`. §2.9 of agent specs. Apple/Mailchimp writing style per `CODING_PATTERNS.md` §7.
- [ ] **`docker-compose.yml`** — local staging. One service for frontend (Vite preview), one for backend (Spring Boot), one for Postgres. No Kubernetes, no cloud.
- [ ] **`.github/workflows/ci.yml`** — runs the full pipeline on PR. Solo dev's safety net for not breaking main.
- [ ] **discovery-agent post-deploy step** — after container is up, `discovery-agent` runs against `localhost:8080` and diffs the discovered tickets against the spec. Drift goes into `01_requirements/post-deploy-drift.md` for review.
- [ ] **End-to-end smoke test** — script that runs: `00_input/sample.pdf` → orchestrator → docker-compose up → discovery-agent → tear down. One command. This is the integration test for Phase 4.

### Validate

```bash
# End-to-end smoke
./scripts/smoke-test.sh ~/test-fixtures/sample-rfp.pdf

# Expected output:
# ✓ Phase 1 done in 8m
# ✓ Phase 2 done in 24m  (with prompt cache)
# ✓ Phase 3 done in 12m
# ✓ Container up at localhost:8080
# ✓ Playwright: 12/12 green
# ✓ ui-test-agent: 6/6 green
# ✓ axe-core: 0 critical, 0 serious
# ✓ discovery-agent drift: 0 unexpected components
# Total time: ~50m, total cost: $32

# Phase 4 exit
test -f 06_docs/.status_done
curl -s http://localhost:8080/health | jq -e '.status == "ok"'
```

**Numeric targets:**
- Total pipeline time: <90 minutes single-pass with caching (team target <3 hours)
- Total cost: <$50 with caching (team target <$150)
- UI test pass rate: 100% on golden path
- Accessibility violations (critical/serious): 0

### Skipped for solo

- [ ] Pulumi / AWS / GCP — local Docker only
- [ ] Kubernetes — docker-compose covers solo needs
- [ ] Grafana monitoring — `pipeline.log` + a simple `tail -f` is fine
- [ ] Multi-region deploy — N/A
- [ ] Health check monitoring as a service — manual `curl /health` post-deploy

### Cost ceiling

| Agent | Model | Per E2E run | Notes |
|---|---|---|---|
| Docs | Sonnet 4.6 | $5-15 | One-time per release |
| Scenario generator | Sonnet 4.6 | $3-8 | Derives YAML from Gherkin |
| ui-test-agent | Sonnet (vision) | $0.50-2 per scenario × 6 | Already prototyped |
| discovery-agent | Opus 4.7 | $1-5 | Post-deploy drift check |
| **Total** | | **$13-35** | Per full E2E run |

### Exit criterion

`06_docs/.status_done` exists, smoke test script passes, container responds at `localhost:8080`. Status table ✅ done.

---

## 8. Phase 5 — Optimization & Polish (Weeks 17-20)

**Goal:** Pipeline cost drops by ≥70% via prompt caching working correctly. Cost-tracking dashboard prints a per-stage breakdown. Runbook documents how to operate the pipeline.

**Status:** ⏳ not started

### Build

- [ ] **Prompt-caching audit script** — `scripts/cache-audit.py`. Replays a recent pipeline run, prints `cache_creation_input_tokens` vs `cache_read_input_tokens` per stage. Identifies silent invalidators (timestamps in system prompts, unsorted JSON, varying tool sets). Reference: `shared/prompt-caching.md` from claude-api skill.
- [ ] **Batch API integration** — for non-interactive stages (Ingestion, Requirements, Validator). 50% cost cut with no latency cost since these aren't user-facing. Use `client.messages.batches.create()`.
- [ ] **Cost dashboard** — `python scripts/cost-report.py` reads `.pipeline/pipeline.log`, prints per-agent + per-stage breakdown. No web UI.
- [ ] **`06_docs/RUNBOOK.md`** — written by the Docs agent in Phase 4 *or* manually. Sections: starting a run, watching progress, intervening when refinement halts, recovering from a stuck state, rolling back a deploy.
- [ ] **Model-deprecation guard** — single config (`.pipeline/models.yaml`) with the model IDs the pipeline uses. CI runs a daily `models.list()` check (or just `client.models.retrieve(id)`) and pings if any model is deprecated.

### Validate

```bash
# Re-run Phase 4's smoke test — should be cheaper than first run
./scripts/smoke-test.sh ~/test-fixtures/sample-rfp.pdf
python scripts/cost-report.py --last-run

# Expected:
# Cold-cache cost: $32 (Phase 4)
# Warm-cache cost: ≤ $10 (Phase 5 target — 30% of cold)
```

**Numeric targets:**
- Post-cache cost ≤30% of cold-cache cost (proves caching is working end-to-end)
- All stages with stable prefixes show `cache_read_input_tokens` > 0 after first run
- Batch API stages show 50% cost reduction vs synchronous
- `models.list()` reports zero deprecated model IDs in use

### Skipped for solo

- [ ] Multi-tenant — N/A, one project per workspace clone
- [ ] Semantic caching layer — diminishing returns at solo volume
- [ ] A2A protocol — not yet GA; revisit when Q3 2026 spec lands
- [ ] Jira/Confluence integration — solo dev tracks tickets in GitHub Issues
- [ ] Web dashboard — CLI report is enough

### Cost ceiling

| Item | Per audit | Notes |
|---|---|---|
| Cache audit | $0 | Reads logs only |
| Batch-API cost reduction | -50% on Ingestion + Requirements + Validator | Net savings |
| Cost dashboard | $0 | Local script |
| **Total** | **$0** | Phase 5 *saves* money, doesn't spend it |

### Exit criterion

`06_docs/RUNBOOK.md` exists, cost-report shows post-cache run ≤30% of cold-cache run, model-deprecation check passes. Status table ✅ done.

---

## 9. Success metrics rolled up

Mirror of `../ai-sdlc-research/06-implementation-plan.md §4` with solo-realistic numbers.

| Metric | Team target | Solo target | How to measure |
|---|---|---|---|
| RFP → requirements accuracy | >90% capture | >85% | Manual review of 10 RFPs |
| Requirements → code first-pass compile | >80% | >70% | `npm run build` + `mvn package` exit codes |
| Test coverage on generated code | >80% | >70% | Vitest + JaCoCo reports |
| Critical/high security findings | 0 | 0 | Semgrep + osv-scanner |
| Refinement loop convergence | <3 iterations avg | <3 iterations avg | `.pipeline/state.json:refinement_loops` |
| Total pipeline time (single pass) | <3 hours | <90 min | Smoke-test wallclock |
| Cost per application run | <$150 with caching | <$50 with caching | `cost-report.py` |
| Accessibility violations | 0 critical/serious | 0 critical/serious | axe-core report |

The bar is lower for solo on coverage and compile rate because you're allowed one manual round of fixes — the pipeline doesn't need to be perfect on first try when you'll personally review every PR.

---

## 10. Risk register (solo edition)

Only the risks that survive at solo scale. Reference: `../ai-sdlc-research/05-cost-analysis-and-risks.md` for full team-scale list.

| Risk | Probability | Impact | Mitigation |
|---|---|---|---|
| Refinement loop not converging | Medium | Medium | Circuit breaker at 5 iterations (`.env.example`); falls back to `HUMAN_INTERVENTION_REQUIRED`. Solo dev reviews and fixes manually. |
| Prompt cache silent invalidation | High | Medium | Phase 5 cache-audit script catches this. Per `shared/prompt-caching.md`: avoid `Date.now()` in system prompts, sort JSON keys, freeze tool list across runs. |
| Model deprecation mid-build | Low | High | Phase 5 models.yaml + daily `models.list()` check pings before deprecation date hits. |
| Cost overrun on iteration | Medium | Low | Circuit breaker limits worst-case to ~$30 per refinement cascade. Daily cost-report.py keeps it visible. |
| Architecture quality on first try | High | High | Solo PR review at the architect-checkpoint stage in Phase 2. Reject and re-prompt before Coder agents run. |
| Hallucination in agent outputs | Low | High | Zod schema validation on every structured output (already in agent specs). Schema rejection forces a retry. |
| HWP parsing failures | Low | Low | Only matters if you target Korean clients. Fallback to PDF conversion via LibreOffice already documented. |

The team plan's "context window limitations" risk is also mostly mitigated — Opus 4.6/4.7 has 1M tokens and adaptive thinking covers the rest.

---

## 11. How to use this plan

When you sit down to work on this project:

1. **Read §1 status snapshot.** Find the first `not started` row.
2. **Open that phase's section.** Work the *Build* checklist top-to-bottom.
3. **Run the *Validate* command.** If it passes, write the `.status_done` marker and update §1.
4. **If it fails:** check the *Skipped for solo* list — you might have built something that wasn't required. Otherwise, investigate, fix, re-run.
5. **Don't skip ahead.** The phase ordering is the orchestrator's contract; Phase 3 reads what Phase 2 wrote.

If you're stuck for more than ~3 hours on one phase, drop down to `../ai-sdlc-research/07-agent-specifications.md` for that agent's full system prompt + Zod schema. Don't reinvent — it's already specified.

When a phase exits, commit with `v1.X: feat(phase-N): <one-line outcome>`. The git log becomes the project journal.
