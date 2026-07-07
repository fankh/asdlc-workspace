"""Discovery agent: wraps the sibling fankh/discovery-agent repo.

On-demand stage (run-pipeline.py run --stage discover): crawls a live app
with the sibling repo's Playwright+Claude-vision crawler, redirects its
ticket output into 01_requirements/discovered/, and dedupes against tickets
already present. Requires the Anthropic path (the crawler uses Claude vision).
"""

from __future__ import annotations

import hashlib
import logging
import os
import re
import shutil
import subprocess

from . import register
from .base import Agent, AgentResult

log = logging.getLogger("pipeline")

DEFAULT_URL = "http://localhost:3000"
DEFAULT_MAX_PAGES = "20"


@register("discovery")
class DiscoveryAgent(Agent):
    def run(self) -> AgentResult:
        sibling = self.ctx.root.parent / "discovery-agent"
        if not (sibling / "package.json").exists():
            return AgentResult(ok=False, summary=f"discovery-agent repo not found at "
                               f"{sibling} — clone github.com/fankh/discovery-agent there")

        url = os.environ.get("DISCOVER_URL", DEFAULT_URL)
        max_pages = os.environ.get("DISCOVER_MAX_PAGES", DEFAULT_MAX_PAGES)
        out_dir = self.ctx.root / "01_requirements" / "discovered"
        existing = self._ticket_hashes(out_dir / "tickets")

        npm = shutil.which("npm") or "npm"
        cmd = [npm, "run", "discover", "--", "--url", url,
               "--max-pages", max_pages, "--out-dir", str(out_dir)]
        log.info("discovery: crawling %s (max %s pages)", url, max_pages)
        proc = subprocess.run(cmd, cwd=sibling, capture_output=True, text=True,
                              encoding="utf-8", errors="replace", timeout=1800)
        if proc.returncode != 0:
            return AgentResult(ok=False, summary="discovery-agent run failed: "
                               + (proc.stderr or proc.stdout)[-500:])

        tickets_dir = out_dir / "tickets"
        new, dupes = 0, 0
        if tickets_dir.exists():
            for ticket in sorted(tickets_dir.glob("TICKET-*.md")):
                digest = self._hash_ticket(ticket.read_text(encoding="utf-8"))
                if digest in existing:
                    ticket.unlink()
                    dupes += 1
                else:
                    existing.add(digest)
                    new += 1
        return AgentResult(ok=True, summary=f"{new} new ticket(s), {dupes} duplicate(s) "
                           f"dropped — re-run the product stage to fold them into the backlog")

    def _ticket_hashes(self, tickets_dir) -> set[str]:
        if not tickets_dir.exists():
            return set()
        return {self._hash_ticket(p.read_text(encoding="utf-8"))
                for p in tickets_dir.glob("TICKET-*.md")}

    @staticmethod
    def _hash_ticket(text: str) -> str:
        # hash the title line so renumbered TICKET ids still dedupe
        title = next((line for line in text.splitlines() if line.startswith("#")), text[:100])
        normalized = re.sub(r"TICKET-\d+", "", title).strip().lower()
        return hashlib.sha256(normalized.encode()).hexdigest()
