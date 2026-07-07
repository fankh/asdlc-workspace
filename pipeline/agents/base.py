"""Agent base class, execution context, and the sandboxed file-write protocol."""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from pathlib import Path
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from pipeline.config import Config
    from pipeline.llm.client import LLMClient
    from pipeline.state import State

log = logging.getLogger("pipeline")


@dataclass
class AgentContext:
    config: "Config"
    state: "State"
    root: Path
    stage_name: str
    output_dir: Path
    dry_run: bool = False
    _llm: "LLMClient | None" = None

    @property
    def llm(self) -> "LLMClient":
        if self._llm is None:
            from pipeline.llm import make_client
            self._llm = make_client(self.config)
        return self._llm

    def coding_patterns(self) -> str:
        return (self.root / "CODING_PATTERNS.md").read_text(encoding="utf-8")


@dataclass
class AgentResult:
    ok: bool
    summary: str = ""
    usage: dict[str, Any] = field(default_factory=dict)
    details: dict[str, Any] = field(default_factory=dict)


class Agent:
    """Base agent. Subclasses implement run(); file writes go through
    write_file() which sandboxes paths to the declared roots."""

    #: extra roots (relative to workspace) an agent may write besides its
    #: stage output dir, e.g. the coder agents write into 04_source/*.
    extra_write_roots: tuple[str, ...] = ()

    def __init__(self, ctx: AgentContext):
        self.ctx = ctx

    def run(self) -> AgentResult:  # pragma: no cover - abstract
        raise NotImplementedError

    def system_blocks(self, agent_prompt: str) -> list[str]:
        """Stable-first system blocks: agent prompt, then CODING_PATTERNS.md.
        Order matters for prompt caching — keep volatile content in `user`."""
        return [agent_prompt, self.ctx.coding_patterns()]

    # -- sandboxed writes -------------------------------------------------

    def _allowed_roots(self) -> list[Path]:
        roots = [self.ctx.output_dir.resolve()]
        roots += [(self.ctx.root / r).resolve() for r in self.extra_write_roots]
        return roots

    def write_file(self, rel_path: str | Path, content: str) -> Path:
        target = (self.ctx.root / rel_path).resolve()
        if not any(target.is_relative_to(root) for root in self._allowed_roots()):
            raise PermissionError(
                f"{self.ctx.stage_name}: refusing write outside sandbox: {target}"
            )
        target.parent.mkdir(parents=True, exist_ok=True)
        target.write_text(content, encoding="utf-8", newline="\n")
        log.info("  wrote %s", target.relative_to(self.ctx.root))
        return target


# Shared output protocol for code-writing agents: schema-validated file list,
# never freeform text with fenced blocks.
FILES_SCHEMA = {
    "type": "object",
    "properties": {
        "files": {
            "type": "array",
            "items": {
                "type": "object",
                "properties": {
                    "path": {"type": "string"},
                    "content": {"type": "string"},
                },
                "required": ["path", "content"],
                "additionalProperties": False,
            },
        },
        "notes": {"type": "string"},
    },
    "required": ["files", "notes"],
    "additionalProperties": False,
}


class NoopAgent(Agent):
    """Dry-run placeholder: succeeds without doing anything."""

    def run(self) -> AgentResult:
        return AgentResult(ok=True, summary=f"[dry-run] {self.ctx.stage_name} no-op")


class NotImplementedAgent(Agent):
    def run(self) -> AgentResult:
        return AgentResult(
            ok=False,
            summary=f"agent for stage '{self.ctx.stage_name}' is not implemented yet",
        )
