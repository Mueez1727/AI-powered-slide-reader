"""
Speech services: Whisper (STT) and gTTS (TTS).

• Whisper model is lazily loaded on first use (saves ~400 MB until needed).
• TTS files are written to a deterministic temp directory so they can be
  cleaned up on shutdown.
"""

from __future__ import annotations

import logging
import tempfile
import time

import whisper
from gtts import gTTS

from app.config import settings

logger = logging.getLogger(__name__)

# ── Whisper (STT) ───────────────────────────────────────────

_whisper_model = None


def get_whisper_model():
    """Lazily load the Whisper model to save memory at startup."""
    global _whisper_model  # pylint: disable=global-statement
    if _whisper_model is None:
        logger.info("Loading Whisper model: %s …", settings.whisper_model)
        _whisper_model = whisper.load_model(settings.whisper_model)
        logger.info("Whisper model loaded")
    return _whisper_model


def transcribe_audio(audio_path: str, *, language: str = "en") -> dict:
    """
    Transcribe an audio file to text using Whisper.

    Returns a dict:
        {
            "text":       str,      # full transcription
            "segments":   list,     # word-level segments (for live display)
            "language":   str,
            "duration_s": float,    # audio duration
        }
    """
    model = get_whisper_model()
    t0 = time.perf_counter()

    result = model.transcribe(
        audio_path,
        language=language,
        fp16=False,
        word_timestamps=True,   # enables fine-grained segments
    )

    elapsed = round(time.perf_counter() - t0, 2)
    text = result.get("text", "").strip()
    segments = result.get("segments", [])

    # Flatten word-level timestamps for the client
    words: list[dict] = []
    for seg in segments:
        for w in seg.get("words", []):
            words.append({
                "word": w.get("word", "").strip(),
                "start": round(w.get("start", 0), 2),
                "end": round(w.get("end", 0), 2),
            })

    return {
        "text": text,
        "words": words,
        "language": result.get("language", language),
        "duration_s": elapsed,
    }


# ── gTTS (TTS) ─────────────────────────────────────────────

def text_to_speech(text: str, *, lang: str = "en", slow: bool = False) -> str:
    """
    Convert *text* to an MP3 file using gTTS.

    Args:
        text: The text to speak.
        lang: BCP-47 language code (default ``en``).
        slow: If ``True`` the audio is slower (useful for accessibility).

    Returns:
        Filesystem path to the generated ``.mp3`` file.
    """
    # Truncate very long text to avoid timeouts
    if len(text) > 5000:
        text = text[:5000] + "..."

    tts = gTTS(text=text, lang=lang, slow=slow)

    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".mp3")
    tts.save(tmp.name)

    return tmp.name
