"""
Text cleaning utilities for the document processing pipeline.

Fixes common PDF/PPT extraction artefacts — ligature characters,
smart quotes, excessive whitespace — before text reaches the
chunking and embedding stages.
"""

from __future__ import annotations

import re
import unicodedata

# ── Ligature / smart-character replacements ─────────────────
_REPLACEMENT_PAIRS: list[tuple[str, str]] = [
    # Latin ligatures
    ("\u0132", "IJ"),   # Ĳ
    ("\u0133", "ij"),   # ĳ
    ("\ufb00", "ff"),   # ﬀ
    ("\ufb01", "fi"),   # ﬁ
    ("\ufb02", "fl"),   # ﬂ
    ("\ufb03", "ffi"),  # ﬃ
    ("\ufb04", "ffl"),  # ﬄ
    ("\ufb06", "st"),   # ﬆ
    # Common mis-encoded characters from PDF text layers
    ("\u019e", "n"),    # ƞ
    ("\u0197", "I"),    # Ɨ
    ("\u019b", "lambda"),  # ƛ
    ("\u0275", "o"),    # ɵ (lowercase theta-bar)
    ("\u019f", "ti"),   # Ɵ (capital O-bar, often mis-encoded as "ti" in PDF)
    ("\u021f", "h"),    # ȟ
    # Theta variants that PDF engines mis-encode as "ti"
    ("\u0398", "Th"),   # Θ (Greek capital theta)
    ("\u03b8", "th"),   # θ (Greek small theta)
    ("\u0278", "ph"),   # ɸ
    # Smart quotes and dashes
    ("\u2018", "'"),    # '
    ("\u2019", "'"),    # '
    ("\u201c", '"'),    # "
    ("\u201d", '"'),    # "
    ("\u2013", "-"),    # – (en-dash)
    ("\u2014", "-"),    # — (em-dash)
    ("\u2026", "..."),  # … (ellipsis)
    ("\u00a0", " "),    # non-breaking space
    ("\u200b", ""),     # zero-width space
    ("\u00ad", ""),     # soft hyphen
]

_REPLACEMENTS: dict[str, str] = dict(_REPLACEMENT_PAIRS)

# Pre-compile a single regex that matches any key
_REPLACE_RE = re.compile("|".join(re.escape(k) for k in _REPLACEMENTS))


def clean_text(text: str) -> str:
    """
    Normalise and clean extracted text.

    Steps:
      1. Unicode NFC normalisation.
      2. Replace known ligatures / smart characters.
      3. Collapse multiple whitespace into a single space.
      4. Strip leading / trailing whitespace.
    """
    if not text:
        return ""

    # NFC normalisation — merges combining characters
    text = unicodedata.normalize("NFC", text)

    # Replace known problem characters in one pass
    text = _REPLACE_RE.sub(lambda m: _REPLACEMENTS[m.group()], text)

    # Collapse whitespace (but preserve intentional newlines)
    text = re.sub(r"[^\S\n]+", " ", text)      # horizontal whitespace → single space
    text = re.sub(r"\n{3,}", "\n\n", text)      # 3+ newlines → double newline
    text = re.sub(r"[ \t]+\n", "\n", text)      # trailing spaces before newline

    return text.strip()
