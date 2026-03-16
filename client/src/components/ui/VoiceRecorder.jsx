import { useState, useRef, useCallback, useEffect } from 'react';
import { Mic, MicOff, Loader2, Square } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import api from '../../lib/api';
import toast from 'react-hot-toast';

/**
 * VoiceRecorder — accessible voice input with live transcription.
 *
 * Props:
 *   onTranscription(text)     — called when final text is ready
 *   onVoiceResponse(data)     — called when full /voice-input returns (transcription + AI answer + audio_url)
 *   documentId                — optional, enables RAG pipeline on the backend
 *   disabled                  — disables the button
 *   useFullPipeline           — if true, POST to /voice-input (STT→RAG→TTS); else /transcribe
 *   autoplayResponse          — if true, autoplay the TTS audio from /voice-input
 */
export default function VoiceRecorder({
  onTranscription,
  onVoiceResponse,
  documentId,
  disabled = false,
  useFullPipeline = false,
  autoplayResponse = true,
}) {
  const [recording, setRecording] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [liveText, setLiveText] = useState('');

  const mediaRecorderRef = useRef(null);
  const chunksRef = useRef([]);
  const timerRef = useRef(null);
  const audioRef = useRef(null);

  // ── Recording timer ──────────────────────────────────────
  useEffect(() => {
    if (recording) {
      setElapsed(0);
      timerRef.current = setInterval(() => setElapsed((t) => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [recording]);

  const formatTime = (s) => {
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  // ── Start recording ──────────────────────────────────────
  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported('audio/webm;codecs=opus')
          ? 'audio/webm;codecs=opus'
          : 'audio/webm',
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data);
      };

      mediaRecorder.onstop = async () => {
        const blob = new Blob(chunksRef.current, { type: 'audio/webm' });
        stream.getTracks().forEach((t) => t.stop());
        await processAudio(blob);
      };

      mediaRecorder.start(250); // collect chunks every 250ms
      setRecording(true);
      setLiveText('');

      // Announce to screen-readers
      announceToScreenReader('Recording started. Speak now.');
    } catch {
      toast.error('Microphone access denied. Please allow microphone access in your browser settings.');
    }
  }, []);

  // ── Stop recording ───────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current?.state === 'recording') {
      mediaRecorderRef.current.stop();
      setRecording(false);
      announceToScreenReader('Recording stopped. Processing your audio.');
    }
  }, []);

  // ── Process audio ────────────────────────────────────────
  const processAudio = async (blob) => {
    setProcessing(true);
    setLiveText('Transcribing…');

    const formData = new FormData();
    formData.append('audio', blob, 'recording.webm');

    try {
      if (useFullPipeline) {
        // Full pipeline: STT → RAG → TTS
        if (documentId) {
          formData.append('document_id', documentId);
        }

        const { data } = await api.post('/ai/voice-input', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 180000,
        });

        const text = data.transcription?.text || '';
        setLiveText(text);
        onTranscription?.(text);
        onVoiceResponse?.(data);

        announceToScreenReader(
          data.ai_response
            ? `You said: ${text}. AI response: ${data.ai_response.slice(0, 200)}`
            : `Transcription: ${text}`
        );

        // Autoplay TTS audio
        if (autoplayResponse && data.audio_url) {
          playAudio(data.audio_url);
        }
      } else {
        // Simple transcription only
        const { data } = await api.post('/ai/transcribe', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
          timeout: 60000,
        });

        const text = data.text || '';
        setLiveText(text);
        onTranscription?.(text);
        announceToScreenReader(`Transcription: ${text}`);
      }
    } catch {
      toast.error('Failed to process audio. Please try again.');
      setLiveText('');
    } finally {
      setProcessing(false);
    }
  };

  // ── Play TTS audio ───────────────────────────────────────
  const playAudio = (url) => {
    try {
      // Build absolute URL from the API base
      const baseUrl = api.defaults.baseURL?.replace(/\/api\/?$/, '') || '';
      const fullUrl = url.startsWith('http') ? url : `${baseUrl}${url}`;

      // Attach auth token for protected route
      const token = localStorage.getItem('token');
      const audioUrl = new URL(fullUrl);

      // Use fetch + blob so we can pass auth header
      fetch(audioUrl.toString(), {
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      })
        .then((r) => r.blob())
        .then((blob) => {
          const blobUrl = URL.createObjectURL(blob);
          if (audioRef.current) {
            audioRef.current.pause();
            URL.revokeObjectURL(audioRef.current.src);
          }
          const audio = new Audio(blobUrl);
          audioRef.current = audio;
          audio.onended = () => URL.revokeObjectURL(blobUrl);
          audio.play().catch(() => {
            // Autoplay blocked — user gesture required
            toast('Tap the speaker icon to hear the response', { icon: '🔊' });
          });
        });
    } catch {
      // Non-critical
    }
  };

  // ── Screen reader announcements ──────────────────────────
  const announceToScreenReader = (message) => {
    const el = document.getElementById('voice-sr-announce');
    if (el) {
      el.textContent = '';
      // Force reflow so the screen reader re-reads
      requestAnimationFrame(() => {
        el.textContent = message;
      });
    }
  };

  // ── Keyboard shortcut (Space to toggle) ──────────────────
  const handleKeyDown = (e) => {
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      recording ? stopRecording() : startRecording();
    }
  };

  return (
    <>
      {/* Live region for screen readers */}
      <div
        id="voice-sr-announce"
        role="status"
        aria-live="assertive"
        aria-atomic="true"
        className="sr-only"
      />

      <div className="relative flex items-center gap-2">
        {/* Live transcription bubble */}
        <AnimatePresence>
          {(recording || liveText) && (
            <motion.div
              initial={{ opacity: 0, x: 10, scale: 0.9 }}
              animate={{ opacity: 1, x: 0, scale: 1 }}
              exit={{ opacity: 0, x: 10, scale: 0.9 }}
              className="absolute bottom-full right-0 mb-2 w-64 max-w-[80vw]"
            >
              <div className="glass-card rounded-xl px-3 py-2 text-xs">
                {recording && (
                  <div className="flex items-center gap-2 mb-1">
                    <span className="relative flex h-2 w-2">
                      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-red-400 opacity-75" />
                      <span className="relative inline-flex h-2 w-2 rounded-full bg-red-500" />
                    </span>
                    <span className="font-medium text-red-600 dark:text-red-400">
                      Recording {formatTime(elapsed)}
                    </span>
                  </div>
                )}
                {processing && (
                  <div className="flex items-center gap-2 mb-1">
                    <Loader2 className="h-3 w-3 animate-spin text-primary-500 dark:text-accent-400" />
                    <span className="text-gray-500 dark:text-gray-400">Processing…</span>
                  </div>
                )}
                {liveText && (
                  <p
                    className="text-gray-700 dark:text-gray-200 leading-relaxed line-clamp-3"
                    aria-label="Transcription result"
                  >
                    {liveText}
                  </p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Mic button */}
        <motion.button
          type="button"
          whileTap={{ scale: 0.92 }}
          onClick={recording ? stopRecording : startRecording}
          onKeyDown={handleKeyDown}
          disabled={disabled || processing}
          className={`relative rounded-full p-3 transition-all duration-200 focus-visible:ring-2 focus-visible:ring-primary-400 dark:focus-visible:ring-accent-400 ${
            recording
              ? 'bg-red-500 text-white shadow-lg shadow-red-500/30'
              : 'bg-gray-100/60 dark:bg-white/5 backdrop-blur-sm text-gray-600 dark:text-gray-400 hover:bg-gray-200/70 dark:hover:bg-white/10'
          } disabled:opacity-50 disabled:cursor-not-allowed`}
          aria-label={
            processing
              ? 'Processing audio'
              : recording
                ? 'Stop recording (press Space or Enter)'
                : 'Start voice recording (press Space or Enter)'
          }
          aria-pressed={recording}
          role="switch"
          aria-checked={recording}
          title={recording ? 'Stop recording' : 'Voice input'}
        >
          {/* Pulsing ring while recording */}
          {recording && (
            <span
              className="absolute inset-0 rounded-full animate-ping bg-red-400/30"
              aria-hidden="true"
            />
          )}

          {processing ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : recording ? (
            <Square className="h-4 w-4 fill-current" aria-hidden="true" />
          ) : (
            <Mic className="h-5 w-5" aria-hidden="true" />
          )}
        </motion.button>
      </div>
    </>
  );
}
