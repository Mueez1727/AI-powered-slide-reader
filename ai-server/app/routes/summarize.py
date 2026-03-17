"""Summarization route — generates structured summaries of slide decks.

Returns three sections:
  - short_summary   — 2-3 sentence overview
  - detailed_explanation — paragraph-form deep-dive
  - revision_notes  — bullet-point study aid

Performance improvements:
  - Chunks are summarized in small batches first ("map" step).
  - Batch summaries are combined into the final 3-section output ("reduce" step).
  - Conservative character limits keep each Ollama call within 2000 chars
    of input, preventing timeouts on large presentations.
  - Max tokens for generation are capped per step to keep response times low.
"""

from __future__ import annotations

import logging
import re
from fastapi import APIRouter, Request, HTTPException
from pydantic import BaseModel, Field

from app.services.prompt_templates import build_detailed_summarize_prompt

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Tuned limits for qwen2:1.5b — keeps each LLM call fast ──
_MAP_BATCH_CHAR_LIMIT = 1800   # chars of slide content per map batch
_MAP_MAX_TOKENS = 400          # generation budget per map call
_REDUCE_CHAR_LIMIT = 4000      # chars of combined summaries for reduce step
_REDUCE_MAX_TOKENS = 1024      # generation budget for final structured output
_DIRECT_CHAR_LIMIT = 2500      # chars for small-doc single-pass
_DIRECT_MAX_TOKENS = 1024

# Max chunks to retrieve — 8 balances coverage with speed
_MAX_CHUNKS = 8


# ── Request / Response models ───────────────────────────────

class SummarizeRequest(BaseModel):
    document_id: str


class SummarizeResponse(BaseModel):
    short_summary: str = Field(..., description="Concise 2-3 sentence overview")
    detailed_explanation: str = Field(..., description="Thorough topic-by-topic explanation")
    revision_notes: str = Field(..., description="Bullet-point notes for exam revision")
    model: str = Field(..., description="LLM model used")
    chunks_used: int = Field(..., description="Number of context chunks fed to the model")
    eval_tokens: int | None = Field(None, description="Tokens generated")
    eval_duration_ms: float | None = Field(None, description="Generation wall-time in ms")


# ── Helpers ─────────────────────────────────────────────────

_SECTION_RE = re.compile(
    r"##\s*Short\s+Summary\s*\n(.*?)"
    r"##\s*Detailed\s+Explanation\s*\n(.*?)"
    r"##\s*Revision\s+Notes\s*\n(.*)",
    re.DOTALL | re.IGNORECASE,
)


def _parse_sections(text: str) -> dict[str, str]:
    """
    Split the LLM output on the three expected ``## …`` headings.

    Falls back to returning the raw text in *short_summary* if the model
    didn't follow the format exactly.
    """
    m = _SECTION_RE.search(text)
    if m:
        return {
            "short_summary": m.group(1).strip(),
            "detailed_explanation": m.group(2).strip(),
            "revision_notes": m.group(3).strip(),
        }

    # Fallback — try splitting on any "##" to be lenient
    parts = re.split(r"\n##\s+", text, maxsplit=3)
    if len(parts) >= 4:
        return {
            "short_summary": parts[1].split("\n", 1)[-1].strip() if parts[1] else "",
            "detailed_explanation": parts[2].split("\n", 1)[-1].strip() if parts[2] else "",
            "revision_notes": parts[3].strip(),
        }

    # Last resort — put everything into short_summary
    return {
        "short_summary": text.strip(),
        "detailed_explanation": "",
        "revision_notes": "",
    }


def _build_batch_prompt(chunk_texts: list[str]) -> str:
    """Build a concise 'map' prompt for a batch of chunks."""
    context = "\n\n".join(chunk_texts)
    # Truncate context to stay within limit
    if len(context) > _MAP_BATCH_CHAR_LIMIT:
        context = context[:_MAP_BATCH_CHAR_LIMIT]
    return (
        "Summarize the following slide content in 3-5 sentences. "
        "Focus on key topics and conclusions.\n\n"
        f"{context}\n\n"
        "Summary:"
    )


# ── Endpoint ────────────────────────────────────────────────

