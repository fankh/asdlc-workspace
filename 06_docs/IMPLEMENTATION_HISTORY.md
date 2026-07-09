# Implementation History — Agent Console & Pipeline System

A complete, verification-oriented record of everything built on branch `dev`
(2026-07-07 → 2026-07-09). Each entry lists **what was built, the commit,
how it was verified at the time, and how to re-verify it later**.

---

## 1. System overview

| Piece | What it is | Where |
|---|---|---|
| **ASDLC pipeline** | Requirements → tested, deployed web app via LLM agents (`run-pipeline.py` + `pipeline/`) | repo root |
| **Pipeline dashboard** | Control panel for the ASDLC pipeline (status, runs, loops, config) | http://localhost:8099 (`run-pipeline.py serve`) |
| **Agent console (the generated app)** | Register agents, run them, build/run node-graph pipelines with triggers | http://localhost:8088 (docker) |
| **Live deployment** | Same app on the EDIM server, behind TLS + basic auth | https://edim.seekerslab.com/agents/ (`edim`/`edim`) |

LLM runtime: local Ollama. Local machine runs `qwen3.6`; the EDIM server runs
`qwen2.5:7b-instruct` **aliased as `qwen3.6` and `llama3`** (CPU-only host).

---

## 2. Feature history (chronological)

### Phase A — ASDLC pipeline foundation (2026-07-07)

| Commit(s) | Feature |
|---|---|
| `9e04048`…`c14387a` | Full 10-stage pipeline run (ingest→docs); agent console generated; QA gate green |
| `cc3dc54` | **Watch mode**: poll 00_input + discovered tickets → re-run → deploy on green; singleton lock; logon autostart |
| `c5e008b`, `21540b0` | Idempotent seed; 12 enriched agents |
| `8b04d91` | Agent management: role/persona/skills/gender/importance/model/goal + CRUD + drawer |
| `442eed0` | **Self-improvement loop** (`pipeline/improve.py`): audit deployed app → fix → deploy only on green; rollback + defer on red |
| `306185e`, `b665e54` | **Dashboard :8099**: live stage/cost/loop status, action buttons, sidebar nav |
| `4794744` | Agent console top navigation header |

**Verified then:** 28→34/34 e2e, compose smoke on :8088, improve-loop live cycle
(found finding → triaged → idle), `tests/` pytest green.
**Re-verify:** `.venv/Scripts/python -m pytest tests/` (34 tests) ·
`run-pipeline.py status` · open :8099.

### Phase B — Dashboard configuration (2026-07-08)

| Commit | Feature |
|---|---|
| `1580bc8` | **Config page** on :8099 — edit `config.yaml` + `.env` in browser; secrets masked `********`, kept if left masked; YAML validated before write |
| `aaa30e6` | **Loop configuration**: priority (enforced via `should_yield` — lower-priority loop skips its tick), timers, deploy flags, improve target/max-cycles in `.pipeline/loops.json`; per-loop live metrics (`/api/loop-metrics`: last outcome, avg cycle excluding idle ticks, next-tick ETA, ollama/target reachability); Start buttons build argv from saved settings |

**Verified then:** GET/POST `/api/config` round-trip left `.env` intact; bad YAML
rejected; loops save/validate/argv unit-tested (`tests/test_loopcfg.py`).
**Re-verify:** `pytest tests/test_loopcfg.py` · :8099 → Config → change a timer →
Save → Start watch → footer dot turns on.

### Phase C — Agent execution (2026-07-08, commit `c1ff9db`)

Agents became runnable (previously registry-only): `AgentRun` model, async
lifecycle (POST returns 202, frontend polls), Ollama executor
(`llm.ts: persona/role/skills/goal → prompt`), cloud-model guard (clear error
for `claude-*`/`gpt-*`), Run button + modal with history.
Compose wires containers to host Ollama via `host.docker.internal`
(**hardcoded** — the pipeline `.env`'s `OLLAMA_HOST=localhost` would point the
container at itself).

**Verified then:** dev + deployed runs returned exact requested tokens
(`READY`, `DEPLOYED-OK`); guard message confirmed; 34/34 e2e.
**Re-verify:** Agents → Run → task `Reply with exactly: CHECK-OK` → succeeded
with exact output. Backend units: `cd 04_source/backend && npx vitest run`.

### Phase D — Pipelines (2026-07-08 → 09)

