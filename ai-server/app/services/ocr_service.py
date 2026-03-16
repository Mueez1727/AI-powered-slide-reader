"""
OCR service using EasyOCR.

Provides image-to-text extraction for slide images.
The EasyOCR Reader is initialised once at module level
so it is reused across all requests.
"""

from __future__ import annotations

import io
import logging
import re

import numpy as np
import easyocr
from PIL import Image

logger = logging.getLogger(__name__)

# ── Global EasyOCR reader (initialised once) ────────────────
logger.info("Initialising EasyOCR reader (gpu=False)…")
_reader: easyocr.Reader = easyocr.Reader(["en"], gpu=False, verbose=False)
logger.info("EasyOCR reader ready")

# ── Minimum image dimensions to bother running OCR ──────────
_MIN_WIDTH = 40
_MIN_HEIGHT = 40

# ── Minimum OCR fragment length to keep ─────────────────────
_MIN_FRAGMENT_LEN = 3

# ── Minimum OCR confidence score (NEW improvement) ──────────
_MIN_CONFIDENCE = 0.35

# ── Max images per slide to avoid runaway OCR ───────────────
MAX_IMAGES_PER_SLIDE = 8


# ─────────────────────────────────────────────────────────────
# Text Cleaning Function
# ─────────────────────────────────────────────────────────────
def _clean_text(text: str) -> str:
    """Clean OCR output to improve readability."""

    if not text:
        return ""

    # Remove spaced letters (P a g e -> Page)
    text = re.sub(r'(\b\w)\s+(\w\b)', r'\1\2', text)

    # Remove repeated whitespace
    text = re.sub(r'\s+', ' ', text)

    # Fix some common OCR mistakes
    replacements = {
        "ueneralion": "generation",
        "NvelwulKS": "networks",
        "ACCl:+octir": "Architecture",
        "Pa g e": "Page",
        "1 | 1": ""
    }

    for wrong, correct in replacements.items():
        text = text.replace(wrong, correct)

    return text.strip()


# ─────────────────────────────────────────────────────────────
# OCR from raw image bytes
# ─────────────────────────────────────────────────────────────
def ocr_image_bytes(image_bytes: bytes) -> str:
    """
    Run EasyOCR on raw image bytes.

    Returns extracted text or empty string on failure.
    """
    try:
        image = Image.open(io.BytesIO(image_bytes))
        return ocr_pil_image(image)
    except Exception:  # pylint: disable=broad-exception-caught
        logger.debug("OCR failed for raw image bytes")
        return ""


# ─────────────────────────────────────────────────────────────
# OCR from PIL Image
# ─────────────────────────────────────────────────────────────
def ocr_pil_image(image: Image.Image) -> str:
    """
    Run EasyOCR on a PIL Image.

    Improvements:
    • Skips very small images
    • Filters low confidence text
    • Removes tiny fragments
    • Cleans final text
    """

    try:
        if image.width < _MIN_WIDTH or image.height < _MIN_HEIGHT:
            return ""

        # EasyOCR expects RGB numpy array
        if image.mode not in ("L", "RGB"):
            image = image.convert("RGB")

        img_array = np.array(image)

        results = _reader.readtext(img_array)

        texts = []

        for _, text, confidence in results:

            confidence = float(confidence)

            if confidence < _MIN_CONFIDENCE:
                continue

            if len(text) < _MIN_FRAGMENT_LEN:
                continue

            texts.append(text)

        text = " ".join(texts).strip()

        text = _clean_text(text)

        if text:
            logger.debug(
                "OCR extracted %d chars from %dx%d image",
                len(text),
                image.width,
                image.height,
            )

        return text

    except Exception:  # pylint: disable=broad-exception-caught
        logger.debug("OCR failed for a PIL image")
        return ""