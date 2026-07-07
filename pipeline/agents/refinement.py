"""Refinement agent: failing QA report -> minimal whole-file patches.

Whole-file rewrites of only the implicated files (LLM diffs are unreliable).
Tests are the contract: this agent may rewrite application source, never
files under e2e/. The orchestrator bounds the loop (max_loops, then
HUMAN_INTERVENTION_REQUIRED).
"""

from __future__ import annotations

import json
import logging

from . import register
from .base import FILES_SCHEMA, Agent, AgentResult, dump_workspace_files

log = logging.getLogger("pipeline")

MAX_CONTEXT_FILES = 40

PROMPT = """You are the Refinement agent in an automated software delivery
pipeline. The QA gate is red. You receive the failure report, the failing
tests (READ-ONLY — they are the acceptance contract), and the current
application source.

Diagnose the ROOT CAUSE before patching. If every test for a page fails with
"element not found" or navigation timeouts, the page is likely not rendering
at all — suspect a runtime crash, not wrong copy: nested routers/providers
(src/main.tsx ALREADY wraps <BrowserRouter> and <ConfigProvider> — App.tsx
must not add its own), invalid hook usage, or a bad import. You cannot see
the browser console, so reason from the failure pattern.

Fix the application code so the failing tests pass:
- Return ONLY files that must change, each as its COMPLETE corrected content.
- Application source only (04_source/frontend/src, 04_source/backend/src,
  04_source/backend/prisma, config files). NEVER return files under e2e/.
- Smallest change that makes the contract pass — no refactoring, no new
  features, keep CODING_PATTERNS.md rules.
In `notes`, state your diagnosis in one or two sentences."""


@register("refinement")
class RefinementAgent(Agent):
    extra_write_roots = ("04_source",)

    def run(self) -> AgentResult:
        root = self.ctx.root
        report_path = root / "05_test_reports" / "report.json"
        if not report_path.exists():
            return AgentResult(ok=False, summary="no QA report to refine against")
        report = json.loads(report_path.read_text(encoding="utf-8"))

        failing_tests = self._failing_test_sources(report)
        source_dump = self._source_dump()

        user = (
            f"# QA failure report\n\n```json\n"
            f"{json.dumps(report, indent=2)[:20000]}\n```\n\n"
            f"# Failing tests (READ-ONLY contract)\n\n{failing_tests}\n\n"
            f"# Current application source\n\n{source_dump}"
        )
        result = self.ctx.llm.complete(
            system=self.system_blocks(PROMPT),
            user=user,
            schema=FILES_SCHEMA,
            max_tokens=32000,
        )
        files = result.parsed["files"]
        written = []
        for entry in files:
            rel = entry["path"].lstrip("/")
            if not rel.startswith("04_source/"):
                rel = f"04_source/{rel}"
            if "/e2e/" in rel:
                log.warning("refinement: refused test modification: %s", rel)
                continue
            self.write_file(rel, entry["content"].rstrip() + "\n")
            written.append(rel)

        if not written:
            return AgentResult(ok=False, usage=result.usage,
                               summary="refinement produced no applicable patches")
        return AgentResult(ok=True, usage=result.usage,
                           summary=f"patched {len(written)} file(s): "
                                   f"{result.parsed['notes'][:200]}")

    def _failing_test_sources(self, report: dict) -> str:
        root = self.ctx.root
        files = {f["file"] for f in report.get("e2e", {}).get("failures", []) if f.get("file")}
        chunks = []
        for name in sorted(files):
            path = root / "04_source" / "frontend" / "e2e" / name
            if path.exists():
                chunks.append(f"## {name}\n```ts\n{path.read_text(encoding='utf-8')}\n```")
        return "\n\n".join(chunks) or "(spec sources unavailable — see report)"

    def _source_dump(self) -> str:
        return dump_workspace_files(self.ctx.root, [
            "04_source/frontend/src/**/*.ts*",
            "04_source/frontend/vite.config.ts",
            "04_source/backend/src/**/*.ts",
            "04_source/backend/prisma/*.prisma",
            "04_source/backend/prisma/seed.ts",
        ], MAX_CONTEXT_FILES)
