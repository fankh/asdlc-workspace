"""Load .env and .pipeline/config.yaml into one Config object."""

from __future__ import annotations

import os
from dataclasses import dataclass, field
from pathlib import Path
from typing import Any

import yaml
from dotenv import load_dotenv

# The engine lives here (parent of pipeline/). It is also the DEFAULT workspace
# when no --workspace is given, so a plain `run-pipeline.py run` still works.
ENGINE_ROOT = Path(__file__).resolve().parent.parent
WORKSPACE_ROOT = ENGINE_ROOT  # backward-compat alias

VALID_PROJECT_TYPES = {"website", "sns", "ide", "appliance", "b2b_console", "secops_console"}


@dataclass
class Config:
    root: Path                  # the workspace being operated on
    project: dict[str, Any]
    agents: dict[str, Any]
    refinement: dict[str, Any]
    phases: dict[str, Any]
    engine_root: Path = ENGINE_ROOT   # where pipeline/ and tools/ live
    repo: dict[str, Any] = field(default_factory=dict)
    requirements: dict[str, Any] = field(default_factory=dict)
    env: dict[str, str] = field(default_factory=dict)

    @property
    def tools_dir(self) -> Path:
        """ui-test-agent lives in the engine; fall back to a workspace-local
        copy if one exists (self-contained legacy workspaces)."""
        local = self.root / "tools" / "ui-test-agent"
        return local if local.exists() else self.engine_root / "tools" / "ui-test-agent"

    @property
    def llm_provider(self) -> str:
        return self.env.get("LLM_PROVIDER", "anthropic")

    @property
    def mode(self) -> str:
        """'new' or 'maintenance'. Auto-detects maintenance when 04_source/
        already holds generated app code (per the config.yaml contract)."""
        declared = self.project.get("mode", "new")
        if declared == "new" and (
            self.root / "04_source" / "frontend" / "src" / "App.tsx"
        ).exists():
            return "maintenance"
        return declared

    @property
    def max_refinement_loops(self) -> int:
        env_val = self.env.get("PIPELINE_MAX_REFINEMENT_LOOPS")
        if env_val:
            return int(env_val)
        return int(self.refinement.get("max_loops", 5))

    @property
    def auto_commit(self) -> bool:
        return self.env.get("PIPELINE_AUTO_COMMIT", "true").lower() == "true"

    @property
    def stop_after(self) -> str | None:
        return self.phases.get("stop_after") or None

    def agent_enabled(self, name: str) -> bool:
        node = self.agents.get(name, {})
        if isinstance(node, dict):
            return bool(node.get("enabled", True))
        return bool(node)


def load_config(root: Path | None = None) -> Config:
    root = root or WORKSPACE_ROOT
    load_dotenv(root / ".env")

    raw = yaml.safe_load((root / ".pipeline" / "config.yaml").read_text(encoding="utf-8"))

    project = raw.get("project", {})
    ptype = project.get("type")
    if ptype not in VALID_PROJECT_TYPES:
        raise ValueError(f"project.type '{ptype}' not one of {sorted(VALID_PROJECT_TYPES)}")

    env_type = os.environ.get("PROJECT_TYPE")
    if env_type and env_type != ptype:
        raise ValueError(f".env PROJECT_TYPE={env_type} does not match config.yaml type={ptype}")

    keys = [
        "LLM_PROVIDER", "LLM_API_KEY", "LLM_MODEL",
        "OLLAMA_HOST", "OLLAMA_MODEL",
        "PROJECT_TYPE", "PIPELINE_MAX_REFINEMENT_LOOPS",
        "PIPELINE_AUTO_COMMIT", "PIPELINE_PARALLEL_AGENTS",
    ]
    env = {k: os.environ[k] for k in keys if k in os.environ}

    return Config(
        root=root,
        project=project,
        agents=raw.get("agents", {}),
        refinement=raw.get("refinement", {}),
        phases=raw.get("phases", {}),
        engine_root=ENGINE_ROOT,
        repo=raw.get("repo", {}),
        requirements=raw.get("requirements", {}),
        env=env,
    )
