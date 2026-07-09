"""QA agent: install deps, type-check, run Playwright e2e; gate the pipeline.

Writes 05_test_reports/report.json + REPORT.md. Returns ok only when every
check passes — the orchestrator writes the folder marker (and advances the
pipeline) only then; a red result triggers the refinement loop.
No LLM calls: this agent is deterministic tooling.
"""

from __future__ import annotations

import json
import logging
import shutil
import subprocess
import time
from pathlib import Path

import requests

from . import register
from .base import Agent, AgentResult

log = logging.getLogger("pipeline")

STEP_TIMEOUT = 900  # seconds per step; e2e with two dev servers is the slowest
SERVER_BOOT_TIMEOUT = 120


class DevServer:
    """Starts `npm run dev` and kills the whole process tree on stop (Windows:
    npm spawns node children, so plain terminate() would leak the server)."""

    def __init__(self, cwd: Path, health_url: str, name: str):
        npm = shutil.which("npm") or "npm"
        self.name = name
        self.proc = subprocess.Popen(
            [npm, "run", "dev"], cwd=cwd,
            stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL,
        )
        deadline = time.monotonic() + SERVER_BOOT_TIMEOUT
        while time.monotonic() < deadline:
            try:
                if requests.get(health_url, timeout=2).status_code < 500:
                    log.info("  qa: %s up at %s", name, health_url)
                    return
            except requests.RequestException:
                pass
            if self.proc.poll() is not None:
                raise RuntimeError(f"{name} dev server exited early")
            time.sleep(1)
        raise RuntimeError(f"{name} dev server not reachable at {health_url}")

    def stop(self) -> None:
        subprocess.run(["taskkill", "/F", "/T", "/PID", str(self.proc.pid)],
                       capture_output=True)


@register("qa")
class QAAgent(Agent):
    def run(self) -> AgentResult:
        root = self.ctx.root
        frontend = root / "04_source" / "frontend"
        backend = root / "04_source" / "backend"
        steps: list[dict] = []

        def step(name: str, cmd: list[str], cwd: Path, env: dict | None = None) -> bool:
            log.info("  qa: %s", name)
            try:
                proc = subprocess.run(
                    cmd, cwd=cwd, capture_output=True, text=True,
                    encoding="utf-8", errors="replace",
                    timeout=STEP_TIMEOUT, shell=False,
                )
                passed = proc.returncode == 0
                output = (proc.stdout + proc.stderr)[-8000:]
            except subprocess.TimeoutExpired:
                passed, output = False, f"timeout after {STEP_TIMEOUT}s"
            steps.append({"name": name, "passed": passed, "output": output})
            if not passed:
                log.warning("  qa: %s FAILED", name)
            return passed

        npm = shutil.which("npm") or "npm"
        npx = shutil.which("npx") or "npx"

        ok = True
        ok &= step("frontend npm install", [npm, "install"], frontend)
        if backend.exists():
            ok &= step("backend npm install", [npm, "install"], backend)
        ok &= step("frontend typecheck", [npx, "tsc", "--noEmit"], frontend)
        if backend.exists():
            ok &= step("backend typecheck", [npx, "tsc", "--noEmit"], backend)
            ok &= step("prisma db push", [npx, "prisma", "db", "push",
                                          "--force-reset", "--accept-data-loss"], backend)
            ok &= step("db seed", [npm, "run", "db:seed"], backend)

        servers: list[DevServer] = []
        try:
            try:
                if backend.exists():
                    servers.append(DevServer(backend, "http://localhost:3001/api/health", "backend"))
                servers.append(DevServer(frontend, "http://localhost:3000", "frontend"))
            except RuntimeError as exc:
                steps.append({"name": "dev servers", "passed": False, "output": str(exc)})
                ok = False
            else:
                # stale results from a prior run must not masquerade as current
                (root / "05_test_reports" / "results.json").unlink(missing_ok=True)
                ok &= step("playwright e2e", [npx, "playwright", "test"], frontend)
                ui_agent = self.ctx.config.tools_dir
                if (self.ctx.config.agents.get("qa", {}).get("ai_vision_tests")
                        and (ui_agent / "node_modules").exists()):
                    ok &= step("ai vision scenarios", [npm, "run", "test"], ui_agent)
        finally:
            for server in servers:
                server.stop()

        report = self._build_report(steps)
        self.write_file("05_test_reports/report.json", json.dumps(report, indent=2) + "\n")
        self.write_file("05_test_reports/REPORT.md", self._render_md(report))

        summary = (f"{report['e2e']['passed']}/{report['e2e']['total']} e2e passed, "
                   f"{sum(1 for s in steps if not s['passed'])} failed step(s)")
        return AgentResult(ok=bool(ok), summary=summary, details={"report": report})

    # -- reporting ---------------------------------------------------------

    def _build_report(self, steps: list[dict]) -> dict:
        e2e = {"total": 0, "passed": 0, "failed": 0, "failures": []}
        results_path = self.ctx.root / "05_test_reports" / "results.json"
        if results_path.exists():
            try:
                data = json.loads(results_path.read_text(encoding="utf-8"))
                for suite in data.get("suites", []):
                    self._walk_suite(suite, e2e)
            except (json.JSONDecodeError, KeyError) as exc:
                log.warning("qa: could not parse playwright results.json: %s", exc)
        return {
            "ok": all(s["passed"] for s in steps),
            "steps": [{"name": s["name"], "passed": s["passed"]} for s in steps],
            "step_outputs": {s["name"]: s["output"] for s in steps if not s["passed"]},
            "e2e": e2e,
        }

    def _walk_suite(self, suite: dict, e2e: dict, prefix: str = "") -> None:
        title = f"{prefix}{suite.get('title', '')}".strip()
        for spec in suite.get("specs", []):
            for test in spec.get("tests", []):
                e2e["total"] += 1
                outcome = test.get("status") or ""
                results = test.get("results", [])
                passed = outcome == "expected" or all(
                    r.get("status") == "passed" for r in results if r
                )
                if passed:
                    e2e["passed"] += 1
                else:
                    e2e["failed"] += 1
                    error = ""
                    for r in results:
                        if r.get("error"):
                            error = r["error"].get("message", "")[:2000]
                            break
                    e2e["failures"].append({
                        "file": suite.get("file", ""),
                        "test": f"{title} > {spec.get('title', '')}",
                        "error": error,
                    })
        for child in suite.get("suites", []):
            self._walk_suite(child, e2e, prefix=f"{title} > " if title else "")

    def _render_md(self, report: dict) -> str:
        lines = ["# QA Report", "",
                 f"**Overall: {'PASS' if report['ok'] else 'FAIL'}**", "",
                 "| step | result |", "|---|---|"]
        lines += [f"| {s['name']} | {'pass' if s['passed'] else 'FAIL'} |"
                  for s in report["steps"]]
        e2e = report["e2e"]
        lines += ["", f"E2E: {e2e['passed']}/{e2e['total']} passed."]
        for failure in e2e["failures"]:
            lines += ["", f"## FAIL {failure['test']}", f"`{failure['file']}`",
                      "", "```", failure["error"], "```"]
        return "\n".join(lines) + "\n"
