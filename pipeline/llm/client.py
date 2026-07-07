"""Provider-neutral LLM client interface.

Contract shared by both backends:
- `system` is a list of stable-first text blocks. The Anthropic backend caches
  them (prompt caching); Ollama concatenates them (no cache).
- `schema` (JSON Schema) forces structured output. `LLMResult.parsed` is then
  the validated object; agents never parse freeform text themselves.
"""

from __future__ import annotations

import json
from dataclasses import dataclass, field
from typing import Any, Protocol

import jsonschema


@dataclass
class LLMResult:
    text: str
    parsed: Any = None
    usage: dict[str, Any] = field(default_factory=dict)
    # usage keys: input_tokens, output_tokens, cache_read, cache_write, cost_usd


class LLMClient(Protocol):
    def complete(
        self,
        system: list[str],
        user: str,
        schema: dict | None = None,
        max_tokens: int = 16000,
    ) -> LLMResult: ...


class SchemaValidationError(ValueError):
    pass


def validate_parsed(text: str, schema: dict) -> Any:
    """Parse text as JSON and validate against schema. Raises on failure."""
    try:
        obj = json.loads(_strip_fences(text))
    except json.JSONDecodeError as exc:
        raise SchemaValidationError(f"model output is not valid JSON: {exc}") from exc
    try:
        jsonschema.validate(obj, schema)
    except jsonschema.ValidationError as exc:
        raise SchemaValidationError(f"model output failed schema: {exc.message}") from exc
    return obj


def _strip_fences(text: str) -> str:
    """Local models often wrap JSON in ```json fences despite instructions."""
    stripped = text.strip()
    if stripped.startswith("```"):
        first_newline = stripped.index("\n") if "\n" in stripped else len(stripped)
        stripped = stripped[first_newline + 1:]
        if stripped.rstrip().endswith("```"):
            stripped = stripped.rstrip()[:-3]
    return stripped


# USD per million tokens: (input, output). Cache write = 1.25x input,
# cache read = 0.1x input. Unknown models cost 0 (logged as a warning once).
PRICING_PER_MTOK: dict[str, tuple[float, float]] = {
    "claude-opus-4-8": (5.00, 25.00),
    "claude-opus-4-7": (5.00, 25.00),
    "claude-opus-4-6": (5.00, 25.00),
    "claude-sonnet-5": (3.00, 15.00),
    "claude-sonnet-4-6": (3.00, 15.00),
    "claude-haiku-4-5": (1.00, 5.00),
}


def compute_cost(model: str, usage: dict[str, Any]) -> float:
    prices = PRICING_PER_MTOK.get(model)
    if not prices:
        return 0.0
    inp, out = prices
    cost = (
        usage.get("input_tokens", 0) * inp
        + usage.get("output_tokens", 0) * out
        + usage.get("cache_write", 0) * inp * 1.25
        + usage.get("cache_read", 0) * inp * 0.1
    ) / 1_000_000
    return round(cost, 6)
