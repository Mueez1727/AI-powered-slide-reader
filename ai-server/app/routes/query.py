"""
RAG query route.

Accepts a user question and a document ID, retrieves the most relevant
slide chunks from the FAISS vector index, and returns them as structured
context.  The caller (Node.js server or frontend) can then forward this
context to llama-3 via Ollama for answer generation.
"""

from __future__ import annotations

import logging
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field

logger = logging.getLogger(__name__)

router = APIRouter()


# ── Request / Response schemas ──────────────────────────────

class QueryRequest(BaseModel):
    document_id: str = Field(..., description="ID of the processed document to search")
    question: str = Field(..., min_length=1, max_length=2000, description="User's natural-language question")
    top_k: int = Field(5, ge=1, le=20, description="Number of top chunks to retrieve")


class ChunkResult(BaseModel):
    text: str
    score: float
    slide_number: int | None = None
    heading: str | None = None
    chunk_index: int | None = None


class QueryResponse(BaseModel):
    document_id: str
    question: str
    results: list[ChunkResult]
    total_results: int
    index_stats: dict | None = None


# ── Endpoint ────────────────────────────────────────────────

@router.post("/query", response_model=QueryResponse)
async def query_document(request: Request, body: QueryRequest):
    """
    Retrieve the most relevant slide chunks for a given question.

    Pipeline:
      1. Encode the question with sentence-transformers
      2. Search the document's FAISS index (cosine similarity)
      3. Return ranked chunks with metadata

    The returned ``results`` can be injected as context into a prompt
    for llama-3 (via ``/api/chat``) to produce a grounded answer.
    """
    embedding_service = request.app.state.embedding_service

    # ── Validate that an index exists ───────────────────────
    stats = embedding_service.get_index_stats(body.document_id)
    if stats is None:
        raise HTTPException(
            status_code=404,
            detail=f"No vector index found for document '{body.document_id}'. "
                   "Has the document been processed?",
        )

    # ── Similarity search ───────────────────────────────────
    raw_results = embedding_service.search(
        document_id=body.document_id,
        query=body.question,
        top_k=body.top_k,
    )

    results: list[ChunkResult] = []
    for r in raw_results:
        meta = r.get("metadata", {})
        results.append(ChunkResult(
            text=r["text"],
            score=r["score"],
            slide_number=meta.get("slide_number"),
            heading=meta.get("heading"),
            chunk_index=meta.get("chunk_index"),
        ))

    logger.info(
        "Query on %s — %d results (top score %.4f)",
        body.document_id,
        len(results),
        results[0].score if results else 0.0,
    )

    return QueryResponse(
        document_id=body.document_id,
        question=body.question,
        results=results,
        total_results=len(results),
        index_stats=stats,
    )
