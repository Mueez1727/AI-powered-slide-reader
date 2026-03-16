import ReactMarkdown from 'react-markdown';
import { motion } from 'framer-motion';
import { User, Bot, Volume2, VolumeX, Loader2, Copy, Check } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import api from '../../lib/api';
import toast from 'react-hot-toast';

/**
 * ChatMessage — renders a single chat bubble with:
 *   • Markdown rendering
 *   • Copy-to-clipboard
 *   • Text-to-speech (manual + autoplay)
 *   • Full accessibility (ARIA roles, live regions, keyboard nav)
 *
 * Props:
 *   message        — { id, role, content }
 *   autoplay       — if true AND role=assistant, auto-speak the message on mount
 *   onAudioStart   — callback when TTS starts playing
 *   onAudioEnd     — callback when TTS finishes playing
 */
export default function ChatMessage({ message, autoplay = false, onAudioStart, onAudioEnd }) {
  const isUser = message.role === 'user';
  const [playingAudio, setPlayingAudio] = useState(false);
  const [copied, setCopied] = useState(false);
  const audioRef = useRef(null);
  const hasAutoplayedRef = useRef(false);

  // ── Autoplay TTS for new AI messages ─────────────────────
  useEffect(() => {
    if (autoplay && !isUser && !hasAutoplayedRef.current && message.content) {
      hasAutoplayedRef.current = true;
      handleSpeak();
    }
  }, []);

  // Cleanup audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        if (audioRef.current._blobUrl) {
          URL.revokeObjectURL(audioRef.current._blobUrl);
        }
      }
    };
  }, []);

  const handleSpeak = async () => {
    // If already playing, stop it
    if (playingAudio && audioRef.current) {
      audioRef.current.pause();
      setPlayingAudio(false);
      onAudioEnd?.();
      return;
    }

    setPlayingAudio(true);
    onAudioStart?.();

    try {
      const { data } = await api.post(
        '/ai/speak',
        { text: message.content },
        { responseType: 'blob' }
      );
      const blobUrl = URL.createObjectURL(data);
      const audio = new Audio(blobUrl);
      audio._blobUrl = blobUrl;
      audioRef.current = audio;

      audio.onended = () => {
        setPlayingAudio(false);
        URL.revokeObjectURL(blobUrl);
        onAudioEnd?.();
      };
      audio.onerror = () => {
        setPlayingAudio(false);
        URL.revokeObjectURL(blobUrl);
        onAudioEnd?.();
      };

      await audio.play();
    } catch {
      toast.error('Text-to-speech failed');
      setPlayingAudio(false);
      onAudioEnd?.();
    }
  };

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.content);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error('Failed to copy');
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 10, scale: 0.98 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
      className={`flex gap-3 ${isUser ? 'flex-row-reverse' : ''}`}
      role="listitem"
      aria-label={`${isUser ? 'You' : 'AI assistant'} said`}
    >
      {/* Avatar */}
      <div
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full shadow-sm ${
          isUser
            ? 'bg-gradient-to-br from-primary-500 to-primary-700 dark:from-primary-400 dark:to-primary-600 text-white'
            : 'bg-gradient-to-br from-emerald-400 to-emerald-600 text-white'
        }`}
        aria-hidden="true"
      >
        {isUser ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
      </div>

      {/* Bubble */}
      <div
        className={`group max-w-[78%] rounded-2xl px-4 py-3 transition-shadow duration-200 ${
          isUser
            ? 'rounded-br-md bg-gradient-to-br from-primary-500 to-primary-600 dark:from-accent-500 dark:to-accent-600 text-white shadow-md shadow-primary-500/20 dark:shadow-accent-500/20'
            : 'glass-card rounded-bl-md'
        }`}
      >
        <div className={`prose-chat text-sm-a11y leading-relaxed ${isUser ? 'text-white [&_code]:bg-white/15 [&_code]:text-white' : ''}`}>
          <ReactMarkdown>{message.content}</ReactMarkdown>
        </div>

        {/* AI-message actions — always visible for screen-reader / keyboard users */}
        {!isUser && (
          <div
            className="mt-2 flex items-center gap-1 opacity-0 group-hover:opacity-100 focus-within:opacity-100 transition-opacity duration-200"
            role="toolbar"
            aria-label="Message actions"
          >
            <button
              onClick={handleCopy}
              className="rounded-lg p-1.5 hover:bg-gray-200/60 dark:hover:bg-white/5 transition-colors focus-visible:opacity-100"
              aria-label={copied ? 'Copied to clipboard' : 'Copy message to clipboard'}
              title="Copy"
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-emerald-500" aria-hidden="true" />
              ) : (
                <Copy className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
              )}
            </button>
            <button
              onClick={handleSpeak}
              className="rounded-lg p-1.5 hover:bg-gray-200/60 dark:hover:bg-white/5 transition-colors focus-visible:opacity-100"
              aria-label={playingAudio ? 'Stop reading aloud' : 'Read message aloud'}
              title={playingAudio ? 'Stop' : 'Read aloud'}
            >
              {playingAudio ? (
                <VolumeX className="h-3.5 w-3.5 text-primary-500 dark:text-accent-400 animate-pulse" aria-hidden="true" />
              ) : (
                <Volume2 className="h-3.5 w-3.5 text-gray-400" aria-hidden="true" />
              )}
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}
