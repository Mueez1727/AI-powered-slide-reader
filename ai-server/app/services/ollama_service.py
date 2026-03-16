"""
Ollama integration service for local LLM inference.
Uses the phi3:mini model for fast inference on consumer hardware.

Key design choices
──────────────────
• ``httpx.AsyncClient`` instead of ``requests`` — non-blocking I/O so
  FastAPI can serve other requests while Ollama is thinking.
• Explicit phi3:mini tuning (``num_ctx``, ``num_predict``, ``num_gpu_layers``)
  keeps VRAM / RAM usage modest, leaving headroom for
  embeddings + FAISS + the OS.
• Structured error objects instead of silent string fallbacks so the
  caller can decide how to surface failures.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass

import httpx

from app.config import settings

logger = logging.getLogger(__name__)

# ── Timeout configuration ───────────────────────────────────
_CONNECT_TIMEOUT = 10.0       # seconds to establish TCP connection
_READ_TIMEOUT = 300.0         # seconds to wait for a full response
_TIMEOUT = httpx.Timeout(_READ_TIMEOUT, connect=_CONNECT_TIMEOUT)

# ── phi3:mini inference options ─────────────────────────────
_DEFAULT_OPTIONS = {
    "temperature": 0.3,       # low temperature → deterministic
    "top_p": 0.9,
    "repeat_penalty": 1.15,
    "num_predict": 1024,      # max tokens to generate
    "num_ctx": 4096,          # phi3:mini supports 4K context natively
    "num_gpu_layers": 0,      # CPU-only safe default; set >0 if GPU available
}


# ── Result types ────────────────────────────────────────────

@dataclass
class OllamaResult:
    """Structured result from an Ollama call."""
    ok: bool
    content: str
    model: str
    eval_count: int | None = None      # tokens generated
    eval_duration_ms: float | None = None  # generation wall-time


class OllamaService:
    """Async interface to the local Ollama server (phi3:mini)."""

    def __init__(self) -> None:
        self.base_url: str = settings.ollama_base_url.rstrip("/")
        self.model: str = settings.ollama_model  # "llama3"
        self._client = httpx.AsyncClient(base_url=self.base_url, timeout=_TIMEOUT)

    # ── Lifecycle ───────────────────────────────────────────

    async def close(self) -> None:
        """Gracefully close the HTTP connection pool."""
        await self._client.aclose()

    async def health_check(self) -> bool:
        """Return *True* if Ollama is reachable and the model is pulled."""
        try:
            resp = await self._client.get("/api/tags")
            if resp.status_code != 200:
                return False
            models = resp.json().get("models", [])
            names = [m.get("name", "").split(":")[0] for m in models]
            return self.model in names or any(self.model in n for n in names)
        except (httpx.HTTPError, KeyError, ValueError) as exc:
            logger.warning("Ollama health-check failed: %s", exc)
            return False

    # ── Generation (single prompt) ──────────────────────────

    async def generate(
        self,
        prompt: str,
        system_prompt: str = "",
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> OllamaResult:
        """
        One-shot text generation via ``/api/generate``.

        Returns an ``OllamaResult``; caller checks ``.ok``.
        """
        options = {**_DEFAULT_OPTIONS}
        if temperature is not None:
            options["temperature"] = temperature
        if max_tokens is not None:
            options["num_predict"] = max_tokens

        payload = {
            "model": self.model,
            "prompt": prompt,
            "system": system_prompt,
            "stream": False,
            "options": options,
        }

        return await self._post("/api/generate", payload, key="response")

    # ── Chat completion ─────────────────────────────────────

    async def chat(
        self,
        messages: list[dict],
        *,
        temperature: float | None = None,
        max_tokens: int | None = None,
    ) -> OllamaResult:
        """
        Multi-turn chat via ``/api/chat``.

        *messages* is a list of ``{"role": ..., "content": ...}`` dicts.
        Returns an ``OllamaResult``; caller checks ``.ok``.
        """
        options = {**_DEFAULT_OPTIONS}
        if temperature is not None:
            options["temperature"] = temperature
        if max_tokens is not None:
            options["num_predict"] = max_tokens

        payload = {
            "model": self.model,
            "messages": messages,
            "stream": False,
            "options": options,
        }

        return await self._post("/api/chat", payload, key="message")

    # ── Internal HTTP helper ────────────────────────────────

    async def _post(self, path: str, payload: dict, *, key: str) -> OllamaResult:
        """Fire a POST to Ollama and return a normalised result."""
        try:
            resp = await self._client.post(path, json=payload)
            resp.raise_for_status()
            data = resp.json()

            # /api/generate → data["response"] (str)
            # /api/chat     → data["message"]["content"] (str)
            if key == "message":
                content = data.get("message", {}).get("content", "")
            else:
                content = data.get(key, "")

            return OllamaResult(
                ok=True,
                content=content or "The model returned an empty response.",
                model=data.get("model", self.model),
                eval_count=data.get("eval_count"),
                eval_duration_ms=(
                    data["eval_duration"] / 1_000_000
                    if data.get("eval_duration")
                    else None
                ),
            )

        except httpx.TimeoutException:
            logger.error("Ollama request timed out (%s)", path)
            return OllamaResult(
                ok=False,
                content="The AI model took too long to respond. Try a shorter question.",
                model=self.model,
            )
        except httpx.ConnectError:
            logger.error("Cannot connect to Ollama at %s", self.base_url)
            return OllamaResult(
                ok=False,
                content="Cannot connect to the AI model. Please ensure Ollama is running.",
                model=self.model,
            )
        except Exception as exc:  # pylint: disable=broad-exception-caught
            logger.exception("Ollama call failed (%s)", path)
            return OllamaResult(
                ok=False,
                content=f"AI model error: {exc}",
                model=self.model,
            )
