"""
PDF extraction service using PyMuPDF (fitz).
Extracts structured slide data — heading, main content, and OCR text
from embedded images — for every page.
"""

from __future__ import annotations

import io
import logging
from typing import Any

import fitz  # PyMuPDF
from PIL import Image

from app.services.image_captioning_service import generate_image_caption
from app.services.ocr_service import MAX_IMAGES_PER_SLIDE, ocr_pil_image
from app.services.text_cleaner import clean_text

logger = logging.getLogger(__name__)


class PDFExtractor:
    """Extract structured slide data from PDF files."""

    # ── public API ──────────────────────────────────────────

    @staticmethod
    def extract(file_path: str) -> list[dict]:
        """
        Extract every page of a PDF as a structured slide dict.

        Returns a list of::

            {
                "slide_number": int,
                "heading":      str,
                "main_content": str,
                "image_text":   str,   # OCR text found in images
            }
        """
        slides: list[dict] = []
        doc: Any = fitz.open(file_path)

        try:
            for page_idx, page in enumerate(doc):
                slide_number = page_idx + 1

                # ── 1. Extract textual content ──────────────
                raw: Any = page.get_text("text")
                raw_text: str = raw.strip() if isinstance(raw, str) else ""
                logger.debug(
                    "Page %d: extracted %d chars of text",
                    slide_number,
                    len(raw_text),
                )

                # ── 2. Extract & OCR images ─────────────────
                image_text = PDFExtractor._extract_image_text(doc, page)

                # If the page had almost no selectable text, the
                # "main" content is likely baked into an image.
                # Fall back to a full-page raster OCR.
                if len(raw_text) < 30 and not image_text:
                    image_text = PDFExtractor._ocr_full_page(page)

                # ── 3. Derive heading / body ────────────────
                heading, main_content = PDFExtractor._split_heading(
                    raw_text, slide_number
                )

                # ── 4. Clean extracted text ──────────────────
                heading = clean_text(heading)
                main_content = clean_text(main_content)
                image_text = clean_text(image_text)[:500]

                slides.append(
                    {
                        "slide_number": slide_number,
                        "heading": heading,
                        "main_content": main_content,
                        "image_text": image_text,
                    }
                )
        finally:
            doc.close()

        return slides

    # ── private helpers ─────────────────────────────────────

    @staticmethod
    def _split_heading(text: str, slide_number: int) -> tuple[str, str]:
        """
        Heuristic: treat the first non-empty line as the heading,
        everything else as main content.
        """
        lines = [ln.strip() for ln in text.split("\n") if ln.strip()]
        if not lines:
            return f"Slide {slide_number}", ""
        heading = lines[0][:200]
        main_content = "\n".join(lines[1:])
        return heading, main_content

    @staticmethod
    def _extract_image_text(doc: Any, page: Any) -> str:
        """OCR + AI caption each embedded image on the page."""
        ocr_fragments: list[str] = []
        image_list = page.get_images(full=True)
        logger.debug("Page has %d embedded images", len(image_list))

        for img_info in image_list[:MAX_IMAGES_PER_SLIDE]:
            try:
                xref = img_info[0]
                # doc (page.parent) may be None in edge cases
                if doc is None:
                    continue
                base_image: dict | None = doc.extract_image(xref)
                if not base_image or not base_image.get("image"):
                    continue
                # Convert raw bytes → PIL Image for EasyOCR
                img_bytes: bytes = base_image["image"]
                pil_img = Image.open(io.BytesIO(img_bytes))
                if pil_img.mode not in ("L", "RGB"):
                    pil_img = pil_img.convert("RGB")

                # OCR text extraction
                ocr_text = ocr_pil_image(pil_img)
                # AI-generated image caption via BLIP
                caption = generate_image_caption(pil_img)

                # Combine OCR text and caption
                parts: list[str] = []
                if ocr_text:
                    parts.append(f"[OCR Text] {ocr_text}")
                if caption:
                    parts.append(f"[Image Description] {caption}")
                if parts:
                    ocr_fragments.append("\n".join(parts))
            except Exception:
                logger.debug(
                    "Image extraction failed (xref %s)", img_info[0]
                )
                continue

        return "\n".join(ocr_fragments)

    @staticmethod
    def _ocr_full_page(page: Any, dpi: int = 200) -> str:
        """Render the entire page as a raster image and OCR it."""
        try:
            mat = fitz.Matrix(dpi / 72, dpi / 72)
            pix = page.get_pixmap(matrix=mat)
            img = Image.open(io.BytesIO(pix.tobytes("png")))
            return ocr_pil_image(img)
        except Exception:
            logger.debug("Full-page OCR failed")
            return ""
