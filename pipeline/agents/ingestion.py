"""Ingestion agent: 00_input/* -> 01_requirements/normalized/*.md.

Parses PDF (pdfplumber), DOCX (python-docx), MD/TXT (passthrough), and HWP
(fankh/hwp-parser CLI -> hwp5txt -> skip-with-warning), then runs one LLM
cleanup pass per document to produce structured requirements markdown.
"""

from __future__ import annotations

import logging
import shutil
import subprocess
from pathlib import Path

from . import register
from .base import Agent, AgentResult

log = logging.getLogger("pipeline")

MAX_DOC_CHARS = 30_000  # keep one LLM call per doc; warn when truncating

PROMPT = """You are the Ingestion agent in an automated software delivery pipeline.
You receive the raw text of one source document (an RFP, product brief, spec,
or meeting notes). Rewrite it as clean, structured requirements markdown:

- Start with `# Requirements: <document title>`.
- Group content under `## Functional`, `## Non-functional`, `## Constraints`,
  and `## Open questions` (omit empty sections).
- One requirement per bullet, imperative voice, no marketing fluff.
- Preserve every concrete requirement, number, and named entity. Do not invent
  requirements that are not in the source.
Reply with ONLY the markdown document."""


@register("ingestion")
class IngestionAgent(Agent):
    def run(self) -> AgentResult:
        input_dir = self.ctx.root / "00_input"
        sources = [
            p for p in sorted(input_dir.iterdir())
            if p.is_file() and p.name.lower() != "readme.md"
        ]
        if not sources:
            return AgentResult(ok=False, summary="00_input/ is empty — drop a source "
                               "document there or run --stage discover")

        usage_total: dict = {}
        written, skipped = [], []
        for src in sources:
            raw = self._extract_text(src)
            if raw is None:
                skipped.append(src.name)
                continue
            if len(raw) > MAX_DOC_CHARS:
                log.warning("ingestion: %s truncated to %d chars", src.name, MAX_DOC_CHARS)
                raw = raw[:MAX_DOC_CHARS]

            result = self.ctx.llm.complete(
                system=self.system_blocks(PROMPT),
                user=f"Source document `{src.name}`:\n\n{raw}",
                max_tokens=8000,
            )
            for key, val in result.usage.items():
                usage_total[key] = usage_total.get(key, 0) + val
            out = f"01_requirements/normalized/{src.stem}.md"
            self.write_file(out, result.text.strip() + "\n")
            written.append(out)

        if not written:
            return AgentResult(ok=False, summary=f"no parseable inputs (skipped: {skipped})")
        summary = f"normalized {len(written)} document(s)"
        if skipped:
            summary += f", skipped {skipped}"
        return AgentResult(ok=True, summary=summary, usage=usage_total)

    # -- format handlers --------------------------------------------------

    def _extract_text(self, path: Path) -> str | None:
        suffix = path.suffix.lower()
        try:
            if suffix in (".md", ".txt"):
                return path.read_text(encoding="utf-8", errors="replace")
            if suffix == ".pdf":
                import pdfplumber
                with pdfplumber.open(path) as pdf:
                    return "\n\n".join(page.extract_text() or "" for page in pdf.pages)
            if suffix == ".docx":
                import docx
                document = docx.Document(str(path))
                return "\n".join(p.text for p in document.paragraphs)
            if suffix == ".hwp":
                return self._extract_hwp(path)
        except Exception as exc:
            log.warning("ingestion: failed to parse %s: %s", path.name, exc)
            return None
        log.warning("ingestion: unsupported file type %s", path.name)
        return None

    def _extract_hwp(self, path: Path) -> str | None:
        """HWP fallback chain: hwp-parser CLI -> hwp5txt -> skip."""
        for cmd in (["hwp-parser", "--text", str(path)], ["hwp5txt", str(path)]):
            if shutil.which(cmd[0]):
                proc = subprocess.run(cmd, capture_output=True, text=True,
                                      encoding="utf-8", errors="replace")
                if proc.returncode == 0 and proc.stdout.strip():
                    return proc.stdout
        log.warning("ingestion: no HWP parser available for %s — skipping "
                    "(install fankh/hwp-parser or pyhwp)", path.name)
        return None
