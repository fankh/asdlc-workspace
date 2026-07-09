"""Browser test agent: author real-browser acceptance tests from the backlog,
run them against the live app, report, and file failures as PROBLEM tickets.

On-demand stage (run-pipeline.py run --stage browsertest). The chain so far:
testgen writes Gherkin specs, qa runs them for the gate. This agent goes
further — the LLM reads the acceptance criteria and AUTHORS a concrete browser
test plan (navigate/click/fill + expect visible text / URL / count / axe),
which a real Chromium browser executes step-by-step (tools/ui-test-agent
browsertest mode, HEADED-capable). Actual outcomes are judged deterministically.

Failing cases are LLM-triaged into 01_requirements/discovered/tickets/PROBLEM-*
so the self-improvement loop can pick them up. The stage reports pass/fail but
does not hard-fail the pipeline (finding gaps is useful output).

Target: BROWSERTEST_URL or AUDIT_URL if set (e.g. http://localhost:8088),
otherwise dev servers are booted locally like the QA stage.
"""

from __future__ import annotations

import json
import logging
import os
import re
import shutil
import subprocess

from . import register
from .base import Agent, AgentResult
from .qa import DevServer

log = logging.getLogger("pipeline")

PLAN_SCHEMA = {
    "type": "object",
    "properties": {
        "cases": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},          # STORY-001-c1
                    "title": {"type": "string"},
                    "story": {"type": "string"},
                    "steps": {
                        "type": "array",
                        "items": {"type": "object"},     # one action/expect per step
                    },
                },
                "required": ["id", "title", "steps"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["cases"],
    "additionalProperties": False,
}

PLAN_PROMPT = """You are the Browser Test agent in an automated software delivery
pipeline. From the product backlog (INVEST stories + Gherkin acceptance
criteria) and the app's routes, author a concrete browser test PLAN a real
Chromium browser will execute against the running app.

Output JSON: { "cases": [ { "id", "title", "story", "steps": [...] } ] }.
- One case per acceptance scenario. id like "STORY-001-c1".
- Each step is an object with exactly ONE key. Allowed steps:
  { "goto": "/path" }                         navigate (path only, no host)
  { "click": "Visible button or link text" }  click by visible text
  { "fill": { "label": "Field label", "value": "..." } }  fill an input by label
  { "expectText": "text that must be visible" }
  { "expectUrl": "/path" }                     current path/hash contains this
  { "expectCount": { "selector": "css", "min": 1 } }  element count bound
  { "expectNoAxe": true }                      no serious/critical a11y violations
- Start each case with a goto. Derive expected copy VERBATIM from the Gherkin
  (visible text, URLs). Prefer expectText/expectUrl over brittle CSS.
- Only test what the stories specify. Keep each case to 3-8 steps.
- Include one { "expectNoAxe": true } case per user-facing page."""

TRIAGE_SCHEMA = {
    "type": "object",
    "properties": {
        "tickets": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "title": {"type": "string"},
                    "severity": {"type": "string", "enum": ["P0", "P1", "P2"]},
                    "area": {"type": "string"},
                    "problem": {"type": "string"},
                    "gherkin": {"type": "string"},
                },
                "required": ["title", "severity", "area", "problem", "gherkin"],
                "additionalProperties": False,
            },
        },
        "summary": {"type": "string"},
    },
    "required": ["tickets", "summary"],
    "additionalProperties": False,
}

TRIAGE_PROMPT = """You are the Browser Test agent triaging FAILED browser test
cases into actionable problem tickets. Each failure has the case title, the
step that failed, and the browser's actual detail. Merge duplicates (same root
cause across cases = ONE ticket). One ticket per coherent defect with a Gherkin
reproduction (Given/When/Then). severity: P0 = a primary user flow is broken;
P1 = a story's acceptance criterion fails or a WCAG violation; P2 = minor.
`summary`: 2-3 sentences on how well the app meets its acceptance criteria."""


