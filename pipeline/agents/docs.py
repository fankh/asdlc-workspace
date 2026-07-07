"""Docs agent: generated app + specs -> 06_docs/ user guide and API reference."""

from __future__ import annotations

from . import register
from .base import Agent, AgentResult

PROMPT = """You are the Docs agent in an automated software delivery pipeline.
Write end-user and developer documentation for the application described by
the backlog and OpenAPI spec you receive. Google/AWS imperative voice, code
first, no marketing copy.

Produce exactly two markdown documents:
1. `user_guide`: what the app does, each screen and workflow (matching the
   backlog stories), and how to run it locally (frontend npm run dev on :3000,
   backend npm run dev on :3001, prisma db push + db:seed first).
2. `api_reference`: every endpoint from the OpenAPI spec — method, path,
   request/response examples with realistic values, error envelope."""

SCHEMA = {
    "type": "object",
    "properties": {
        "user_guide": {"type": "string"},
        "api_reference": {"type": "string"},
    },
    "required": ["user_guide", "api_reference"],
    "additionalProperties": False,
}


@register("docs")
class DocsAgent(Agent):
    def run(self) -> AgentResult:
        root = self.ctx.root
        parts = []
        for label, path in (
            ("Product backlog", root / "02_specs" / "PRODUCT_BACKLOG.md"),
            ("OpenAPI spec", root / "03_architecture" / "openapi.yaml"),
            ("QA report", root / "05_test_reports" / "REPORT.md"),
        ):
            if path.exists():
                parts.append(f"# {label}\n\n{path.read_text(encoding='utf-8')}")
        if not parts:
            return AgentResult(ok=False, summary="nothing to document yet")

        result = self.ctx.llm.complete(
            system=self.system_blocks(PROMPT),
            user="\n\n---\n\n".join(parts),
            schema=SCHEMA,
            max_tokens=16000,
        )
        self.write_file("06_docs/USER_GUIDE.md",
                        result.parsed["user_guide"].strip() + "\n")
        self.write_file("06_docs/API_REFERENCE.md",
                        result.parsed["api_reference"].strip() + "\n")
        return AgentResult(ok=True, usage=result.usage,
                           summary="USER_GUIDE.md + API_REFERENCE.md written")
