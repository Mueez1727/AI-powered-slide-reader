"""
Document processing route.
Receives uploaded files, extracts structured slide data (with OCR + image captioning),
chunks the text, and creates FAISS vector embeddings for the RAG pipeline.
"""

from __future__ import annotations

import os
import tempfile
import shutil
import logging
import uuid

from fastapi import APIRouter, UploadFile, File, Form, Request, HTTPException

from app.services.pdf_extractor import PDFExtractor
from app.services.ppt_extractor import PPTExtractor
from app.services.chunking_service import chunk_slides

logger = logging.getLogger(__name__)

router = APIRouter()

# ── Supported MIME types ────────────────────────────────────
_PDF_MIMES = {"application/pdf"}
_PPT_MIMES = {
    "application/vnd.ms-powerpoint",
    "application/vnd.openxmlformats-officedocument.presentationml.presentation",
}

# Extension → filetype mapping (fallback when MIME is missing / generic)
_EXT_MAP: dict[str, str] = {
    ".pdf":  "pdf",
    ".ppt":  "ppt",
    ".pptx": "ppt",
}


def _resolve_file_type(file: UploadFile, mime_override: str | None) -> str:
    """
    Determine whether the uploaded file is a PDF or PPT/PPTX.

    Resolution order:
      1. Explicit *mime_override* form field (sent by the Node.js server).
      2. Content-Type header set by the browser / HTTP client.
      3. File extension.

    Returns ``"pdf"`` or ``"ppt"`` or raises 400.
    """
    # --- Try explicit override first (backward compat with Node callers) ---
    candidate = (mime_override or "").strip().lower()
    if candidate in _PDF_MIMES:
        return "pdf"
    if candidate in _PPT_MIMES:
        return "ppt"

    # --- Try the Content-Type set by the HTTP client / browser ---
    ct = (file.content_type or "").strip().lower()
    if ct in _PDF_MIMES:
        return "pdf"
    if ct in _PPT_MIMES:
        return "ppt"

    # --- Fall back to file extension ---
    ext = os.path.splitext(file.filename or "")[1].lower()
    ft = _EXT_MAP.get(ext)
    if ft:
        return ft

    # Nothing matched — surface a helpful error
    raise HTTPException(
        status_code=400,
        detail=(
            f"Unsupported file type (content_type={ct!r}, extension={ext!r}). "
            "Only PDF and PPT/PPTX files are accepted."
        ),
    )


@router.post("/process")
async def process_document(
    request: Request,
    file: UploadFile = File(..., description="PDF or PPTX file to process"),
    document_id: str = Form("", description="Optional document ID (auto-generated if empty)"),
    mime_type: str = Form("", description="Optional MIME type override (auto-detected from file)"),
):
    """
    Process an uploaded document:

    1. Save to a temporary file
    2. Extract structured slide data (heading, content, image OCR)
    3. Split text into overlapping chunks
    4. Build a FAISS vector index for similarity search

    Both **document_id** and **mime_type** are optional:

    * *document_id* defaults to a random UUID.
    * *mime_type* is auto-detected from the file's Content-Type header
      or extension; pass it explicitly only when the caller already knows.
    """
    # Resolve optional fields
    doc_id = document_id.strip() or uuid.uuid4().hex
    file_type = _resolve_file_type(file, mime_type or None)

    logger.info(
        "Processing document %s (filename=%s, resolved_type=%s, content_type=%s)",
        doc_id, file.filename, file_type, file.content_type,
    )

    temp_path: str | None = None

    try:
        # ── 1. Persist upload to a temp file ────────────────
        suffix = os.path.splitext(file.filename or "doc")[1] or (
            ".pdf" if file_type == "pdf" else ".pptx"
        )
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(file.file, tmp)
            temp_path = tmp.name

        # ── 2. Extract slides ───────────────────────────────
        logger.info("[%s] Starting %s extraction…", doc_id, file_type.upper())
        if file_type == "pdf":
            slides = PDFExtractor.extract(temp_path)
        else:
            slides = PPTExtractor.extract(temp_path)

        logger.info(
            "[%s] Extracted %d slides (text + OCR + image captioning complete)",
            doc_id, len(slides),
        )
        if not slides:
            logger.warning("No slides extracted from document %s", doc_id)
        else:
            # Log image_text status per slide for debugging
            for s in slides:
                img_text = s.get("image_text", "")
                logger.info(
                    "[%s] Slide %d: heading='%s', image_text_len=%d%s",
                    doc_id,
                    s["slide_number"],
                    s.get("heading", "")[:40],
                    len(img_text),
                    f" -> '{img_text[:80]}...'" if img_text else " (no image text)",
                )

        # ── 3. Chunk slide text ─────────────────────────────
        chunks = chunk_slides(slides)
        logger.info("[%s] Generated %d chunks from %d slides", doc_id, len(chunks), len(slides))

        # ── 4. Build vector index ───────────────────────────
        embedding_service = request.app.state.embedding_service
        vector_index_id = embedding_service.create_index(doc_id, chunks)
        logger.info("[%s] Embeddings stored → index %s", doc_id, vector_index_id)

        return {
            "document_id": doc_id,
            "slides": slides,
            "vector_index_id": vector_index_id,
            "total_slides": len(slides),
            "total_chunks": len(chunks),
        }

    except HTTPException:
        raise
    except Exception as exc:  # pylint: disable=broad-exception-caught
        logger.exception("Processing failed for document %s", doc_id)
        raise HTTPException(
            status_code=500,
            detail=f"Processing failed: {exc}",
        ) from exc
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)


@router.delete("/index/{document_id}")
async def delete_index(request: Request, document_id: str):
    """Delete a document's vector index."""
    embedding_service = request.app.state.embedding_service
    embedding_service.delete_index(document_id)
    return {"message": "Index deleted"}