@register("browsertest")
class BrowserTestAgent(Agent):
    extra_write_roots = ("01_requirements",)

    def run(self) -> AgentResult:
        root = self.ctx.root
        backlog_path = root / "02_specs" / "PRODUCT_BACKLOG.md"
        if not backlog_path.exists():
            return AgentResult(ok=False, summary="02_specs/PRODUCT_BACKLOG.md missing")
        backlog = backlog_path.read_text(encoding="utf-8")

        # 1. LLM authors the browser test plan from the acceptance criteria
        routes = self._app_routes()
        plan_res = self.ctx.llm.complete(
            system=self.system_blocks(PLAN_PROMPT),
            user=f"App routes: {', '.join(routes)}\n\nProduct backlog:\n\n{backlog}",
            schema=PLAN_SCHEMA,
            max_tokens=12000,
        )
        plan = plan_res.parsed
        self.write_file("05_test_reports/browser/plan.json",
                        json.dumps(plan, indent=2) + "\n")
        if not plan["cases"]:
            return AgentResult(ok=True, usage=plan_res.usage,
                               summary="no test cases authored")

        # 2. a real browser executes the plan against the running app
        servers: list[DevServer] = []
        target = os.environ.get("BROWSERTEST_URL") or os.environ.get("AUDIT_URL")
        try:
            if not target:
                backend = root / "04_source" / "backend"
                if backend.exists():
                    servers.append(DevServer(backend, "http://localhost:3001/api/health", "backend"))
                servers.append(DevServer(root / "04_source" / "frontend",
                                         "http://localhost:3000", "frontend"))
                target = "http://localhost:3000"
            results = self._run_browser(target)
        except RuntimeError as exc:
            return AgentResult(ok=False, summary=f"browser test target unavailable: {exc}")
        finally:
            for server in servers:
                server.stop()

        if results is None:
            return AgentResult(ok=False, summary="browser runner failed (see logs)")

        passed = results["passed"]
        total = results["total"]
        failures = [c for c in results["cases"] if not c["ok"]]

        # 3. triage failures into PROBLEM tickets (like audit mode)
        written: list[str] = []
        summary_text = f"{passed}/{total} browser acceptance cases passed"
        usage = plan_res.usage
        if failures:
            fail_digest = [{
                "title": c["title"],
                "failed_step": next((s["step"] for s in c["steps"] if not s["ok"]), ""),
                "actual": next((s["detail"] for s in c["steps"] if not s["ok"]), ""),
            } for c in failures]
            triage = self.ctx.llm.complete(
                system=self.system_blocks(TRIAGE_PROMPT),
                user=f"Target: {target}\n\nFailed cases (JSON):\n\n"
                     f"```json\n{json.dumps(fail_digest, indent=2)[:16000]}\n```",
                schema=TRIAGE_SCHEMA,
                max_tokens=8000,
            )
            usage = (usage or triage.usage)
            written = self._write_tickets(triage.parsed["tickets"])
            summary_text += f"; {triage.parsed['summary']}"

        self._write_report(target, results, written)
        return AgentResult(
            ok=True, usage=usage,
            summary=f"{passed}/{total} cases passed"
                    + (f", {len(failures)} failing -> {len(written)} ticket(s)" if failures else ""),
        )

    # -- browser runner -----------------------------------------------------

    def _run_browser(self, target: str) -> dict | None:
        root = self.ctx.root
        ui_agent = root / "tools" / "ui-test-agent"
        if not (ui_agent / "node_modules").exists():
            log.warning("browsertest: ui-test-agent not installed — skipping")
            return None
        plan = root / "05_test_reports" / "browser" / "plan.json"
        out = root / "05_test_reports" / "browser" / "results.json"
        shots = root / "05_test_reports" / "browser" / "shots"
        npm = shutil.which("npm") or "npm"
        proc = subprocess.run(
            [npm, "run", "browsertest", "--", "--base-url", target,
             "--plan", str(plan), "--out", str(out), "--shots", str(shots)],
            cwd=ui_agent, capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=900,
        )
        if not out.exists():
            log.warning("browsertest: runner produced no results: %s",
                        (proc.stderr or proc.stdout)[-400:])
            return None
        return json.loads(out.read_text(encoding="utf-8"))

    def _app_routes(self) -> list[str]:
        app = self.ctx.root / "04_source" / "frontend" / "src" / "App.tsx"
        if not app.exists():
            return ["/"]
        routes = re.findall(r'path="([^"*]+)"', app.read_text(encoding="utf-8"))
        return sorted(set(routes) | {"/"})

    # -- output (ticket writer mirrors the audit agent) --------------------

    def _write_tickets(self, tickets: list[dict]) -> list[str]:
        tickets_dir = self.ctx.root / "01_requirements" / "discovered" / "tickets"
        deferred_dir = self.ctx.root / "01_requirements" / "discovered" / "deferred"
        existing = [int(m.group(1)) for p in tickets_dir.glob("PROBLEM-*.md")
                    if (m := re.match(r"PROBLEM-(\d+)", p.name))] if tickets_dir.exists() else []
        seen: set[str] = set()
        for folder in (tickets_dir, deferred_dir):
            if folder.exists():
                for p in folder.glob("PROBLEM-*.md"):
                    seen.add(re.sub(r"[^a-z0-9]", "",
                                    p.read_text(encoding="utf-8").splitlines()[0].lower()))
        next_id = max(existing, default=0) + 1
        written = []
        for t in tickets:
            key = re.sub(r"[^a-z0-9]", "", f"# {t['severity']} — {t['title']}".lower())
            if key in seen:
                continue
            name = f"PROBLEM-{next_id:03d}"
            self.write_file(
                f"01_requirements/discovered/tickets/{name}.md",
                f"# {t['severity']} — {t['title']}\n\n**Area:** {t['area']}\n\n"
                f"{t['problem']}\n\n## Acceptance criteria\n\n"
                f"```gherkin\n{t['gherkin'].strip()}\n```\n",
            )
            written.append(name)
            next_id += 1
        return written

    def _write_report(self, target: str, results: dict, tickets: list[str]) -> None:
        lines = [f"# Browser Acceptance Test — {target}", "",
                 f"**{results['passed']}/{results['total']} cases passed.**", ""]
        for c in results["cases"]:
            mark = "✅" if c["ok"] else "❌"
            lines.append(f"### {mark} {c['id']} — {c['title']}")
            if not c["ok"]:
                bad = next((s for s in c["steps"] if not s["ok"]), None)
                if bad:
                    lines.append(f"- failed at `{bad['step']}` — {bad['detail']}")
            lines.append(f"- screenshot: `{c['screenshot']}`")
            lines.append("")
        if tickets:
            lines += ["## Filed problem tickets", "",
                      *[f"- `01_requirements/discovered/tickets/{t}.md`" for t in tickets],
                      "", "Re-run the product stage to fold them into the backlog."]
        self.write_file("05_test_reports/browser/BROWSER_TEST.md", "\n".join(lines) + "\n")
