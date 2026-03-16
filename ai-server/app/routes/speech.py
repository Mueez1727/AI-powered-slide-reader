"""
Speech routes — STT via Whisper and TTS via gTTS.

Endpoints
─────────
POST /transcribe    — raw audio → text (simple transcription)
POST /voice-input   — audio + document_id → transcription + AI answer + TTS audio URL
POST /speak         — text → MP3 audio file

Testing notes (curl / Postman)
──────────────────────────────
1) POST /transcribe (multipart/form-data)
     curl -X POST "http://localhost:8000/api/transcribe" \
         -F "audio=@sample.webm"

2) POST /speak (application/json)
     curl -X POST "http://localhost:8000/api/speak" \
         -H "Content-Type: application/json" \
         -d '{"text":"Hello from Slide Reader","slow":false}' \
         --output speech.mp3

3) POST /voice-input (multipart/form-data)
     curl -X POST "http://localhost:8000/api/voice-input" \
         -F "audio=@question.webm" \
         -F "document_id=<processed_document_id>"

Postman tips:
• /transcribe and /voice-input: Body -> form-data, key `audio` as File.
• /voice-input: add text key `document_id` to test RAG answers.
• /speak: Body -> raw JSON; save response as .mp3.
"""

from __future__ import annotations

import logging
import os
import tempfile
import shutil
import uuid

from fastapi import APIRouter, UploadFile, File, Form, HTTPException, Request
from fastapi.responses import FileResponse
from pydantic import BaseModel

from app.services.speech_service import transcribe_audio, text_to_speech
from app.services.prompt_templates import build_qa_messages

logger = logging.getLogger(__name__)

router = APIRouter()

# Directory for TTS audio files that the client can fetch
_TTS_DIR = os.path.join(tempfile.gettempdir(), "slide_reader_tts")
os.makedirs(_TTS_DIR, exist_ok=True)


# ── POST /transcribe ────────────────────────────────────────

@router.post("/transcribe")
async def transcribe(audio: UploadFile = File(...)):
    """
    Transcribe an uploaded audio file to text using Whisper.
    Returns word-level timestamps for live transcription display.
    """
    temp_path = None
    try:
        if not (audio.filename or "").strip():
            raise HTTPException(status_code=400, detail="Audio filename is required")

        if not (audio.content_type or "").startswith("audio/"):
            raise HTTPException(status_code=400, detail="Uploaded file must be an audio file")

        suffix = os.path.splitext(audio.filename or "audio.webm")[1] or ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(audio.file, tmp)
            temp_path = tmp.name

        result = transcribe_audio(temp_path)
        return result  # {text, words[], language, duration_s}

    except Exception as exc:
        logger.exception("Transcription failed")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {exc}") from exc
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)


# ── POST /voice-input ───────────────────────────────────────