@router.post("/summarize", response_model=SummarizeResponse)
async def summarize_document(request: Request, body: SummarizeRequest):
    """
    Generate a structured summary of all slides in a document.

    Uses a map-reduce strategy for large documents:
      1. MAP: Summarize small batches of chunks independently.
      2. REDUCE: Combine batch summaries into the final 3-section output.

    This prevents LLM timeouts on large presentations by keeping each
    individual call within the context window and generation limits.
    """
    embedding_service = request.app.state.embedding_service
    ollama_service = request.app.state.ollama_service

    # Retrieve broadly — but cap to prevent excessive content
    results = embedding_service.search(
        body.document_id,
        "summary overview main points key topics conclusions",
        top_k=_MAX_CHUNKS,
    )

    if not results:
        raise HTTPException(
            status_code=404,
            detail="No content found for this document. Has it been processed?",
        )

    # ── Decide strategy: direct or map-reduce ───────────────
    total_text_len = sum(len(r.get("text", "")) for r in results)
    logger.info(
        "[Summarize] %d chunks, %d total chars for doc %s",
        len(results), total_text_len, body.document_id,
    )

    if total_text_len <= _DIRECT_CHAR_LIMIT:
        # Small document: single-pass summarization
        prompt = build_detailed_summarize_prompt(results)
        if len(prompt) > _DIRECT_CHAR_LIMIT + 1500:
            prompt = prompt[:_DIRECT_CHAR_LIMIT + 1500] + "\n\n[Content truncated]"

        logger.info("[Summarize] Using direct single-pass strategy")
        result = await ollama_service.generate(prompt, max_tokens=_DIRECT_MAX_TOKENS)
    else:
        # Large document: map-reduce summarization
        logger.info("[Summarize] Using map-reduce strategy")

        # ── MAP step: summarize batches of chunks ───────────
        batch_summaries: list[str] = []
        current_batch: list[str] = []
        current_len = 0

        for chunk in results:
            chunk_text = chunk.get("text", "")
            # Truncate oversized individual chunks
            if len(chunk_text) > _MAP_BATCH_CHAR_LIMIT:
                chunk_text = chunk_text[:_MAP_BATCH_CHAR_LIMIT]

            if current_len + len(chunk_text) > _MAP_BATCH_CHAR_LIMIT and current_batch:
                # Flush current batch
                logger.info(
                    "[Summarize] MAP batch %d: %d chunks, %d chars",
                    len(batch_summaries) + 1, len(current_batch), current_len,
                )
                batch_prompt = _build_batch_prompt(current_batch)
                batch_result = await ollama_service.generate(
                    batch_prompt, max_tokens=_MAP_MAX_TOKENS,
                )
                if batch_result.ok and batch_result.content:
                    batch_summaries.append(batch_result.content)
                else:
                    logger.warning("Batch summarization failed: %s", batch_result.content)
                current_batch = []
                current_len = 0

            current_batch.append(chunk_text)
            current_len += len(chunk_text)

        # Flush last batch
        if current_batch:
            logger.info(
                "[Summarize] MAP batch %d (final): %d chunks, %d chars",
                len(batch_summaries) + 1, len(current_batch), current_len,
            )
            batch_prompt = _build_batch_prompt(current_batch)
            batch_result = await ollama_service.generate(
                batch_prompt, max_tokens=_MAP_MAX_TOKENS,
            )
            if batch_result.ok and batch_result.content:
                batch_summaries.append(batch_result.content)
            else:
                logger.warning("Final batch summarization failed: %s", batch_result.content)

        logger.info(
            "[Summarize] MAP step produced %d batch summaries",
            len(batch_summaries),
        )

        if not batch_summaries:
            # All batch calls failed — fall back to a very small direct prompt
            logger.warning("All MAP batch summaries failed; falling back to direct prompt")
            fallback_results = results[:3]  # Just use top 3 chunks
            prompt = build_detailed_summarize_prompt(fallback_results)
            if len(prompt) > _DIRECT_CHAR_LIMIT + 1000:
                prompt = prompt[:_DIRECT_CHAR_LIMIT + 1000] + "\n\n[Content truncated]"
            result = await ollama_service.generate(prompt, max_tokens=_DIRECT_MAX_TOKENS)
            if not result.ok:
                raise HTTPException(status_code=503, detail=result.content)

            sections = _parse_sections(result.content)
            return SummarizeResponse(
                short_summary=sections["short_summary"],
                detailed_explanation=sections["detailed_explanation"],
                revision_notes=sections["revision_notes"],
                model=result.model,
                chunks_used=len(results),
                eval_tokens=result.eval_count,
                eval_duration_ms=result.eval_duration_ms,
            )

        # ── REDUCE step: combine batch summaries into final ─
        combined = "\n\n".join(
            f"[Batch {i+1}]: {s}" for i, s in enumerate(batch_summaries)
        )
        # Truncate combined if too long
        if len(combined) > _REDUCE_CHAR_LIMIT:
            combined = combined[:_REDUCE_CHAR_LIMIT]

        reduce_chunks = [{"text": combined, "metadata": {"slide_number": 0, "heading": "Combined Summaries"}}]
        prompt = build_detailed_summarize_prompt(reduce_chunks)
        if len(prompt) > _REDUCE_CHAR_LIMIT + 1500:
            prompt = prompt[:_REDUCE_CHAR_LIMIT + 1500] + "\n\n[Content truncated]"

        logger.info("[Summarize] REDUCE step: prompt length = %d chars", len(prompt))
        result = await ollama_service.generate(prompt, max_tokens=_REDUCE_MAX_TOKENS)

    if not result.ok:
        raise HTTPException(status_code=503, detail=result.content)

    sections = _parse_sections(result.content)

    # Guard: if all sections are empty/whitespace, retry once with direct prompt
    if not any(sections[k].strip() for k in ("short_summary", "detailed_explanation", "revision_notes")):
        logger.warning("[Summarize] All sections empty — retrying with direct prompt")
        fallback_results = results[:3]
        prompt = build_detailed_summarize_prompt(fallback_results)
        if len(prompt) > _DIRECT_CHAR_LIMIT + 1500:
            prompt = prompt[:_DIRECT_CHAR_LIMIT + 1500] + "\n\n[Content truncated]"
        result = await ollama_service.generate(prompt, max_tokens=_DIRECT_MAX_TOKENS)
        if not result.ok:
            raise HTTPException(status_code=503, detail=result.content)
        sections = _parse_sections(result.content)

    # Final fallback: if still empty, return an error instead of blank strings
    if not any(sections[k].strip() for k in ("short_summary", "detailed_explanation", "revision_notes")):
        raise HTTPException(
            status_code=502,
            detail="The AI model could not generate a summary. Please try again.",
        )

    return SummarizeResponse(
        short_summary=sections["short_summary"],
        detailed_explanation=sections["detailed_explanation"],
        revision_notes=sections["revision_notes"],
        model=result.model,
        chunks_used=len(results),
        eval_tokens=result.eval_count,
        eval_duration_ms=result.eval_duration_ms,
    )
