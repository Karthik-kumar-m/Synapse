"""Ollama API client with retry and model fallback support."""

from __future__ import annotations

import json
from typing import Any, Dict

import httpx

from config import settings


async def _generate_once(model: str, prompt: str) -> Dict[str, Any]:
    url = f"{settings.OLLAMA_BASE_URL.rstrip('/')}/api/generate"
    payload = {
        "model": model,
        "prompt": prompt,
        "format": "json" if settings.OLLAMA_STRICT_JSON else None,
        "stream": False,
        "options": {
            "temperature": 0,
        },
    }
    if payload["format"] is None:
        payload.pop("format", None)

    timeout = httpx.Timeout(settings.OLLAMA_TIMEOUT_SECONDS)
    async with httpx.AsyncClient(timeout=timeout) as client:
        response = await client.post(url, json=payload)
        response.raise_for_status()
        body = response.json()

    raw = body.get("response", "")
    if not isinstance(raw, str) or not raw.strip():
        raise ValueError("Ollama response payload is missing 'response' JSON string")

    parsed = json.loads(raw)
    if not isinstance(parsed, dict):
        raise ValueError("Ollama JSON response must be an object")
    return parsed


async def generate_json(prompt: str) -> Dict[str, Any]:
    """Generate structured JSON from Ollama using configured model policy."""
    primary = settings.OLLAMA_MODEL_PRIMARY
    fallback = settings.OLLAMA_MODEL_FALLBACK
    retries = max(settings.OLLAMA_RETRY_COUNT, 0)

    last_error: Exception | None = None

    for _ in range(retries + 1):
        try:
            return await _generate_once(primary, prompt)
        except Exception as exc:  # pragma: no cover - network/model failure path
            last_error = exc

    if fallback and fallback != primary:
        return await _generate_once(fallback, prompt)

    if last_error is not None:
        raise last_error
    raise RuntimeError("Ollama generation failed without error details")
