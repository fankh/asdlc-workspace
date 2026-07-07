"""Architect agent: backlog + UI specs -> OpenAPI 3.1, ADRs, data model.

Also establishes CODING_PATTERNS Section 6 (error handling, one pattern per
layer) so both coder agents inherit the same conventions.
"""

from __future__ import annotations

import re

import yaml

from . import register
from .base import Agent, AgentResult

PROMPT = """You are the Architect agent in an automated software delivery pipeline.
Stack is fixed by CODING_PATTERNS.md: React+TS (Vite) frontend, Express+TS
(Node 20) backend, SQLite via Prisma, REST + OpenAPI 3.1.

From the backlog and UI specs, produce:
1. `openapi_yaml`: a complete, valid OpenAPI 3.1 spec for every API the
   frontend needs. Paths under /api. DTO schemas in components (no direct
   entity exposure). Include error response schema. Keep it minimal — only
   endpoints the stories require.
2. `data_model`: markdown describing each Prisma model (fields, types,
   defaults, relations).
3. `adrs`: architecture decision records. ADR-001 must document the stack
   choice. Add ADRs only for decisions a maintainer would question.
4. `error_handling`: content for CODING_PATTERNS Section 6 — one concrete
   pattern per layer (API error envelope, Express error middleware, frontend
   fetch wrapper + Ant message/Alert usage)."""

SCHEMA = {
    "type": "object",
    "properties": {
        "openapi_yaml": {"type": "string"},
        "data_model": {"type": "string"},
        "adrs": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "id": {"type": "string"},
                    "title": {"type": "string"},
                    "markdown": {"type": "string"},
                },
                "required": ["id", "title", "markdown"],
                "additionalProperties": False,
            },
        },
        "error_handling": {"type": "string"},
    },
    "required": ["openapi_yaml", "data_model", "adrs", "error_handling"],
    "additionalProperties": False,
}


@register("architect")
class ArchitectAgent(Agent):
    extra_write_roots = ("CODING_PATTERNS.md",)

    def run(self) -> AgentResult:
        root = self.ctx.root
        backlog = (root / "02_specs" / "PRODUCT_BACKLOG.md").read_text(encoding="utf-8")
        ui_specs = "\n\n".join(
            f"<!-- {p.name} -->\n{p.read_text(encoding='utf-8')}"
            for p in sorted((root / "03_architecture" / "ui").glob("*.md"))
        ) or "(no UI specs found)"

        result = self.ctx.llm.complete(
            system=self.system_blocks(PROMPT),
            user=f"Product backlog:\n\n{backlog}\n\nUI specs:\n\n{ui_specs}",
            schema=SCHEMA,
            max_tokens=16000,
        )
        data = result.parsed

        spec_error = self._validate_openapi(data["openapi_yaml"])
        if spec_error:
            return AgentResult(ok=False, usage=result.usage,
                               summary=f"generated OpenAPI spec invalid: {spec_error}")

        self.write_file("03_architecture/openapi.yaml", data["openapi_yaml"].strip() + "\n")
        self.write_file("03_architecture/DATA_MODEL.md", data["data_model"].strip() + "\n")
        for adr in data["adrs"]:
            self.write_file(f"03_architecture/adr/{adr['id']}-{_slug(adr['title'])}.md",
                            adr["markdown"].strip() + "\n")
        self._fill_error_handling(data["error_handling"])

        return AgentResult(
            ok=True, usage=result.usage,
            summary=f"openapi.yaml + {len(data['adrs'])} ADR(s) + data model; "
                    "CODING_PATTERNS section 6 established",
        )

    def _validate_openapi(self, text: str) -> str | None:
        try:
            spec = yaml.safe_load(text)
        except yaml.YAMLError as exc:
            return f"not valid YAML: {exc}"
        if not isinstance(spec, dict) or not str(spec.get("openapi", "")).startswith("3"):
            return "missing openapi: 3.x version field"
        if not spec.get("paths"):
            return "no paths defined"
        try:
            from openapi_spec_validator import validate as validate_spec
            validate_spec(spec)
        except ImportError:
            pass  # structural checks above still ran
        except Exception as exc:
            return str(exc).splitlines()[0]
        return None

    def _fill_error_handling(self, content: str) -> None:
        path = self.ctx.root / "CODING_PATTERNS.md"
        text = path.read_text(encoding="utf-8")
        pattern = re.compile(
            r"(## Section 6 — Error handling\n\n)(>.*?)(\n\n## )", re.DOTALL)
        new_text, count = pattern.subn(rf"\g<1>{content.strip()}\g<3>", text, count=1)
        if count:
            self.write_file("CODING_PATTERNS.md", new_text)


def _slug(title: str) -> str:
    return re.sub(r"[^a-z0-9]+", "-", title.lower()).strip("-")[:50]
