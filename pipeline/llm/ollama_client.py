"""Ollama backend: /api/chat with schema-constrained decoding + repair retries.

No prompt caching (no-op) and no cost (local). Local models emit malformed
JSON more often than the API path, so schema failures retry with the
validation error fed back, up to MAX_REPAIR_ATTEMPTS.
"""

from __future__ import annotations

import logging

import requests

from .client import LLMResult, SchemaValidationError, validate_parsed

log = logging.getLogger("pipeline")

MAX_REPAIR_ATTEMPTS = 3
REQUEST_TIMEOUT = 600  # local 20GB+ models are slow; generous wall clock


class OllamaClient:
    def __init__(self, host: str, model: str):
        self.host = host.rstrip("/")
        self.model = model

    def complete(
        self,
        system: list[str],
        user: str,
        schema: dict | None = None,
        max_tokens: int = 16000,
    ) -> LLMResult:
        messages = []
        if system:
            messages.append({"role": "system", "content": "\n\n".join(system)})
        messages.append({"role": "user", "content": user})

        attempts = MAX_REPAIR_ATTEMPTS if schema else 1
        last_error: Exception | None = None
        total_usage = {"input_tokens": 0, "output_tokens": 0,
                       "cache_read": 0, "cache_write": 0, "cost_usd": 0.0}

        for attempt in range(attempts):
            text, usage = self._chat(messages, schema, max_tokens)
            for key in ("input_tokens", "output_tokens"):
                total_usage[key] += usage[key]

            if not schema:
                return LLMResult(text=text, usage=total_usage)
            try:
                parsed = validate_parsed(text, schema)
                return LLMResult(text=text, parsed=parsed, usage=total_usage)
            except SchemaValidationError as exc:
                last_error = exc
                log.warning("ollama: schema failure (attempt %d/%d): %s",
                            attempt + 1, attempts, exc)
                messages.append({"role": "assistant", "content": text})
                messages.append({
                    "role": "user",
                    "content": f"Your JSON was invalid: {exc}. "
                               "Reply again with ONLY the corrected JSON object.",
                })

        raise SchemaValidationError(
            f"ollama: schema still failing after {attempts} attempts: {last_error}"
        )

    def _chat(self, messages: list[dict], schema: dict | None,
              max_tokens: int) -> tuple[str, dict]:
        payload: dict = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": {"num_predict": max_tokens},
        }
        if schema:
            payload["format"] = schema  # Ollama supports full JSON Schema here

        resp = requests.post(f"{self.host}/api/chat", json=payload,
                             timeout=REQUEST_TIMEOUT)
        resp.raise_for_status()
        data = resp.json()
        usage = {
            "input_tokens": data.get("prompt_eval_count", 0),
            "output_tokens": data.get("eval_count", 0),
        }
        return data["message"]["content"], usage
