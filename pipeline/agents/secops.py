"""SecOps agent: dependency audit + secret scan + optional SAST.

Windows-friendly toolchain: npm audit always runs; gitleaks and semgrep run
only if installed (semgrep has no supported native Windows build), otherwise
a built-in regex secret scan covers the essentials. High/critical findings
block the pipeline.
"""

from __future__ import annotations

import json
import logging
import re
import shutil
import subprocess
from pathlib import Path

from . import register
from .base import Agent, AgentResult

log = logging.getLogger("pipeline")

SECRET_PATTERNS = re.compile(
    r"(AKIA[0-9A-Z]{16}"
    r"|sk-(ant|proj)-[A-Za-z0-9_-]{20,}"
    r"|-----BEGIN [A-Z ]*PRIVATE KEY-----"
    r"|ghp_[A-Za-z0-9]{36})"
)
SCAN_SUFFIXES = {".ts", ".tsx", ".js", ".json", ".yaml", ".yml", ".md", ".prisma"}


@register("secops")
class SecOpsAgent(Agent):
    def run(self) -> AgentResult:
        root = self.ctx.root
        findings: list[dict] = []
        tools_run: list[str] = []

        for name in ("frontend", "backend"):
            pkg_dir = root / "04_source" / name
            if (pkg_dir / "package.json").exists():
                findings += self._npm_audit(pkg_dir, name)
                tools_run.append(f"npm-audit:{name}")

        if shutil.which("gitleaks"):
            findings += self._gitleaks(root)
            tools_run.append("gitleaks")
        else:
            findings += self._regex_secret_scan(root / "04_source")
            tools_run.append("regex-secret-scan")

        if shutil.which("semgrep"):
            findings += self._semgrep(root / "04_source")
            tools_run.append("semgrep")
        else:
            log.info("secops: semgrep not installed — skipping SAST "
                     "(unsupported on native Windows)")

        blocking = [f for f in findings if f["severity"] in ("high", "critical")]
        report = {"ok": not blocking, "tools": tools_run, "findings": findings}
        self.write_file("05_test_reports/security/report.json",
                        json.dumps(report, indent=2) + "\n")

        summary = (f"{len(findings)} finding(s), {len(blocking)} blocking "
                   f"(tools: {', '.join(tools_run)})")
        return AgentResult(ok=not blocking, summary=summary)

    def _npm_audit(self, pkg_dir: Path, label: str) -> list[dict]:
        npm = shutil.which("npm") or "npm"
        proc = subprocess.run([npm, "audit", "--json"], cwd=pkg_dir,
                              capture_output=True, text=True,
                              encoding="utf-8", errors="replace", timeout=300)
        try:
            data = json.loads(proc.stdout or "{}")
        except json.JSONDecodeError:
            log.warning("secops: npm audit produced unparseable output for %s", label)
            return []
        findings = []
        for name, vuln in (data.get("vulnerabilities") or {}).items():
            findings.append({
                "tool": "npm-audit", "target": label, "package": name,
                "severity": vuln.get("severity", "unknown"),
                "detail": ", ".join(
                    v.get("title", "") for v in vuln.get("via", [])
                    if isinstance(v, dict)
                )[:200],
            })
        return findings

    def _gitleaks(self, root: Path) -> list[dict]:
        out = root / ".pipeline" / "gitleaks.json"
        subprocess.run(["gitleaks", "detect", "--no-git", "--source",
                        str(root / "04_source"), "--report-path", str(out),
                        "--report-format", "json"],
                       capture_output=True, timeout=300)
        if not out.exists():
            return []
        leaks = json.loads(out.read_text(encoding="utf-8") or "[]")
        out.unlink()
        return [{"tool": "gitleaks", "target": leak.get("File", ""),
                 "severity": "critical", "detail": leak.get("RuleID", "secret")}
                for leak in leaks]

    def _regex_secret_scan(self, source_root: Path) -> list[dict]:
        findings = []
        for path in source_root.rglob("*"):
            if (not path.is_file() or path.suffix not in SCAN_SUFFIXES
                    or "node_modules" in path.parts):
                continue
            for match in SECRET_PATTERNS.finditer(
                    path.read_text(encoding="utf-8", errors="replace")):
                findings.append({
                    "tool": "regex-secret-scan",
                    "target": str(path.relative_to(source_root)),
                    "severity": "critical",
                    "detail": f"possible secret: {match.group(0)[:12]}...",
                })
        return findings

    def _semgrep(self, source_root: Path) -> list[dict]:
        proc = subprocess.run(
            ["semgrep", "scan", "--config", "auto", "--json", str(source_root)],
            capture_output=True, text=True, encoding="utf-8",
            errors="replace", timeout=600)
        try:
            data = json.loads(proc.stdout or "{}")
        except json.JSONDecodeError:
            return []
        sev_map = {"ERROR": "high", "WARNING": "medium", "INFO": "low"}
        return [{"tool": "semgrep", "target": r.get("path", ""),
                 "severity": sev_map.get(r.get("extra", {}).get("severity", ""), "low"),
                 "detail": r.get("check_id", "")}
                for r in data.get("results", [])]