| Commit | Feature |
|---|---|
| `1b119ee` | **Chained pipelines (Phase 2)**: ordered agent chains, output→input, per-step instruction; step runs snapshot label/model; failed step fails run, rest pending |
| `e6814ff` | **n8n-style canvas**: pan/zoom/drag, port wiring with bezier edges, side panel, run overlay on nodes, positions persisted (`posX/posY`) |
| `e28580a` | **Triggers (ADLC)**: manual / interval / webhook per pipeline; in-process scheduler (15s tick, never overlaps a running pipeline); `POST /api/hooks/:key`; enabled switch; run provenance (`trigger` on every run); ⚡ trigger pill on canvas |
| `1a75bcc` | **Node types**: logic (IF) with ✓/✗ branch ports (contains / not-contains / regex / longer-than), skill (summarize/translate/extract/classify/custom), HTTP (GET/POST, 30s timeout, 8k cap); real `PipelineEdge` graph; runs snapshot their graph; untaken branches → `skipped`; agent delete now SetNull (keeps the node) |
| `bf135a6` | Canvas fix #1: `user-select:none` (text selection turned drags into native text-drags), node-body drop targets, 16px port hit-circles, reverse (in-port) wiring |
| `ffe4ff2` | Canvas fix #2: **pointer capture** (drops over the settings panel/topbar were swallowed); node spawn wraps instead of hiding under the panel |

**Verified then:** zero-LLM branch run (http→IF→branches) 100ms with correct
`skipped` marking; UI-built flows ran on dev and deployed; wiring re-verified
after each fix by simulated hand-drags on dev **and** :8088.
**Re-verify:** Pipelines → New → build `HTTP(health) → IF contains "ok" → ✓/✗`
→ Run task `go` → true path green, false path dim `skipped`, ~0.3s.

### Phase E — Deployment to EDIM (2026-07-09, commit `6896ed0`)

- Subpath support: `VITE_BASE` build arg → vite base + router basename +
  `API_ROOT` prefix (needed because the provider firewall only passes
  5022/80/443 and `/api` at the domain root belongs to the EDIM backend).
- Server: app at `~/agent-console` (frontend bound 127.0.0.1:8089), nginx
  `location /agents/` on the existing vhost (inherits basic auth), native
  Ollama with `OLLAMA_HOST=0.0.0.0`, ufw rule `172.16.0.0/12 → 11434`
  (docker-bridge→host was silently dropped), model aliases via `ollama cp`.

**Verified then:** 401 without auth; page/assets/deep links 200; EDIM app at `/`
unaffected; zero-LLM branch run + agent run (`EDIM-DEPLOY-OK`) through the
public URL.
**Re-verify:** `node tools/ui-test-agent/qa-live.mjs` (16 checks, self-cleaning).
Redeploy procedure: memory note `agent-console-edim-deploy` or §4 below.

### Phase F — QA suites (2026-07-09, commits `a2dd621`, `29a6300`, `0e87962`, `8c70cbd`)

See §3. Also fixed a harness bug the 10× loop exposed: `expect(label, cond,
await errLocator.textContent())` — args evaluate eagerly, so every *successful*
save waited the full 30s timeout on the missing error element.

### Phase G — Theme, context window, agent context (2026-07-09)

| Commit | Feature |
|---|---|
| `1af2697` | **Light/dark theme**: CSS variables + `[data-theme=light]`, antd algorithm switch, ☀/🌙 header toggle, localStorage persistence. Fixed en route: toggle overflowed mobile viewport (destabilized taps → 2 e2e failures); light danger-red below AA (4.37:1 → `#B3261E`) |
| `ae43317` | **Context truncation fix**: Ollama defaults `num_ctx=4096` and silently truncates the prompt HEAD; now every call sends `num_ctx` (default 16384, `OLLAMA_NUM_CTX` env); task caps 4000→16000 chars |
| `11a45c8` | **Agent context layers**: (1) `Agent.context` standing knowledge in every run; (2) pipeline trail — LLM steps see the original task + last-4 earlier-step digests, stored in `stepRun.task`; (3) `Agent.memory` opt-in — last-3-runs recall block |

**Verified then:** axe clean both themes; theme persists on live; codeword at
head of ~4.6k-token task recalled on local (`PINEAPPLE-77`, 33s) and live
(`MANGO-42`, 118s cold); context-only recall (`BANANA-9`), cross-run memory
recall, trail sections asserted in `stepRun.task`.
**Re-verify (context stack):**
1. Create agent, Context = `our codeword is BANANA-9`, Memory = on.
2. Run `What is our codeword?` → BANANA-9 (standing context).
3. Run `What did you answer in your previous run?` → BANANA-9 (memory).
4. Chain skill→http→agent, run, open the run history → the agent step's task
   text contains `Original task:` and `Earlier steps:` (trail).

