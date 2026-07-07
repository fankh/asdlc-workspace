"""Agent registry: stage agent key -> Agent class.

Agents are registered lazily so an unimplemented agent only fails if its
stage actually runs. Real agents replace NotImplementedAgent as they land.
"""

from __future__ import annotations

from .base import Agent, AgentContext, AgentResult, NotImplementedAgent

_REGISTRY: dict[str, type[Agent]] = {}


def register(name: str):
    def deco(cls: type[Agent]) -> type[Agent]:
        _REGISTRY[name] = cls
        return cls
    return deco


def get_agent(name: str) -> type[Agent]:
    if name in _REGISTRY:
        return _REGISTRY[name]
    return NotImplementedAgent


def _load_all() -> None:
    """Import agent modules so their @register decorators run."""
    from importlib import import_module
    for mod in (
        "pipeline.agents.ingestion",
        "pipeline.agents.product",
        "pipeline.agents.design",
        "pipeline.agents.architect",
        "pipeline.agents.coder_frontend",
        "pipeline.agents.coder_backend",
        "pipeline.agents.secops",
        "pipeline.agents.qa",
        "pipeline.agents.refinement",
        "pipeline.agents.docs",
        "pipeline.agents.discovery",
    ):
        try:
            import_module(mod)
        except ModuleNotFoundError:
            pass  # not implemented yet -> NotImplementedAgent fallback


_load_all()

__all__ = ["Agent", "AgentContext", "AgentResult", "register", "get_agent"]
