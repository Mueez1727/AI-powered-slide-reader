"""
Image captioning service using BLIP (Salesforce/blip-image-captioning-base).

Generates natural language descriptions of images found in slides,
complementing the OCR text extraction. This helps the AI understand
diagrams, charts, and visual elements that OCR alone cannot interpret.

The model is loaded lazily on first use to avoid startup failures and
to allow better error recovery.
"""

from __future__ import annotations

import io
import logging
import threading

from PIL import Image

logger = logging.getLogger(__name__)

# ── Global model + processor (loaded lazily on first call) ──
_processor = None
_model = None
_load_attempted = False
_load_lock = threading.Lock()


def _ensure_model_loaded() -> bool:
    """
    Load the BLIP model on first call.  Thread-safe via a lock.

    Returns True if model is ready, False otherwise.
    """
    global _processor, _model, _load_attempted  # noqa: PLW0603

    if _processor is not None and _model is not None:
        return True

    if _load_attempted:
        # Already tried and failed — don't retry every call
        return False

    with _load_lock:
        # Double-check after acquiring lock
        if _processor is not None and _model is not None:
            return True
        if _load_attempted:
            return False

        _load_attempted = True
        try:
            logger.info("Loading BLIP image captioning model…")
            from transformers import BlipProcessor, BlipForConditionalGeneration
            import torch  # noqa: F401 — validates torch is importable

            _processor = BlipProcessor.from_pretrained(
                "Salesforce/blip-image-captioning-base"
            )
            _model = BlipForConditionalGeneration.from_pretrained(
                "Salesforce/blip-image-captioning-base"
            )
            logger.info("BLIP image captioning model loaded successfully")
            return True
        except Exception as exc:  # pylint: disable=broad-exception-caught
            logger.warning(
                "Failed to load BLIP model — image captions disabled: %s", exc,
                exc_info=True,
            )
            return False


# ── Minimum image dimensions worth captioning ───────────────
_MIN_WIDTH = 50
_MIN_HEIGHT = 50


def generate_image_caption(image_input) -> str:
    """
    Generate a natural-language caption for an image using BLIP.

    Args:
        image_input: A file path (str), raw bytes, or a PIL Image.

    Returns:
        A caption string, or empty string on failure / model unavailable.
    """
    if not _ensure_model_loaded():
        logger.warning("BLIP model not available — returning empty caption")
        return ""

    try:
        # Normalise input to a PIL Image
        if isinstance(image_input, str):
            logger.info("Opening image from path: %s", image_input)
            image = Image.open(image_input)
        elif isinstance(image_input, bytes):
            logger.info("Opening image from %d bytes", len(image_input))
            image = Image.open(io.BytesIO(image_input))
        elif isinstance(image_input, Image.Image):
            image = image_input
        else:
            logger.warning("Unsupported image input type: %s", type(image_input))
            return ""

        logger.info(
            "Image loaded: %dx%d, mode=%s", image.width, image.height, image.mode,
        )

        # Skip very small images (icons, bullets, decorations)
        if image.width < _MIN_WIDTH or image.height < _MIN_HEIGHT:
            logger.info(
                "Skipping small image (%dx%d < %dx%d minimum)",
                image.width, image.height, _MIN_WIDTH, _MIN_HEIGHT,
            )
            return ""

        # BLIP expects RGB
        if image.mode != "RGB":
            image = image.convert("RGB")

        inputs = _processor(image, return_tensors="pt")  # type: ignore[call-arg]
        output_ids = _model.generate(**inputs, max_new_tokens=80)
        caption = _processor.decode(output_ids[0], skip_special_tokens=True).strip()

        if caption:
            logger.info(
                "BLIP caption (%dx%d): %s",
                image.width, image.height, caption[:120],
            )
        else:
            logger.warning("BLIP returned empty caption for %dx%d image", image.width, image.height)

        return caption

    except Exception:  # pylint: disable=broad-exception-caught
        logger.warning("Image captioning failed", exc_info=True)
        return ""


def generate_image_caption_from_bytes(image_bytes: bytes) -> str:
    """Convenience wrapper: caption from raw image bytes."""
    return generate_image_caption(image_bytes)