---

## 3. Test assets — the re-verification toolkit

| Suite | Command | Scope | Last result |
|---|---|---|---|
| Pipeline unit (python) | `.venv/Scripts/python -m pytest tests/` | orchestrator, watcher, improve, loopcfg | 34 ✅ |
| Backend unit (vitest) | `cd 04_source/backend && npx vitest run` | prompt building, logic ops, skills, scheduler, trail composer | 20 ✅ |
| e2e regression | `cd 04_source/frontend && npx playwright test` | 5 stories × chromium + mobile + axe | 34 ✅ |
| API contract | `PYTHONIOENCODING=utf-8 python tools/qa/qa_api.py` (backend on :3001) | 30 negative/contract cases: validation, 404/409, graph pathologies, unicode, orphaned agents | 30 ✅ |
| Canvas interactions | `node tools/ui-test-agent/qa-ui.mjs` (backend + `npm run dev`) | wiring/zoom/pan/reverse/persistence/axe | 11 ✅ |
| **Live suite** | `node tools/ui-test-agent/qa-live.mjs` | full user journey on edim.seekerslab.com/agents/ incl. real LLM run | 16 ✅ |
| **Lifecycle loop** | `node tools/ui-test-agent/qa-loop.mjs` (`ITERS=n`, `DEBUG=1`) | n× build→run→webhook→verify→delete + scheduler self-fire | 2× 10/10, 96/96 ✅ |

`HEADED=1` on any of the three `.mjs` suites opens a **visible slow-motion
browser** (per the standing rule: user-requested test runs are watchable).
All suites are self-cleaning (create only `QA *`-named data and delete it).

Grand total at last full pass: **145 checks green, 0 product defects open.**

---

## 4. Deployment & redeploy runbook

**Local (docker):** `docker compose up --build -d` → http://localhost:8088.

**EDIM live:**
```bash
tar czf /tmp/agent-console.tgz --exclude=node_modules --exclude=dev.db \
  --exclude=dist --exclude=e2e --exclude=test-reports --exclude=test-results \
  docker-compose.yml deploy 04_source/backend 04_source/frontend
scp /tmp/agent-console.tgz edim-server:/tmp/
ssh edim-server 'cd ~/agent-console && tar xzf /tmp/agent-console.tgz && docker compose up --build -d'
```
Do **not** overwrite the server's `docker-compose.override.yml`
(binds 127.0.0.1:8089 + builds with `VITE_BASE=/agents/`).

---

## 5. Known gotchas & accepted limitations (read before "fixing")

- **Ollama calls must always pass `num_ctx`** — the 4096 default truncates
  prompt heads silently (fixed in `llm.ts`; keep it in any new call).
- **Canvas drag code must keep pointer capture** and `user-select:none` —
  both were real, hand-only wiring bugs.
- Server allows saving **cyclic/disconnected graphs** (frontend blocks them);
  runs fail gracefully with "needs exactly one start". By design.
- **HTTP node is SSRF-capable by design** (local tool); the live instance is
  behind basic auth — do not expose it unauthenticated.
- **No fan-in/merge**: each run follows exactly one path. Next executor
  upgrade if parallel branches are wanted.
- Agent `memory` is **opt-in** so exact-output automations stay deterministic.
- e2e can flake if a stray vite holds :3000 (Playwright reuses servers) —
  kill it and rerun.
- Live server model is a **7B aliased as qwen3.6** — honest capability note.
- Dev DB agents get recreated by e2e runs; pick agents dynamically in scripts.
- Playwright harness rules learned the hard way: never pass
  `await locator(...).textContent()` as an assertion *detail* argument
  (30s stall on the happy path); antd Select needs `.ant-select-selector`
  clicks; axe needs `browser.newContext()` pages.

---

## 6. Ten-minute full verification checklist

1. `pytest tests/` → 34 pass.
2. `npx vitest run` (backend) → 20 pass.
3. `npx playwright test` (frontend) → 34 pass.
4. `python tools/qa/qa_api.py` → 30 pass (backend on :3001).
5. `HEADED=1 node tools/ui-test-agent/qa-live.mjs` → watch 16 checks on live.
6. Manual spot: :8088 → toggle theme → build HTTP→IF branch flow → Run →
   green/skipped overlay → set trigger to interval 60s → watch it self-fire →
   set back to manual.