@router.post("/voice-input")
async def voice_input(
    request: Request,
    audio: UploadFile = File(...),
    document_id: str = Form(""),
):
    """
    Full voice interaction pipeline:

    1. Transcribe the uploaded audio via Whisper (STT).
    2. If a *document_id* is provided, use the transcription as a question
       against the RAG pipeline (FAISS retrieval → llama-3 chat).
    3. Convert the AI answer to MP3 via gTTS (TTS).

    Returns::

        {
            "transcription": { text, words[], language, duration_s },
            "ai_response":   str | null,
            "audio_url":     "/api/tts-audio/<id>.mp3" | null,
            "sources":       [ {slide_number, heading} ] | null,
        }
    """
    embedding_service = request.app.state.embedding_service
    ollama_service = request.app.state.ollama_service

    # ── Step 1: STT ─────────────────────────────────────────
    temp_path = None
    try:
        if not (audio.filename or "").strip():
            raise HTTPException(status_code=400, detail="Audio filename is required")

        if not (audio.content_type or "").startswith("audio/"):
            raise HTTPException(status_code=400, detail="Uploaded file must be an audio file")

        suffix = os.path.splitext(audio.filename or "audio.webm")[1] or ".webm"
        with tempfile.NamedTemporaryFile(delete=False, suffix=suffix) as tmp:
            shutil.copyfileobj(audio.file, tmp)
            temp_path = tmp.name

        transcription = transcribe_audio(temp_path)
    except Exception as exc:
        logger.exception("Voice-input transcription failed")
        raise HTTPException(status_code=500, detail=f"Transcription failed: {exc}") from exc
    finally:
        if temp_path and os.path.exists(temp_path):
            os.unlink(temp_path)

    question = transcription.get("text", "").strip()
    if not question:
        return {
            "transcription": transcription,
            "ai_response": None,
            "audio_url": None,
            "sources": None,
        }

    # ── Step 2: RAG Q&A (if document_id provided) ──────────
    ai_answer: str | None = None
    sources: list[dict] | None = None

    if document_id:
        try:
            results = embedding_service.search(document_id, question, top_k=6)

            if results:
                messages = build_qa_messages(question, results)
                llm_result = await ollama_service.chat(messages)

                if llm_result.ok:
                    ai_answer = llm_result.content

                    # Deduplicate source slides
                    seen = set()
                    sources = []
                    for chunk in results:
                        meta = chunk.get("metadata", {})
                        sn = meta.get("slide_number")
                        if sn and sn not in seen:
                            seen.add(sn)
                            sources.append({
                                "slide_number": sn,
                                "heading": meta.get("heading", ""),
                            })
                else:
                    logger.warning("Ollama failed: %s", llm_result.content)
        except Exception:  # pylint: disable=broad-exception-caught
            logger.exception("Voice-input RAG query failed")
            # Non-fatal — still return the transcription
            ai_answer = None

    # ── Step 3: TTS for the AI answer ───────────────────────
    audio_url: str | None = None
    if ai_answer:
        try:
            audio_id = uuid.uuid4().hex[:12]
            mp3_path = text_to_speech(ai_answer)
            # Move to the persistent TTS dir so the static route can serve it
            dest = os.path.join(_TTS_DIR, f"{audio_id}.mp3")
            shutil.move(mp3_path, dest)
            audio_url = f"/api/tts-audio/{audio_id}.mp3"
        except Exception:  # pylint: disable=broad-exception-caught
            logger.warning("TTS for voice-input failed")

    return {
        "transcription": transcription,
        "ai_response": ai_answer,
        "audio_url": audio_url,
        "sources": sources,
    }


# ── POST /speak ─────────────────────────────────────────────

class SpeakRequest(BaseModel):
    text: str
    slow: bool = False


@router.post("/speak")
async def speak(body: SpeakRequest):
    """Convert text to speech and return the MP3 file."""
    if not body.text.strip():
        raise HTTPException(status_code=400, detail="Text is required")
    if len(body.text) > 10000:
        raise HTTPException(status_code=400, detail="Text is too long")

    try:
        mp3_path = text_to_speech(body.text, slow=body.slow)
        return FileResponse(
            mp3_path,
            media_type="audio/mpeg",
            filename="speech.mp3",
        )
    except Exception as exc:
        logger.exception("TTS failed")
        raise HTTPException(status_code=500, detail=f"Text-to-speech failed: {exc}") from exc


# ── GET /tts-audio/{filename} ───────────────────────────────

@router.get("/tts-audio/{filename}")
async def serve_tts_audio(filename: str):
    """
    Serve a previously generated TTS MP3 file.
    Used by the frontend to autoplay voice responses.
    """
    safe_name = os.path.basename(filename)
    path = os.path.join(_TTS_DIR, safe_name)

    if not os.path.isfile(path):
        raise HTTPException(status_code=404, detail="Audio file not found")

    return FileResponse(path, media_type="audio/mpeg", filename=safe_name)
