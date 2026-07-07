"""Message Batches path: 50% price for non-interactive fan-out stages.

Used when PIPELINE_PARALLEL_AGENTS=true and the provider is Anthropic
(Ollama has no batch API — callers fall back to sequential complete()).
"""

from __future__ import annotations

import logging
import time
from typing import Any

from .client import LLMResult, compute_cost, validate_parsed

log = logging.getLogger("pipeline")

POLL_SECONDS = 15
BATCH_TIMEOUT = 3600


def run_batch(
    api_key: str | None,
    model: str,
    requests_in: list[dict[str, Any]],
) -> dict[str, LLMResult]:
    """requests_in: [{id, system: [str], user: str, schema: dict|None,
    max_tokens: int}]. Returns {id: LLMResult}. Raises on timeout."""
    import anthropic
    from anthropic.types.message_create_params import MessageCreateParamsNonStreaming
    from anthropic.types.messages.batch_create_params import Request

    client = anthropic.Anthropic(api_key=api_key) if api_key else anthropic.Anthropic()

    def params(req: dict) -> MessageCreateParamsNonStreaming:
        system_blocks = [{"type": "text", "text": t} for t in req.get("system", [])]
        if system_blocks:
            system_blocks[-1]["cache_control"] = {"type": "ephemeral"}
        p: dict = dict(
            model=model,
            max_tokens=req.get("max_tokens", 16000),
            system=system_blocks,
            messages=[{"role": "user", "content": req["user"]}],
        )
        if req.get("schema"):
            p["output_config"] = {"format": {"type": "json_schema", "schema": req["schema"]}}
        return MessageCreateParamsNonStreaming(**p)

    batch = client.messages.batches.create(
        requests=[Request(custom_id=r["id"], params=params(r)) for r in requests_in]
    )
    log.info("batch %s: %d request(s) submitted (50%% pricing)", batch.id, len(requests_in))

    deadline = time.monotonic() + BATCH_TIMEOUT
    while time.monotonic() < deadline:
        batch = client.messages.batches.retrieve(batch.id)
        if batch.processing_status == "ended":
            break
        time.sleep(POLL_SECONDS)
    else:
        raise TimeoutError(f"batch {batch.id} did not finish within {BATCH_TIMEOUT}s")

    schemas = {r["id"]: r.get("schema") for r in requests_in}
    results: dict[str, LLMResult] = {}
    for entry in client.messages.batches.results(batch.id):
        if entry.result.type != "succeeded":
            log.warning("batch item %s: %s", entry.custom_id, entry.result.type)
            continue
        message = entry.result.message
        text = next((b.text for b in message.content if b.type == "text"), "")
        usage = {
            "input_tokens": message.usage.input_tokens,
            "output_tokens": message.usage.output_tokens,
            "cache_read": message.usage.cache_read_input_tokens or 0,
            "cache_write": message.usage.cache_creation_input_tokens or 0,
        }
        usage["cost_usd"] = round(compute_cost(model, usage) * 0.5, 6)  # batch discount
        schema = schemas.get(entry.custom_id)
        results[entry.custom_id] = LLMResult(
            text=text,
            parsed=validate_parsed(text, schema) if schema else None,
            usage=usage,
        )
    return results
