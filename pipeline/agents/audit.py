"""Audit agent: actively hunt for problems in the running application.

On-demand stage (run-pipeline.py run --stage audit). Unlike QA (which gates
on the Gherkin contract), this probes BEYOND the contract:

- UI layer (tools/ui-test-agent audit mode): console/page errors, failed
  network requests, every axe violation at any impact, broken internal links.
- API layer (this file): OpenAPI-driven checks — invalid payloads must yield
  4xx with the error envelope (never 500), unknown resources/routes must 404.

Findings are LLM-triaged into 01_requirements/discovered/tickets/PROBLEM-*.md
so the next product-stage run folds them into the backlog. The stage itself
never fails on findings — finding problems is its success condition.

Target selection: AUDIT_URL env var if set (e.g. http://localhost:8088),
otherwise the dev servers are booted locally like the QA stage does.
"""

from __future__ import annotations

import json
import logging
import os
import re
import shutil
import subprocess

import requests
import yaml

from . import register
from .base import Agent, AgentResult
from .qa import DevServer

log = logging.getLogger("pipeline")

TICKET_SCHEMA = {
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

TRIAGE_PROMPT = """You are the Audit agent in an automated software delivery
pipeline. You receive raw findings from probing a live application (UI console
errors, accessibility violations, failed requests, API contract deviations).

Triage them into actionable problem tickets:
- Merge duplicates (the same root cause on several routes = ONE ticket).
- Drop noise (favicon 404s, devtools chatter, third-party script warnings).
- One ticket per coherent problem, each with a Gherkin reproduction scenario
  (Given/When/Then) that would FAIL today and pass once fixed.
- severity: P0 = breaks a primary flow or data integrity; P1 = user-visible
  defect or WCAG violation; P2 = polish/robustness.
- `summary`: 2-3 sentences on overall app health for a human reader."""


@register("audit")
class AuditAgent(Agent):
    extra_write_roots = ("01_requirements",)

    def run(self) -> AgentResult:
        root = self.ctx.root
        target = os.environ.get("AUDIT_URL")
        servers: list[DevServer] = []
        try:
            if not target:
                backend = root / "04_source" / "backend"
                frontend = root / "04_source" / "frontend"
                if backend.exists():
                    servers.append(DevServer(backend, "http://localhost:3001/api/health", "backend"))
                servers.append(DevServer(frontend, "http://localhost:3000", "frontend"))
                target = "http://localhost:3000"

            ui_findings = self._probe_ui(target)
            api_findings = self._probe_api(target)
        except RuntimeError as exc:
            return AgentResult(ok=False, summary=f"audit target unavailable: {exc}")
        finally:
            for server in servers:
                server.stop()

        findings = ui_findings + api_findings
        report = {"target": target, "total": len(findings), "findings": findings}
        self.write_file("05_test_reports/audit/findings.json",
                        json.dumps(report, indent=2) + "\n")

        if not findings:
            self.write_file("05_test_reports/audit/AUDIT.md",
                            "# Audit\n\nNo problems found.\n")
            return AgentResult(ok=True, summary=f"0 findings against {target}")

        result = self.ctx.llm.complete(
            system=self.system_blocks(TRIAGE_PROMPT),
            user=f"Audit target: {target}\n\nRaw findings (JSON):\n\n"
                 f"```json\n{json.dumps(findings, indent=2)[:24000]}\n```",
            schema=TICKET_SCHEMA,
            max_tokens=12000,
        )
        tickets = result.parsed["tickets"]
        written = self._write_tickets(tickets)
        self._write_report(result.parsed["summary"], tickets, target, len(findings))

        return AgentResult(
            ok=True, usage=result.usage,
            summary=f"{len(findings)} raw finding(s) -> {len(written)} ticket(s) "
                    f"({', '.join(written) or 'none new'})",
        )

    # -- probes ------------------------------------------------------------

    def _probe_ui(self, target: str) -> list[dict]:
        root = self.ctx.root
        ui_agent = self.ctx.config.tools_dir
        if not (ui_agent / "node_modules").exists():
            log.warning("audit: ui-test-agent not installed — skipping UI probe")
            return []

        routes = self._app_routes()
        out = root / "05_test_reports" / "audit" / "ui-findings.json"
        npm = shutil.which("npm") or "npm"
        proc = subprocess.run(
            [npm, "run", "audit", "--", "--base-url", target,
             "--routes", ",".join(routes), "--out", str(out)],
            cwd=ui_agent, capture_output=True, text=True,
            encoding="utf-8", errors="replace", timeout=600,
        )
        if proc.returncode != 0 or not out.exists():
            log.warning("audit: UI probe failed: %s", (proc.stderr or proc.stdout)[-400:])
            return []
        return json.loads(out.read_text(encoding="utf-8"))["findings"]

    def _app_routes(self) -> list[str]:
        app = self.ctx.root / "04_source" / "frontend" / "src" / "App.tsx"
        if not app.exists():
            return ["/"]
        routes = re.findall(r'path="([^"*]+)"', app.read_text(encoding="utf-8"))
        return sorted(set(routes) | {"/"})

    def _probe_api(self, target: str) -> list[dict]:
        spec_path = self.ctx.root / "03_architecture" / "openapi.yaml"
        if not spec_path.exists():
            return []
        spec = yaml.safe_load(spec_path.read_text(encoding="utf-8"))
        findings: list[dict] = []

        def check(name: str, method: str, url: str, ok, **kwargs) -> None:
            try:
                resp = requests.request(method, url, timeout=10, **kwargs)
            except requests.RequestException as exc:
                findings.append({"kind": "api", "route": url, "severity": "critical",
                                 "detail": f"{name}: request error {exc}"})
                return
            problem = ok(resp)
            if problem:
                findings.append({"kind": "api", "route": f"{method} {url}",
                                 "severity": "serious", "detail": f"{name}: {problem}"})

        def envelope_or_none(resp) -> str | None:
            if resp.status_code >= 500:
                return f"server error {resp.status_code} (must be 4xx with error envelope)"
            if resp.status_code >= 400:
                try:
                    body = resp.json()
                except ValueError:
                    return f"{resp.status_code} without JSON body"
                if not ("code" in body or "error" in body) or "message" not in body:
                    return f"{resp.status_code} body missing error envelope fields: {str(body)[:120]}"
            return None

        for path, ops in (spec.get("paths") or {}).items():
            url = target.rstrip("/") + path.replace("{id}", "00000000-missing-id")
            for method, op in ops.items():
                if method.lower() == "post" and "requestBody" in (op or {}):
                    check("invalid empty body", "POST", url, envelope_or_none, json={})
                    check("wrong field types", "POST", url, envelope_or_none,
                          json={"name": 12345, "unexpected": True})
                    check("non-JSON body", "POST", url, envelope_or_none,
                          data="not json", headers={"Content-Type": "text/plain"})
                if method.lower() in ("get", "delete") and "{id}" in path:
                    check("unknown resource id", method.upper(), url,
                          lambda r: None if r.status_code == 404 else
                          f"expected 404, got {r.status_code}")

        check("unknown API route", "GET", f"{target.rstrip('/')}/api/definitely-not-a-route",
              lambda r: None if r.status_code == 404 else f"expected 404, got {r.status_code}")
        return findings

    # -- output ------------------------------------------------------------

    def _write_tickets(self, tickets: list[dict]) -> list[str]:
        tickets_dir = self.ctx.root / "01_requirements" / "discovered" / "tickets"
        existing = [int(m.group(1)) for p in tickets_dir.glob("PROBLEM-*.md")
                    if (m := re.match(r"PROBLEM-(\d+)", p.name))] if tickets_dir.exists() else []
        # dedup against both existing tickets AND deferred (unfixable) ones,
        # so the self-improvement loop never re-files a problem it gave up on
        deferred_dir = self.ctx.root / "01_requirements" / "discovered" / "deferred"
        seen_titles = set()
        for folder in (tickets_dir, deferred_dir):
            if folder.exists():
                for p in folder.glob("PROBLEM-*.md"):
                    first = p.read_text(encoding="utf-8").splitlines()[0]
                    seen_titles.add(re.sub(r"[^a-z0-9]", "", first.lower()))

        next_id = max(existing, default=0) + 1
        written = []
        for ticket in tickets:
            title_key = re.sub(r"[^a-z0-9]", "",
                               f"# {ticket['severity']} — {ticket['title']}".lower())
            if title_key in seen_titles:
                continue
            name = f"PROBLEM-{next_id:03d}"
            self.write_file(
                f"01_requirements/discovered/tickets/{name}.md",
                f"# {ticket['severity']} — {ticket['title']}\n\n"
                f"**Area:** {ticket['area']}\n\n{ticket['problem']}\n\n"
                f"## Acceptance criteria\n\n```gherkin\n{ticket['gherkin'].strip()}\n```\n",
            )
            written.append(name)
            next_id += 1
        return written

    def _write_report(self, summary: str, tickets: list[dict],
                      target: str, raw_count: int) -> None:
        lines = [f"# Audit — {target}", "", summary, "",
                 f"{raw_count} raw finding(s) triaged into {len(tickets)} ticket(s):", "",
                 "| severity | area | title |", "|---|---|---|"]
        lines += [f"| {t['severity']} | {t['area']} | {t['title']} |" for t in tickets]
        lines += ["", "Tickets: `01_requirements/discovered/tickets/PROBLEM-*.md` — "
                  "re-run the product stage to fold them into the backlog."]
        self.write_file("05_test_reports/audit/AUDIT.md", "\n".join(lines) + "\n")
