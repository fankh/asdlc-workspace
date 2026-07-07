"""Testgen agent: Gherkin backlog -> Playwright specs (POM style).

Also writes 05_test_reports/test-map.json (spec file <-> story id) so the
refinement agent can trace a failing test back to its story and UI spec.
The shipped e2e/home.spec.ts + pages/HomePage.ts define the house style.
"""

from __future__ import annotations

import json
import logging
import re

from . import register
from .base import FILES_SCHEMA, Agent, AgentResult

log = logging.getLogger("pipeline")

E2E = "04_source/frontend/e2e"

PROMPT = """You are the Testgen agent in an automated software delivery pipeline.
Translate EVERY Gherkin scenario in the backlog into Playwright tests,
matching the house style of the existing e2e/home.spec.ts and
e2e/pages/HomePage.ts you receive (Page Object Model, @axe-core/playwright
for accessibility scenarios, getByRole/getByText selectors on visible copy).

Rules:
- One spec file per story: e2e/<story-id-lowercase>.spec.ts, plus page
  objects in e2e/pages/ (reuse HomePage.ts — do not regenerate it unless a
  selector must change to match the UI specs).
- Test titles must start with the story id, e.g. "STORY-002: submits the form".
- Tests run against baseURL (default http://localhost:3000); backend API is
  live, so data-mutating tests must create what they assert on.
- Accessibility scenarios: AxeBuilder, fail on severity serious/critical.
- No arbitrary timeouts; rely on Playwright auto-waiting.
Return ONLY spec/page-object files under e2e/."""


@register("testgen")
class TestgenAgent(Agent):
    extra_write_roots = ("04_source/frontend",)

    def run(self) -> AgentResult:
        root = self.ctx.root
        backlog_path = root / "02_specs" / "PRODUCT_BACKLOG.md"
        if not backlog_path.exists():
            return AgentResult(ok=False, summary="backlog missing")
        backlog = backlog_path.read_text(encoding="utf-8")

        house_style = "\n\n".join(
            f"# Existing {p.relative_to(root)}\n\n```ts\n{p.read_text(encoding='utf-8')}\n```"
            for p in [root / E2E / "home.spec.ts", root / E2E / "pages" / "HomePage.ts"]
            if p.exists()
        )
        app_files = "\n".join(
            str(p.relative_to(root / "04_source/frontend"))
            for p in sorted((root / "04_source/frontend/src").rglob("*.tsx"))
        )

        user = (f"# Backlog\n\n{backlog}\n\n{house_style}\n\n"
                f"# Frontend source files (for selector context)\n{app_files}")

        maintenance = self.ctx.config.mode == "maintenance"
        if maintenance:
            existing_specs = sorted(
                p.name for p in (root / E2E).glob("*.spec.ts"))
            covered = {m.group(1).upper() for name in existing_specs
                       if (m := re.match(r"(story-\d+)\.spec\.ts", name))}
            uncovered = [s for s in re.findall(r"## (STORY-\d+)", backlog)
                         if s not in covered]
            if not uncovered:
                return AgentResult(ok=True, summary="maintenance: every story already "
                                   "has a spec — existing tests untouched")
            user += (
                "\n\nMAINTENANCE MODE — existing specs "
                f"({', '.join(existing_specs)}) are the shipped contract and "
                "must NOT be regenerated. Return spec/page-object files ONLY "
                f"for: {', '.join(uncovered)}."
            )

        result = self.ctx.llm.complete(
            system=self.system_blocks(PROMPT),
            user=user,
            schema=FILES_SCHEMA,
            max_tokens=32000,
        )
        files = result.parsed["files"]
        if not files:
            return AgentResult(ok=False, usage=result.usage, summary="no tests generated")

        map_path = root / "05_test_reports" / "test-map.json"
        test_map: dict[str, str] = (
            json.loads(map_path.read_text(encoding="utf-8"))
            if maintenance and map_path.exists() else {}
        )
        for entry in files:
            rel = entry["path"].lstrip("/")
            rel = rel.removeprefix("04_source/frontend/")
            if not rel.startswith("e2e/"):
                rel = f"e2e/{rel}"
            if (maintenance and rel.endswith(".spec.ts")
                    and (root / "04_source/frontend" / rel).exists()):
                log.warning("testgen: refused overwrite of shipped spec %s", rel)
                continue
            self.write_file(f"04_source/frontend/{rel}", entry["content"].rstrip() + "\n")
            story = re.match(r"e2e/(story-\d+)\.spec\.ts", rel)
            if story:
                test_map[rel] = story.group(1).upper()

        test_map.setdefault("e2e/home.spec.ts", "STORY-001")
        self.write_file("05_test_reports/test-map.json",
                        json.dumps(test_map, indent=2) + "\n")
        return AgentResult(ok=True, usage=result.usage,
                           summary=f"{len(files)} test file(s); map covers "
                                   f"{len(set(test_map.values()))} stories")

    def _allowed_roots(self):
        # also allow the test-map in 05_test_reports
        return super()._allowed_roots() + [
            (self.ctx.root / "05_test_reports").resolve()
        ]
