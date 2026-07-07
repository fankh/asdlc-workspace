"""LLM abstraction tests.

Logic tests always run. Live provider round-trips run when the provider is
reachable (Ollama) or credentialed (Anthropic); otherwise they skip.
"""

import os
import sys
from pathlib import Path

import pytest
import requests

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

from pipeline.llm.client import (  # noqa: E402
    SchemaValidationError, compute_cost, validate_parsed,
)

SCHEMA = {
    "type": "object",
    "properties": {
        "greeting": {"type": "string"},
        "number": {"type": "integer"},
    },
    "required": ["greeting", "number"],
    "additionalProperties": False,
}
PROMPT = 'Return JSON with greeting="hello" and number=42.'


# -- pure logic ----------------------------------------------------------


def test_validate_parsed_ok():
    obj = validate_parsed('{"greeting": "hi", "number": 1}', SCHEMA)
    assert obj["number"] == 1


def test_validate_parsed_strips_fences():
    obj = validate_parsed('```json\n{"greeting": "hi", "number": 2}\n```', SCHEMA)
    assert obj["number"] == 2


def test_validate_parsed_rejects_bad_json():
    with pytest.raises(SchemaValidationError):
        validate_parsed("not json", SCHEMA)


def test_validate_parsed_rejects_schema_miss():
    with pytest.raises(SchemaValidationError):
        validate_parsed('{"greeting": "hi"}', SCHEMA)


def test_compute_cost_sonnet():
    usage = {"input_tokens": 1_000_000, "output_tokens": 1_000_000,
             "cache_read": 0, "cache_write": 0}
    assert compute_cost("claude-sonnet-4-6", usage) == 18.0


def test_compute_cost_unknown_model_is_zero():
    assert compute_cost("mystery-model", {"input_tokens": 999}) == 0.0


# -- live round-trips ----------------------------------------------------


def _ollama_up(host: str) -> bool:
    try:
        return requests.get(f"{host}/api/tags", timeout=3).ok
    except requests.RequestException:
        return False


def test_ollama_schema_roundtrip():
    host = os.environ.get("OLLAMA_HOST", "http://localhost:11434")
    if not _ollama_up(host):
        pytest.skip("ollama not reachable")
    from pipeline.llm.ollama_client import OllamaClient
    client = OllamaClient(host, os.environ.get("OLLAMA_MODEL", "qwen3.6:latest"))
    result = client.complete(system=["You output only JSON."], user=PROMPT,
                             schema=SCHEMA, max_tokens=2000)
    assert result.parsed["greeting"]
    assert isinstance(result.parsed["number"], int)
    assert result.usage["output_tokens"] > 0


def _anthropic_key() -> str | None:
    key = os.environ.get("LLM_API_KEY") or os.environ.get("ANTHROPIC_API_KEY")
    if key and "REPLACE_ME" not in key:
        return key
    return None


def test_anthropic_schema_roundtrip_and_cache():
    if not _anthropic_key():
        pytest.skip("no anthropic API key configured")
    from pipeline.llm.anthropic_client import AnthropicClient
    client = AnthropicClient(_anthropic_key(), os.environ.get("LLM_MODEL", "claude-sonnet-4-6"))
    # pad the system prompt past the min cacheable prefix (~2048 tokens)
    stable = "You output only JSON. " + ("Context filler sentence. " * 500)
    first = client.complete(system=[stable], user=PROMPT, schema=SCHEMA, max_tokens=500)
    assert first.parsed["number"] == 42
    second = client.complete(system=[stable], user=PROMPT + " Again.", schema=SCHEMA, max_tokens=500)
    assert second.usage["cache_read"] > 0, "expected prompt-cache hit on 2nd call"
