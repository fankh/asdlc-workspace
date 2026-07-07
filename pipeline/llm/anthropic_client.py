"""Anthropic backend: prompt caching, structured outputs, streaming."""

from __future__ import annotations

import logging

import anthropic

from .client import LLMResult, compute_cost, validate_parsed

log = logging.getLogger("pipeline")

# SDK guard: non-streaming requests above ~16K max_tokens risk HTTP timeouts.
STREAM_THRESHOLD = 16000


class AnthropicClient:
    def __init__(self, api_key: str | None, model: str):
        placeholder = api_key and "REPLACE_ME" in api_key
        # Fall back to the SDK's own resolution (ANTHROPIC_API_KEY, ant auth
        # profile) when .env has no real key.
        self.client = (
            anthropic.Anthropic(api_key=api_key)
            if api_key and not placeholder
            else anthropic.Anthropic()
        )
        self.model = model

    def complete(
        self,
        system: list[str],
        user: str,
        schema: dict | None = None,
        max_tokens: int = 16000,
    ) -> LLMResult:
        # Stable-first system blocks; cache breakpoint on the last one caches
        # the whole prefix. Below the model's minimum cacheable prefix
        # (~2048 tokens on Sonnet 4.6) this is silently a no-op — harmless.
        system_blocks = [{"type": "text", "text": text} for text in system]
        if system_blocks:
            system_blocks[-1]["cache_control"] = {"type": "ephemeral"}

        kwargs: dict = dict(
            model=self.model,
            max_tokens=max_tokens,
            system=system_blocks or anthropic.NOT_GIVEN,
            messages=[{"role": "user", "content": user}],
        )
        if schema:
            kwargs["output_config"] = {
                "format": {"type": "json_schema", "schema": schema}
            }

        if max_tokens > STREAM_THRESHOLD:
            with self.client.messages.stream(**kwargs) as stream:
                message = stream.get_final_message()
        else:
            message = self.client.messages.create(**kwargs)

        if message.stop_reason == "max_tokens":
            log.warning("anthropic: output truncated at max_tokens=%d", max_tokens)

        text = next((b.text for b in message.content if b.type == "text"), "")
        usage = {
            "input_tokens": message.usage.input_tokens,
            "output_tokens": message.usage.output_tokens,
            "cache_read": message.usage.cache_read_input_tokens or 0,
            "cache_write": message.usage.cache_creation_input_tokens or 0,
        }
        usage["cost_usd"] = compute_cost(self.model, usage)
        if usage["cache_read"]:
            log.debug("anthropic: cache hit (%d tokens read)", usage["cache_read"])

        parsed = validate_parsed(text, schema) if schema else None
        return LLMResult(text=text, parsed=parsed, usage=usage)
