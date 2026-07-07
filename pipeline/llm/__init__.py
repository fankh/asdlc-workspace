"""LLM provider abstraction: one interface, Anthropic + Ollama backends."""

from __future__ import annotations

from typing import TYPE_CHECKING

from .client import LLMClient, LLMResult

if TYPE_CHECKING:
    from pipeline.config import Config


def make_client(config: "Config") -> LLMClient:
    provider = config.llm_provider.lower()
    if provider == "anthropic":
        import os
        from .anthropic_client import AnthropicClient
        key = config.env.get("LLM_API_KEY", "")
        if "REPLACE_ME" in key and not (
            os.environ.get("ANTHROPIC_API_KEY") or os.environ.get("ANTHROPIC_AUTH_TOKEN")
        ):
            raise RuntimeError(
                "LLM_PROVIDER=anthropic but .env LLM_API_KEY is still the "
                "placeholder and no ANTHROPIC_API_KEY is set. Add a real key "
                "to .env, or set LLM_PROVIDER=ollama."
            )
        return AnthropicClient(
            api_key=key,
            model=config.env.get("LLM_MODEL", "claude-sonnet-4-6"),
        )
    if provider == "ollama":
        from .ollama_client import OllamaClient
        return OllamaClient(
            host=config.env.get("OLLAMA_HOST", "http://localhost:11434"),
            model=config.env.get("OLLAMA_MODEL", "qwen3.6:latest"),
        )
    raise ValueError(f"unknown LLM_PROVIDER '{provider}' (anthropic | ollama)")


__all__ = ["LLMClient", "LLMResult", "make_client"]
