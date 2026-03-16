import { useEffect, useState, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ChevronLeft,
  ChevronRight,
  MessageSquare,
  FileText,
  BookOpen,
  Loader2,
  Volume2,
  VolumeX,
} from 'lucide-react';
import api from '../lib/api';
import Skeleton, { CardSkeleton } from '../components/ui/Skeleton';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';

export default function SlideViewer() {
  const { id } = useParams();
  const [document, setDocument] = useState(null);
  const [slides, setSlides] = useState([]);
  const [currentSlide, setCurrentSlide] = useState(0);
  const [summaryData, setSummaryData] = useState(null);
  const [summaryTab, setSummaryTab] = useState('short');
  const [summarizing, setSummarizing] = useState(false);
  const [loading, setLoading] = useState(true);
  const [autoRead, setAutoRead] = useState(false);
  const [speaking, setSpeaking] = useState(false);
  const [audioRef, setAudioRef] = useState(null);

  useEffect(() => {
    fetchDocument();
  }, [id]);

  // Keyboard navigation for slides
  useEffect(() => {
    const handleKey = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') return;
      if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') {
        e.preventDefault();
        setCurrentSlide((prev) => Math.max(0, prev - 1));
      } else if (e.key === 'ArrowRight' || e.key === 'ArrowDown') {
        e.preventDefault();
        setCurrentSlide((prev) => Math.min(slides.length - 1, prev + 1));
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [slides.length]);

  // Auto-read slide content via TTS when slide changes
  useEffect(() => {
    if (!autoRead || slides.length === 0) return;
    const slide = slides[currentSlide];
    if (!slide) return;
    const content =
      (slide.mainContent || slide.main_content || '').trim() ||
      (slide.imageText || slide.image_text || '').replace(/\[OCR Text\]/g, '').trim();
    if (!content) return;

    // Use Web Speech API for auto-read (no server round-trip)
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(content.slice(0, 500));
      utterance.rate = 0.95;
      utterance.onstart = () => setSpeaking(true);
      utterance.onend = () => setSpeaking(false);
      utterance.onerror = () => setSpeaking(false);
      window.speechSynthesis.speak(utterance);
    }

    return () => {
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        setSpeaking(false);
      }
    };
  }, [currentSlide, autoRead, slides]);

  const fetchDocument = async () => {
    try {
      const { data } = await api.get(`/documents/${id}`);
      setDocument(data.document);
      setSlides(data.slides || []);
    } catch {
      toast.error('Failed to load document');
    } finally {
      setLoading(false);
    }
  };

  const handleSummarize = async () => {
    setSummarizing(true);
    try {
      const { data } = await api.post(`/ai/summarize`, { documentId: id });
      setSummaryData({
        short_summary: data.short_summary || '',
        detailed_explanation: data.detailed_explanation || '',
        revision_notes: data.revision_notes || '',
      });
    } catch {
      toast.error('Summarization failed');
    } finally {
      setSummarizing(false);
    }
  };

  const goToSlide = (idx) => {
    if (idx >= 0 && idx < slides.length) setCurrentSlide(idx);
  };

  const toggleAutoRead = () => {
    if (autoRead && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
      setSpeaking(false);
    }
    setAutoRead((prev) => !prev);
  };

  if (loading) {
    return (
      <div className="mx-auto max-w-5xl space-y-6">
        <Skeleton variant="rect" className="h-8 w-64" />
        <div className="glass-card p-6 md:p-8 space-y-4">
          <Skeleton variant="text" lines={4} />
        </div>
      </div>
    );
  }
  if (!document) return <p className="text-center py-12 text-gray-500">Document not found.</p>;

  const slide = slides[currentSlide];

  // Derive display content from backend fields (mainContent / imageText)
  const slideContent = slide
    ? (slide.mainContent || slide.main_content || '').trim() ||
      (slide.imageText || slide.image_text || '').replace(/\[OCR Text\]/g, '').trim() ||
      'No content extracted for this slide.'
    : 'No content extracted for this slide.';

  const slideTitle = slide
    ? slide.heading || slide.title || ''
    : '';

  const summaryTabs = [
    { key: 'short', label: 'Overview', field: 'short_summary' },
    { key: 'detailed', label: 'Detailed', field: 'detailed_explanation' },
    { key: 'revision', label: 'Notes', field: 'revision_notes' },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div>
          <h1 className="text-xl font-bold text-gray-900 dark:text-white truncate">{document.originalName}</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">
            {slides.length} slide{slides.length !== 1 ? 's' : ''}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={toggleAutoRead}
            className={`btn-ghost text-sm py-1.5 px-3 rounded-xl flex items-center gap-1.5 ${autoRead ? 'bg-primary-500/10 dark:bg-accent-500/10 text-primary-700 dark:text-accent-300' : ''}`}
            aria-label={autoRead ? 'Disable auto-read' : 'Enable auto-read for visually impaired'}
            aria-pressed={autoRead}
            title="Auto-read slide content aloud"
          >
            {autoRead ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
            {autoRead ? 'Stop Auto-Read' : 'Auto-Read'}
          </button>
          <button
            onClick={handleSummarize}
            disabled={summarizing}
            className="btn-secondary text-sm"
          >
            {summarizing ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
            Summarize All
          </button>
          <Link to={`/chat/${id}`} className="btn-primary text-sm">
            <MessageSquare className="h-4 w-4" /> Chat
          </Link>
        </div>
      </div>

      {/* Auto-read indicator */}
      {autoRead && speaking && (
        <div className="flex items-center gap-2 text-sm text-primary-600 dark:text-accent-400" aria-live="polite">
          <Volume2 className="h-4 w-4 animate-pulse" />
          Reading slide {currentSlide + 1} aloud...
        </div>
      )}

      {/* Summary */}
      {summaryData && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          className="glass-card p-6"
        >
          <h2 className="text-lg font-semibold mb-3 flex items-center gap-2 text-gray-900 dark:text-white">
            <BookOpen className="h-5 w-5 text-primary-500 dark:text-accent-400" /> Summary
          </h2>
          {/* Tabs */}
          <div className="flex gap-2 mb-3" role="tablist">
            {summaryTabs.map((tab) => (
              <button
                key={tab.key}
                role="tab"
                aria-selected={summaryTab === tab.key}
                onClick={() => setSummaryTab(tab.key)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-colors ${
                  summaryTab === tab.key
                    ? 'bg-primary-500/10 dark:bg-accent-500/10 text-primary-700 dark:text-accent-300'
                    : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100/60 dark:hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <div className="prose-chat text-sm text-gray-700 dark:text-gray-300" role="tabpanel">
            <ReactMarkdown>
              {summaryData[summaryTabs.find((t) => t.key === summaryTab)?.field] || 'No content for this section.'}
            </ReactMarkdown>
          </div>
        </motion.div>
      )}

      {/* Slide Viewer */}
      {slides.length > 0 && (
        <div className="glass-card overflow-hidden">
          <div className="min-h-[300px] p-6 md:p-8">
            <div className="mb-4 flex items-center justify-between">
              <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
                Slide {currentSlide + 1} of {slides.length}
              </span>
              {slideTitle && (
                <h3 className="text-sm font-semibold text-primary-600 dark:text-primary-400">
                  {slideTitle}
                </h3>
              )}
            </div>
            <div
              className="prose-chat text-sm text-gray-700 dark:text-gray-300 whitespace-pre-wrap"
              aria-live="polite"
              aria-atomic="true"
            >
              {slideContent}
            </div>
          </div>

          {/* Navigation */}
          <div className="flex items-center justify-between border-t border-gray-200/40 dark:border-gray-700/30 px-4 py-3">
            <button
              onClick={() => goToSlide(currentSlide - 1)}
              disabled={currentSlide === 0}
              className="btn-secondary text-sm py-1.5"
              aria-label="Previous slide"
            >
              <ChevronLeft className="h-4 w-4" /> Previous
            </button>

            <div className="flex gap-1.5 overflow-x-auto px-2" role="tablist" aria-label="Slide navigation">
              {slides.map((_, i) => (
                <button
                  key={i}
                  role="tab"
                  aria-selected={i === currentSlide}
                  onClick={() => goToSlide(i)}
                  className={`h-6 w-6 min-w-[24px] min-h-[24px] rounded-full transition-colors flex items-center justify-center text-[10px] font-medium ${
                    i === currentSlide
                      ? 'bg-primary-500 text-white'
                      : 'bg-gray-200 dark:bg-gray-600 text-gray-600 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-500'
                  }`}
                  aria-label={`Go to slide ${i + 1}`}
                >
                  {i + 1}
                </button>
              ))}
            </div>

            <button
              onClick={() => goToSlide(currentSlide + 1)}
              disabled={currentSlide === slides.length - 1}
              className="btn-secondary text-sm py-1.5"
              aria-label="Next slide"
            >
              Next <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
