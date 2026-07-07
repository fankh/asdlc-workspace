"""Design agent: backlog -> per-story UI specs + CODING_PATTERNS sections 2-4.

Writing CODING_PATTERNS.md invalidates the prompt cache, which is why this
runs at a stage boundary: every later agent inherits the established tokens.
"""

from __future__ import annotations

import re

from . import register
from .base import Agent, AgentResult

PROMPT = """You are the Design agent in an automated software delivery pipeline.
Project type and design system come from CODING_PATTERNS.md (Ant Design,
8pt grid, WCAG AA). For the backlog you receive:

1. Produce one UI spec per story: layout (regions, Ant components by name),
   content hierarchy, empty/loading/error states, and the exact visible copy
   for headings and buttons (copy must match the Gherkin steps verbatim).
2. Establish the design tokens for CODING_PATTERNS.md sections 2-4:
   - colors: Ant Design token names only (e.g. colorPrimary), no hex literals.
   - typography: families/sizes/weights, body >= 14px, max 2 families.
   - spacing: which 8pt steps are used where.
Keep specs implementable in one coder pass — no speculative components."""

SCHEMA = {
    "type": "object",
    "properties": {
        "coding_patterns": {
            "type": "object",
            "properties": {
                "colors": {"type": "string"},
                "typography": {"type": "string"},
                "spacing": {"type": "string"},
            },
            "required": ["colors", "typography", "spacing"],
            "additionalProperties": False,
        },
        "ui_specs": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "story_id": {"type": "string"},
                    "markdown": {"type": "string"},
                },
                "required": ["story_id", "markdown"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["coding_patterns", "ui_specs"],
    "additionalProperties": False,
}


@register("design")
class DesignAgent(Agent):
    extra_write_roots = ("CODING_PATTERNS.md",)

    def run(self) -> AgentResult:
        backlog_path = self.ctx.root / "02_specs" / "PRODUCT_BACKLOG.md"
        if not backlog_path.exists():
            return AgentResult(ok=False, summary="02_specs/PRODUCT_BACKLOG.md missing")
        backlog = backlog_path.read_text(encoding="utf-8")
        maintenance = self.ctx.config.mode == "maintenance"

        user = f"Product backlog:\n\n{backlog}"
        if maintenance:
            covered = sorted(
                p.stem for p in (self.ctx.root / "03_architecture" / "ui").glob("STORY-*.md")
            )
            new_stories = [s for s in re.findall(r"## (STORY-\d+)", backlog)
                           if s not in covered]
            if not new_stories:
                return AgentResult(ok=True, summary="maintenance: no new stories — "
                                   "existing UI specs and design tokens unchanged")
            user += (
                "\n\nMAINTENANCE MODE — design tokens are FROZEN (return the "
                "current CODING_PATTERNS sections verbatim in coding_patterns; "
                "they will not be written). Produce ui_specs ONLY for these "
                f"stories: {', '.join(new_stories)}. Reuse established "
                "components and tokens."
            )

        result = self.ctx.llm.complete(
            system=self.system_blocks(PROMPT),
            user=user,
            schema=SCHEMA,
            max_tokens=16000,
        )
        data = result.parsed

        for spec in data["ui_specs"]:
            self.write_file(f"03_architecture/ui/{spec['story_id']}.md",
                            spec["markdown"].strip() + "\n")

        if not maintenance:
            self._fill_patterns(data["coding_patterns"])
        summary = f"{len(data['ui_specs'])} UI spec(s)"
        summary += ("; CODING_PATTERNS frozen (maintenance)" if maintenance
                    else "; CODING_PATTERNS sections 2-4 established")
        return AgentResult(ok=True, usage=result.usage, summary=summary)

    def _fill_patterns(self, tokens: dict) -> None:
        path = self.ctx.root / "CODING_PATTERNS.md"
        text = path.read_text(encoding="utf-8")
        for section, heading in (("colors", "## Section 2 — Colors"),
                                 ("typography", "## Section 3 — Typography"),
                                 ("spacing", "## Section 4 — Spacing")):
            # replace the placeholder blockquote under the heading, keep the heading
            pattern = re.compile(
                rf"({re.escape(heading)}\n\n)(>.*?)(\n\n## )", re.DOTALL)
            replacement = rf"\g<1>{tokens[section].strip()}\g<3>"
            new_text, count = pattern.subn(replacement, text, count=1)
            if count:
                text = new_text
        self.write_file("CODING_PATTERNS.md", text)
