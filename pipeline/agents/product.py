"""Product agent: normalized requirements -> Gherkin backlog in 02_specs/.

Emits schema-validated stories, then renders PRODUCT_BACKLOG.md in the
scaffold's existing format (INVEST story + Gherkin acceptance criteria +
bound-tests section). The QA gate later treats these scenarios as the
contract.
"""

from __future__ import annotations

import logging

from . import register
from .base import Agent, AgentResult

log = logging.getLogger("pipeline")

MIN_SCENARIOS = 3  # repo Phase-1 exit criterion

PROMPT = """You are the Product agent in an automated software delivery pipeline.
From the normalized requirements you receive, produce an INVEST product backlog
for the FIRST release of this application.

Rules:
- 2 to 5 stories, ordered by priority. IDs STORY-001, STORY-002, ...
- STORY-001 is the landing/home page. Derive its content from the
  requirements: if they define what the landing page shows, STORY-001 IS that
  page — do NOT invent a separate marketing landing on top of it. Include a
  heading with the product name.
- Mirror the requirements' story decomposition: if they enumerate N stories,
  produce those N (plus nothing extra beyond the landing rule above).
- Each story: title, as_a / i_want / so_that, and 1-4 Gherkin scenarios.
- One scenario per behaviour. Given/When/Then steps, concrete and testable
  against a web UI (selectors by visible text, URLs, HTTP status).
- Include one accessibility scenario ('no axe-core violations of severity
  "serious" or higher') for each user-facing page story.
- Stay within what the requirements actually ask for. No invented features."""

SCHEMA = {
    "type": "object",
    "properties": {
        "product_name": {"type": "string"},
        "stories": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "title": {"type": "string"},
                    "as_a": {"type": "string"},
                    "i_want": {"type": "string"},
                    "so_that": {"type": "string"},
                    "feature": {"type": "string"},
                    "scenarios": {
                        "type": "array",
                        "items": {
                            "type": "object",
                            "properties": {
                                "name": {"type": "string"},
                                "steps": {"type": "array", "items": {"type": "string"}},
                            },
                            "required": ["name", "steps"],
                            "additionalProperties": False,
                        },
                    },
                },
                "required": ["id", "title", "as_a", "i_want", "so_that",
                             "feature", "scenarios"],
                "additionalProperties": False,
            },
        },
    },
    "required": ["product_name", "stories"],
    "additionalProperties": False,
}


@register("product")
class ProductAgent(Agent):
    def run(self) -> AgentResult:
        normalized_dir = self.ctx.root / "01_requirements" / "normalized"
        docs = sorted(normalized_dir.glob("*.md")) if normalized_dir.exists() else []
        discovered = sorted(
            (self.ctx.root / "01_requirements" / "discovered" / "tickets").glob("*.md")
        ) if (self.ctx.root / "01_requirements" / "discovered").exists() else []

        if not docs and not discovered:
            return AgentResult(ok=False, summary="no normalized requirements in "
                               "01_requirements/ — run the ingest stage first")

        corpus = "\n\n---\n\n".join(
            f"<!-- {p.name} -->\n{p.read_text(encoding='utf-8')}"
            for p in docs + discovered
        )

        user = f"Normalized requirements:\n\n{corpus}"
        backlog_path = self.ctx.root / "02_specs" / "PRODUCT_BACKLOG.md"
        if self.ctx.config.mode == "maintenance" and backlog_path.exists():
            user += (
                "\n\n---\n\nMAINTENANCE MODE — an application already exists. "
                "Current backlog (shipped stories are the contract):\n\n"
                f"{backlog_path.read_text(encoding='utf-8')}\n\n"
                "Return the FULL backlog: keep every existing story verbatim "
                "(same IDs, titles, scenarios) unless a requirement explicitly "
                "changed it, and APPEND new stories (next sequential IDs) for "
                "requirements or discovered tickets not yet covered."
            )

        result = self.ctx.llm.complete(
            system=self.system_blocks(PROMPT),
            user=user,
            schema=SCHEMA,
            max_tokens=16000,
        )
        backlog = result.parsed
        scenario_count = sum(len(s["scenarios"]) for s in backlog["stories"])
        if scenario_count < MIN_SCENARIOS:
            return AgentResult(ok=False, usage=result.usage,
                               summary=f"only {scenario_count} scenario(s) generated "
                                       f"(need >= {MIN_SCENARIOS})")

        self.write_file("02_specs/PRODUCT_BACKLOG.md", render_backlog(backlog))
        return AgentResult(
            ok=True, usage=result.usage,
            summary=f"{len(backlog['stories'])} stories / {scenario_count} scenarios "
                    f"for '{backlog['product_name']}'",
            details={"stories": [s["id"] for s in backlog["stories"]]},
        )


def render_backlog(backlog: dict) -> str:
    lines = [
        "# Product Backlog",
        "",
        "Acceptance criteria are **the contract**. The QA agent passes when every "
        "Gherkin scenario here passes, and not before.",
        "",
        "Format: INVEST stories with Gherkin (Given/When/Then). "
        "One scenario per behaviour, not per page.",
        "",
        "---",
    ]
    for story in backlog["stories"]:
        lines += [
            "",
            f"## {story['id']} — {story['title']}",
            "",
            f"**As a** {story['as_a']}",
            f"**I want** {story['i_want']}",
            f"**So that** {story['so_that']}",
            "",
            "### Acceptance criteria",
            "",
            "```gherkin",
            f"Feature: {story['feature']}",
        ]
        for scenario in story["scenarios"]:
            lines.append("")
            lines.append(f"  Scenario: {scenario['name']}")
            lines += [f"    {step}" for step in scenario["steps"]]
        lines += ["```", ""]
        if story["id"] == "STORY-001":
            lines += [
                "### Bound tests",
                "",
                "- Playwright: `04_source/frontend/e2e/home.spec.ts`",
                "- AI vision scenario: `scenarios/home.yaml`",
                "",
            ]
        lines += ["### Status", "", "`PENDING` — awaiting implementation.", "", "---"]
    return "\n".join(lines) + "\n"
