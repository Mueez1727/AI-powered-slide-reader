"""Chat route — conversational Q&A about uploaded slides.

Uses the full RAG pipeline:
  FAISS retrieval → structured prompt → qwen2:1.5b via Ollama → JSON response.

Supports both standard JSON and streaming (SSE) response modes.
"""

from __future__ import annotations

import json
import logging
from fastapi import APIRouter, Request, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel, Field

from app.services.prompt_templates import build_qa_messages

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Request / Response schemas ──────────────────────────────

class ChatRequest(BaseModel):
    document_id: str = Field(..., description="ID of the processed document")
    question: str = Field(..., min_length=1, max_length=2000)
    chat_history: list[dict] = Field(
        default=[],
        description="Previous conversation turns [{role, content}, …]",
    )


class SourceSlide(BaseModel):
    slide_number: int | None = None
    heading: str | None = None
    score: float | None = None


class ChatResponse(BaseModel):
    response: str
    model: str
    sources: list[SourceSlide]
    context_chunks_used: int
    eval_tokens: int | None = None
    eval_duration_ms: float | None = None


# ── Helpers ────────────────────────────────────────────────

def _build_sources(results: list[dict]) -> list[SourceSlide]:
    seen_slides: set[int] = set()
    sources: list[SourceSlide] = []
    for r in results:
        meta = r.get("metadata", {})
        sn = meta.get("slide_number")
        if sn is not None and sn not in seen_slides:
            seen_slides.add(sn)
            sources.append(SourceSlide(
                slide_number=sn,
                heading=meta.get("heading"),
                score=r.get("score"),
            ))
    return sources


# ── Standard (non-streaming) endpoint ──────────────────────

@router.post("/chat", response_model=ChatResponse)
async def chat_with_document(request: Request, body: ChatRequest):
    """
    Answer a user question grounded in slide content.

    Pipeline:
      1. Retrieve top-5 relevant chunks from FAISS
      2. Build a structured prompt via ``prompt_templates``
      3. Send to qwen2:1.5b through Ollama ``/api/chat``
      4. Return structured JSON with answer + source slides
    """
    embedding_service = request.app.state.embedding_service
    ollama_service = request.app.state.ollama_service

    # ── 1. Retrieve relevant context ────────────────────────
    results = embedding_service.search(
        body.document_id, body.question, top_k=5,
    )

    # ── 2. Build prompt ─────────────────────────────────────
    messages = build_qa_messages(
        question=body.question,
        context_chunks=results,
        chat_history=body.chat_history,
    )

    # ── 3. Call qwen2:1.5b via Ollama ─────────────────────────
    try:
        result = await ollama_service.chat(messages)
    except Exception as exc:
        logger.exception("Ollama chat call failed")
        raise HTTPException(status_code=503, detail=f"AI model error: {exc}")

    if not result.ok:
        raise HTTPException(status_code=503, detail=result.content)

    # ── 4. Build structured response ────────────────────────
    sources = _build_sources(results)

    return ChatResponse(
        response=result.content,
        model=result.model,
        sources=sources,
        context_chunks_used=len(results),
        eval_tokens=result.eval_count,
        eval_duration_ms=result.eval_duration_ms,
    )


# ── Streaming (SSE) endpoint ──────────────────────────────

@router.post("/chat/stream")
async def chat_stream(request: Request, body: ChatRequest):
    """
    Stream an AI answer token-by-token via Server-Sent Events.

    SSE format:
      data: {"token": "..."}          — each text chunk
      data: {"done": true, ...}       — final message with sources/model
    """
    embedding_service = request.app.state.embedding_service
    ollama_service = request.app.state.ollama_service

    results = embedding_service.search(
        body.document_id, body.question, top_k=5,
    )

    messages = build_qa_messages(
        question=body.question,
        context_chunks=results,
        chat_history=body.chat_history,
    )

    sources = _build_sources(results)

    async def event_generator():
        try:
            async for token in ollama_service.chat_stream(messages):
                payload = json.dumps({"token": token})
                yield f"data: {payload}\n\n"
        except Exception as exc:
            logger.exception("Streaming chat failed")
            error_payload = json.dumps({"error": str(exc)})
            yield f"data: {error_payload}\n\n"

        # Final event with metadata
        done_payload = json.dumps({
            "done": True,
            "model": ollama_service.model,
            "sources": [s.model_dump() for s in sources],
            "context_chunks_used": len(results),
        })
        yield f"data: {done_payload}\n\n"

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )
