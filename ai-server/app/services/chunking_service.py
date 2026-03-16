"""
Text chunking utilities for the RAG pipeline.

Splits long slide text into smaller, overlapping chunks that fit within
the embedding model's optimal token window (~256 tokens ≈ 800-1000 chars).
Each chunk retains a reference back to its source slide.
"""

from __future__ import annotations

import re
import logging

from app.services.text_cleaner import clean_text

logger = logging.getLogger(__name__)

# ── Defaults (overridable via function params) ──────────────
DEFAULT_CHUNK_SIZE = 800        # characters
DEFAULT_CHUNK_OVERLAP = 150     # characters of overlap between adjacent chunks
MIN_CHUNK_LENGTH = 40           # skip trivially short fragments


def chunk_slides(
    slides: list[dict],
    chunk_size: int = DEFAULT_CHUNK_SIZE,
    chunk_overlap: int = DEFAULT_CHUNK_OVERLAP,
) -> list[dict]:
    """
    Convert a list of structured slide dicts into embedding-ready chunks.

    Each slide dict is expected to have::

        {
            "slide_number": int,
            "heading":      str,
            "main_content": str,
            "image_text":   str,
        }

    Returns a flat list of::

        {
            "text":     str,       # chunk text (≤ chunk_size chars)
            "metadata": {
                "slide_number": int,
                "heading":      str,
                "chunk_index":  int,   # 0-based index within the slide
            }
        }
    """
    all_chunks: list[dict] = []

    for slide in slides:
        slide_number = slide.get("slide_number", 0)
        heading = slide.get("heading", "").strip()

        # Merge all textual fields into one body for chunking (TASK 5)
        parts = [
            clean_text(slide.get("heading", "")),
            clean_text(slide.get("main_content", "")),
            clean_text(slide.get("image_text", "")),
        ]
        full_text = "\n".join(p for p in parts if p)

        if len(full_text) < MIN_CHUNK_LENGTH:
            # Still keep a tiny chunk so FAISS has _something_ for the slide
            if full_text.strip():
                all_chunks.append({
                    "text": full_text,
                    "metadata": {
                        "slide_number": slide_number,
                        "heading": heading,
                        "chunk_index": 0,
                    },
                })
            continue

        # Split into overlapping windows
        windows = _split_with_overlap(full_text, chunk_size, chunk_overlap)

        for idx, window in enumerate(windows):
            # Prepend heading as lightweight context so the chunk
            # is self-contained when retrieved later.
            prefix = f"[Slide {slide_number}] {heading}\n" if heading else f"[Slide {slide_number}]\n"
            text = f"{prefix}{window}".strip()

            all_chunks.append({
                "text": text,
                "metadata": {
                    "slide_number": slide_number,
                    "heading": heading,
                    "chunk_index": idx,
                },
            })

    logger.info(
        "Chunked %d slides into %d chunks (size=%d, overlap=%d)",
        len(slides), len(all_chunks), chunk_size, chunk_overlap,
    )
    return all_chunks


# ── Internal helpers ────────────────────────────────────────

# Regex splitting on paragraph / sentence boundaries for cleaner cuts
_SPLIT_RE = re.compile(r"(?:\n{2,}|(?<=[.!?])\s+)")


def _split_with_overlap(
    text: str,
    max_chars: int,
    overlap: int,
) -> list[str]:
    """
    Split *text* into chunks of at most *max_chars* characters with
    *overlap* characters repeated between consecutive chunks.

    Tries to break on paragraph / sentence boundaries when possible.
    """
    # Fast path: text already fits in one chunk
    if len(text) <= max_chars:
        return [text]

    # Break into natural segments (paragraphs / sentences)
    segments = _SPLIT_RE.split(text)
    segments = [s.strip() for s in segments if s.strip()]

    chunks: list[str] = []
    current = ""

    for seg in segments:
        candidate = f"{current}\n{seg}".strip() if current else seg

        if len(candidate) <= max_chars:
            current = candidate
        else:
            # Current buffer is full — flush it
            if current:
                chunks.append(current)

            # If a single segment is longer than max_chars, hard-split it
            if len(seg) > max_chars:
                hard_parts = _hard_split(seg, max_chars, overlap)
                chunks.extend(hard_parts[:-1])
                current = hard_parts[-1]  # keep last partial as seed
            else:
                # Use tail of previous chunk as overlap seed
                if current and overlap > 0:
                    current = _overlap_seed(current, overlap) + "\n" + seg
                    # If the seed + new seg still exceeds, just take seg
                    if len(current) > max_chars:
                        current = seg
                else:
                    current = seg

    if current.strip():
        chunks.append(current.strip())

    return chunks


def _hard_split(text: str, max_chars: int, overlap: int) -> list[str]:
    """Character-level split when a single segment exceeds *max_chars*."""
    parts: list[str] = []
    start = 0
    while start < len(text):
        end = start + max_chars
        parts.append(text[start:end].strip())
        start = end - overlap if overlap else end
    return parts


def _overlap_seed(text: str, overlap: int) -> str:
    """Return the last *overlap* characters of *text* for context bleed."""
    return text[-overlap:].lstrip()
