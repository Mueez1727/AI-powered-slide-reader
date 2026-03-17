import { useEffect, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Send, Sparkles, Volume2, VolumeX } from 'lucide-react';
import { useApp } from '../context/AppContext';
import ChatMessage from '../components/ui/ChatMessage';
import VoiceRecorder from '../components/ui/VoiceRecorder';
import TypingIndicator from '../components/ui/TypingIndicator';
import { MessageSkeleton } from '../components/ui/Skeleton';
import api from '../lib/api';
import toast from 'react-hot-toast';
import { generateId } from '../lib/utils';

export default function Chat() {
  const { id: documentId } = useParams();
  const { state, dispatch } = useApp();
  const { chatHistory, isProcessing } = state;
  const [input, setInput] = useState('');
  const [docName, setDocName] = useState('');
  const [loadingChat, setLoadingChat] = useState(true);
  const [autoplayTTS, setAutoplayTTS] = useState(true);
  const [lastMsgId, setLastMsgId] = useState(null);
  const [streamingText, setStreamingText] = useState('');
  const [isStreaming, setIsStreaming] = useState(false);
  const scrollRef = useRef();
  const inputRef = useRef();

  useEffect(() => {
    loadChat();
    return () => dispatch({ type: 'SET_CHAT_HISTORY', payload: [] });
  }, [documentId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatHistory, isProcessing, streamingText]);

  const loadChat = async () => {
    setLoadingChat(true);
    try {
      const { data } = await api.get(`/documents/${documentId}`);
      setDocName(data.document.originalName);
      const chatRes = await api.get(`/chat/${documentId}`);
      dispatch({ type: 'SET_CHAT_HISTORY', payload: chatRes.data.messages || [] });
    } catch {
      toast.error('Failed to load chat');
    } finally {
      setLoadingChat(false);
    }
  };

  const sendMessage = async (text) => {
    if (!text.trim() || isProcessing || isStreaming) return;

    const userMsg = { id: generateId(), role: 'user', content: text.trim() };
    dispatch({ type: 'ADD_CHAT_MESSAGE', payload: userMsg });
    setInput('');
    setIsStreaming(true);
    setStreamingText('');
    dispatch({ type: 'SET_PROCESSING', payload: true });

    try {
      const token = localStorage.getItem('token');
      const response = await fetch('/api/chat/message/stream', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: token ? `Bearer ${token}` : '',
        },
        body: JSON.stringify({
          documentId,
          message: text.trim(),
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let fullText = '';
      let buffer = '';

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // Parse SSE format: "data: {...}\n\n"
        const lines = buffer.split('\n');
        buffer = lines.pop() || ''; // Keep incomplete line in buffer

        for (const line of lines) {
          if (line.startsWith('data: ')) {
            try {
              const parsed = JSON.parse(line.slice(6));
              if (parsed.token) {
                fullText += parsed.token;
                setStreamingText(fullText);
              }
              if (parsed.error) {
                throw new Error(parsed.error);
              }
            } catch (parseErr) {
              // Skip unparseable lines
              if (parseErr.message && !parseErr.message.includes('JSON')) {
                throw parseErr; // Re-throw non-JSON errors
              }
            }
          }
        }
      }

      // Stream complete - add final message to chat history
      const aiMsgId = generateId();
      const aiMsg = {
        id: aiMsgId,
        role: 'assistant',
        content: fullText || 'No response received.',
        sources: [],
      };
      dispatch({ type: 'ADD_CHAT_MESSAGE', payload: aiMsg });
      setLastMsgId(aiMsgId);
      setStreamingText('');
    } catch (error) {
      console.error('Stream error:', error);
      toast.error('Failed to get response. Please try again.');
      const errMsg = {
        id: generateId(),
        role: 'assistant',
        content: "Sorry, I couldn't process your question. Please try again.",
      };
      dispatch({ type: 'ADD_CHAT_MESSAGE', payload: errMsg });
      setStreamingText('');
    } finally {
      setIsStreaming(false);
      dispatch({ type: 'SET_PROCESSING', payload: false });
      inputRef.current?.focus();
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    sendMessage(input);
  };

  // Simple transcription callback (from VoiceRecorder when not using full pipeline)
  const handleTranscription = (text) => {
    if (text) {
      setInput(text);
      sendMessage(text);
    }
  };

  // Full voice pipeline response (STT → RAG → TTS all done on backend)
  const handleVoiceResponse = (data) => {
    if (!data) return;

    const transcribedText = data.transcription?.text || '';

    // Add user message from voice
    if (transcribedText) {
      const userMsg = { id: generateId(), role: 'user', content: transcribedText };
      dispatch({ type: 'ADD_CHAT_MESSAGE', payload: userMsg });
    }

    // Add AI response with sources
    if (data.ai_response) {
      const aiMsgId = generateId();
      const aiMsg = {
        id: aiMsgId,
        role: 'assistant',
        content: data.ai_response,
        sources: data.sources || [] // Include source slides from voice response
      };
      dispatch({ type: 'ADD_CHAT_MESSAGE', payload: aiMsg });
      // Audio is already autoplayed by VoiceRecorder via audio_url, so skip ChatMessage autoplay
    }
  };

  return (
    <div className="flex h-[calc(100vh-8rem)] max-w-3xl mx-auto flex-col">
      {/* ── Header ──────────────────────── */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900 dark:text-white truncate">
            Chat: {docName || 'Document'}
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Ask questions about your slides — type or use your voice
          </p>
        </div>

        {/* Autoplay TTS toggle */}
        <button
          type="button"
          onClick={() => setAutoplayTTS((v) => !v)}
          className={`btn-ghost rounded-full p-2 ${autoplayTTS ? 'text-primary-500 dark:text-accent-400' : 'text-gray-400'}`}
          aria-label={autoplayTTS ? 'Disable auto-read responses' : 'Enable auto-read responses'}
          aria-pressed={autoplayTTS}
          title={autoplayTTS ? 'Auto-read: ON' : 'Auto-read: OFF'}
        >
          {autoplayTTS ? (
            <Volume2 className="h-4 w-4" aria-hidden="true" />
          ) : (
            <VolumeX className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>

      {/* ── Messages area ───────────────── */}
      <div
        className="flex-1 overflow-y-auto glass-card rounded-2xl p-4 space-y-4"
        role="log"
        aria-label="Chat messages"
        aria-live="polite"
        aria-relevant="additions"
      >
        {loadingChat ? (
          <div className="space-y-5 py-4">
            <MessageSkeleton align="right" />
            <MessageSkeleton align="left" />
            <MessageSkeleton align="right" />
          </div>
        ) : chatHistory.length === 0 ? (
          <div className="flex h-full items-center justify-center text-center">
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="flex flex-col items-center gap-3"
            >
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-100 to-primary-50 dark:from-accent-900/30 dark:to-accent-800/20">
                <Sparkles className="h-7 w-7 text-primary-500 dark:text-accent-400" />
              </div>
              <p className="text-sm font-medium text-gray-600 dark:text-gray-300">
                No messages yet
              </p>
              <p className="text-xs text-gray-400 dark:text-gray-500 max-w-xs">
                Ask a question about your slides — type below or tap the microphone!
              </p>
            </motion.div>
          </div>
        ) : (
          <AnimatePresence initial={false}>
            {chatHistory.map((msg) => (
              <ChatMessage
                key={msg.id}
                message={msg}
                autoplay={autoplayTTS && msg.id === lastMsgId && msg.role === 'assistant'}
              />
            ))}
          </AnimatePresence>
        )}

        {/* Streaming message display */}
        {isStreaming && streamingText && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex justify-start"
          >
            <div className="max-w-[85%] rounded-2xl px-4 py-3 bg-gray-100 dark:bg-gray-800 text-gray-900 dark:text-gray-100">
              <p className="text-sm whitespace-pre-wrap">{streamingText}</p>
              <span className="inline-block w-1 h-4 ml-1 bg-primary-500 dark:bg-accent-400 animate-pulse" />
            </div>
          </motion.div>
        )}

        {/* AI typing indicator - show when streaming starts but no text yet */}
        <AnimatePresence>
          {(isProcessing || isStreaming) && !streamingText && <TypingIndicator />}
        </AnimatePresence>

        <div ref={scrollRef} />
      </div>

      {/* ── Input bar ───────────────────── */}
      <form
        onSubmit={handleSubmit}
        className="mt-4 flex items-end gap-2"
        role="form"
        aria-label="Send a message"
      >
        <div className="relative flex-1">
          <label htmlFor="chat-input" className="sr-only">
            Type your question about the slides
          </label>
          <textarea
            id="chat-input"
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSubmit(e);
              }
            }}
            className="input-field min-h-[44px] max-h-32 resize-none pr-4"
            placeholder="Ask about your slides…"
            rows={1}
            disabled={isProcessing || isStreaming}
            aria-label="Chat message input"
            aria-describedby="chat-input-hint"
          />
          <span id="chat-input-hint" className="sr-only">
            Press Enter to send, Shift+Enter for a new line, or use the microphone button for voice input
          </span>
        </div>

        <VoiceRecorder
          onTranscription={handleTranscription}
          onVoiceResponse={handleVoiceResponse}
          documentId={documentId}
          disabled={isProcessing || isStreaming}
          useFullPipeline={!!documentId}
          autoplayResponse={autoplayTTS}
        />

        <button
          type="submit"
          disabled={!input.trim() || isProcessing || isStreaming}
          className="btn-primary rounded-full p-3"
          aria-label="Send message"
        >
          <Send className="h-5 w-5" aria-hidden="true" />
        </button>
      </form>

      {/* Skip-to-input link for keyboard/screen-reader users */}
      <a
        href="#chat-input"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 btn-primary text-xs"
      >
        Skip to message input
      </a>
    </div>
  );
}
