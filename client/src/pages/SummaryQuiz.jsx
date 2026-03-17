import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  BookOpen,
  ClipboardList,
  Loader2,
  CheckCircle2,
  XCircle,
  FileText,
  Sparkles,
  ChevronDown,
  ChevronUp,
  RefreshCw,
} from 'lucide-react';
import api from '../lib/api';
import toast from 'react-hot-toast';
import ReactMarkdown from 'react-markdown';
import Skeleton from '../components/ui/Skeleton';
import { useApp } from '../context/AppContext';

/**
 * Normalize MCQ options to ensure exactly 4 valid options labeled A, B, C, D
 * Handles malformed API responses where options might be incomplete or contain N/A
 */
function normalizeMcqOptions(rawOptions, correctAnswer) {
  const labels = ['A', 'B', 'C', 'D'];
  const validOptions = [];

  // Extract valid options from various formats
  for (const opt of rawOptions || []) {
    let text = '';
    if (typeof opt === 'string') {
      // Handle "A. Some text" format
      const match = opt.match(/^[A-D]\.\s*(.+)$/i);
      text = match ? match[1].trim() : opt.trim();
    } else if (opt && typeof opt === 'object') {
      text = opt.text || opt.value || opt.answer || '';
      if (typeof text === 'string') text = text.trim();
    }

    // Skip empty, "N/A", or placeholder options
    if (
      text &&
      text.toLowerCase() !== 'n/a' &&
      text.toLowerCase() !== 'na' &&
      text !== '-' &&
      text !== '—' &&
      text.length > 1
    ) {
      // Check if this option contains multiple answers (malformed)
      // If option A contains all answers like "A) x B) y C) z D) w", split them
      const multiMatch = text.match(/[A-D]\)\s*.+?(?=[A-D]\)|$)/gi);
      if (multiMatch && multiMatch.length > 1) {
        for (const part of multiMatch) {
          const partMatch = part.match(/[A-D]\)\s*(.+)/i);
          if (partMatch && partMatch[1].trim().length > 1) {
            validOptions.push(partMatch[1].trim());
          }
        }
      } else {
        validOptions.push(text);
      }
    }
  }

  // Ensure we have exactly 4 options
  // If we have more than 4, take the first 4
  // If we have fewer than 4, this question is invalid
  if (validOptions.length < 4) {
    return null; // Invalid question
  }

  // Format options with proper labels
  return validOptions.slice(0, 4).map((text, idx) => `${labels[idx]}. ${text}`);
}

/**
 * Normalize quiz data to ensure exactly 5 valid MCQs
 */
function normalizeQuizData(data) {
  const questions = data.questions || data.mcqs || [];
  const normalizedQuestions = [];

  for (const q of questions) {
    if (!q.question || typeof q.question !== 'string') continue;

    const options = normalizeMcqOptions(
      q.options || q.choices || q.answers,
      q.correct_answer || q.correctAnswer || q.answer
    );

    if (!options) continue; // Skip malformed questions

    // Determine correct answer index
    let correctIndex = 0;
    const correctAnswer = q.correct_answer || q.correctAnswer || q.answer || 'A';
    if (typeof correctAnswer === 'string') {
      const letter = correctAnswer.toUpperCase().charAt(0);
      if (letter >= 'A' && letter <= 'D') {
        correctIndex = letter.charCodeAt(0) - 65;
      }
    } else if (typeof correctAnswer === 'number') {
      correctIndex = Math.min(Math.max(0, correctAnswer), 3);
    }

    normalizedQuestions.push({
      question: q.question.trim(),
      options,
      correctIndex,
    });

    // Stop once we have 5 valid questions
    if (normalizedQuestions.length >= 5) break;
  }

  return normalizedQuestions;
}

export default function SummaryQuiz() {
  const { state } = useApp();
  const { documents } = state;
  const [selectedDoc, setSelectedDoc] = useState('');
  const [summaryData, setSummaryData] = useState(null); // { short_summary, detailed_explanation, revision_notes }
  const [quiz, setQuiz] = useState([]);
  const [answers, setAnswers] = useState({});
  const [loadingSummary, setLoadingSummary] = useState(false);
  const [loadingQuiz, setLoadingQuiz] = useState(false);
  const [expandedSection, setExpandedSection] = useState('short'); // 'short' | 'detailed' | 'revision'

  const handleSummarize = async () => {
    if (!selectedDoc) return toast.error('Select a document first');
    setLoadingSummary(true);
    setSummaryData(null);
    try {
      // Explicitly call the summarize endpoint (NOT MCQ)
      const { data } = await api.post('/ai/summarize', {
        documentId: selectedDoc
      });

      // Validate response structure
      if (!data || (!data.short_summary && !data.detailed_explanation && !data.revision_notes)) {
        toast.error('Received invalid summary data. Please try again.');
        return;
      }

      setSummaryData({
        short_summary: data.short_summary || '',
        detailed_explanation: data.detailed_explanation || '',
        revision_notes: data.revision_notes || '',
      });
    } catch (error) {
      console.error('Summarization error:', error);
      toast.error('Summarization failed. Please try again.');
    } finally {
      setLoadingSummary(false);
    }
  };

  const handleGenerateQuiz = async () => {
    if (!selectedDoc) return toast.error('Select a document first');
    setLoadingQuiz(true);
    setQuiz([]);
    setAnswers({});
    try {
      // Explicitly call the MCQ generation endpoint
      const { data } = await api.post('/ai/generate-mcq', {
        documentId: selectedDoc,
        count: 5 // Request 5 questions
      });

      // Normalize and validate the quiz data
      const normalizedQuestions = normalizeQuizData(data);

      if (normalizedQuestions.length === 0) {
        toast.error('Could not generate valid quiz questions. Please try again.');
        return;
      }

      if (normalizedQuestions.length < 5) {
        toast.warning(`Generated ${normalizedQuestions.length} valid questions (some were malformed)`);
      }

      setQuiz(normalizedQuestions);
    } catch (error) {
      console.error('Quiz generation error:', error);
      toast.error('Quiz generation failed. Please try again.');
    } finally {
      setLoadingQuiz(false);
    }
  };

  const selectAnswer = (qIdx, optIdx) => {
    setAnswers((prev) => ({ ...prev, [qIdx]: optIdx }));
  };

  const score = quiz.length > 0
    ? Object.entries(answers).filter(([qIdx, optIdx]) => quiz[qIdx]?.correctIndex === optIdx).length
    : 0;
  const allAnswered = quiz.length > 0 && Object.keys(answers).length === quiz.length;

  const summaryTabs = [
    { key: 'short', label: 'Overview', field: 'short_summary' },
    { key: 'detailed', label: 'Detailed Explanation', field: 'detailed_explanation' },
    { key: 'revision', label: 'Revision Notes', field: 'revision_notes' },
  ];

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Summary & Quiz</h1>
        <p className="text-sm-a11y text-gray-500 dark:text-gray-400 mt-0.5">
          Summarize your slides or generate a quiz to test comprehension
        </p>
      </div>

      {/* Document selector */}
      <div className="glass-card p-5">
        <label htmlFor="doc-select" className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2">
          Select a document
        </label>
        <select
          id="doc-select"
          value={selectedDoc}
          onChange={(e) => setSelectedDoc(e.target.value)}
          className="input-field"
        >
          <option value="">— Choose a document —</option>
          {documents.map((doc) => (
            <option key={doc._id} value={doc._id}>
              {doc.originalName}
            </option>
          ))}
        </select>

        <div className="flex gap-3 mt-4">
          <button
            onClick={handleSummarize}
            disabled={loadingSummary || !selectedDoc}
            className="btn-primary"
          >
            {loadingSummary ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookOpen className="h-4 w-4" />}
            Summarize
          </button>
          <button
            onClick={handleGenerateQuiz}
            disabled={loadingQuiz || !selectedDoc}
            className="btn-secondary"
          >
            {loadingQuiz ? <Loader2 className="h-4 w-4 animate-spin" /> : <ClipboardList className="h-4 w-4" />}
            Generate Quiz
          </button>
        </div>
      </div>

      {/* Summary result — tabbed display for the 3 sections */}
      <AnimatePresence>
        {(summaryData || loadingSummary) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="glass-card p-6"
          >
            <h2 className="text-lg font-semibold mb-4 flex items-center gap-2 text-gray-900 dark:text-white">
              <Sparkles className="h-5 w-5 text-primary-500 dark:text-accent-400" /> Summary
            </h2>
            {loadingSummary ? (
              <div className="space-y-4">
                <Skeleton variant="text" lines={5} />
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating summary...
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                {/* Tab buttons */}
                <div className="flex gap-2 flex-wrap" role="tablist">
                  {summaryTabs.map((tab) => (
                    <button
                      key={tab.key}
                      role="tab"
                      aria-selected={expandedSection === tab.key}
                      onClick={() => setExpandedSection(tab.key)}
                      className={`px-3 py-1.5 rounded-lg text-sm font-medium transition-colors ${
                        expandedSection === tab.key
                          ? 'bg-primary-500/10 dark:bg-accent-500/10 text-primary-700 dark:text-accent-300'
                          : 'text-gray-500 dark:text-gray-400 hover:bg-gray-100/60 dark:hover:bg-white/5'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>

                {/* Tab content */}
                <AnimatePresence mode="wait">
                  {summaryTabs.map((tab) =>
                    expandedSection === tab.key && summaryData[tab.field] ? (
                      <motion.div
                        key={tab.key}
                        role="tabpanel"
                        initial={{ opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -6 }}
                        transition={{ duration: 0.2 }}
                        className="prose-chat text-sm text-gray-700 dark:text-gray-300"
                      >
                        <ReactMarkdown>{summaryData[tab.field]}</ReactMarkdown>
                      </motion.div>
                    ) : null
                  )}
                </AnimatePresence>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Quiz */}
      <AnimatePresence>
        {(quiz.length > 0 || loadingQuiz) && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="space-y-4"
          >
            <div className="flex items-center justify-between flex-wrap gap-2">
              <h2 className="text-lg font-semibold flex items-center gap-2 text-gray-900 dark:text-white">
                <ClipboardList className="h-5 w-5 text-primary-500 dark:text-accent-400" /> Quiz
                {quiz.length > 0 && (
                  <span className="text-sm font-normal text-gray-500 dark:text-gray-400">
                    ({quiz.length} questions)
                  </span>
                )}
              </h2>
              <div className="flex items-center gap-3">
                {allAnswered && (
                  <span className="badge">
                    Score: {score}/{quiz.length}
                  </span>
                )}
                {quiz.length > 0 && !loadingQuiz && (
                  <button
                    onClick={handleGenerateQuiz}
                    className="btn-ghost text-xs py-1.5 px-3"
                    title="Generate new questions"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                    New Quiz
                  </button>
                )}
              </div>
            </div>

            {loadingQuiz ? (
              <div className="space-y-4">
                {[0, 1, 2, 3, 4].map((i) => (
                  <div key={i} className="glass-card p-5 space-y-3">
                    <Skeleton variant="rect" className="h-5 w-3/4" />
                    <Skeleton variant="text" lines={4} />
                  </div>
                ))}
                <div className="flex items-center gap-2 text-sm text-gray-500 dark:text-gray-400">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Generating quiz questions...
                </div>
              </div>
            ) : (
              quiz.map((q, qIdx) => (
                <motion.div
                  key={qIdx}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: qIdx * 0.05 }}
                  className="glass-card p-5"
                >
                  <p className="font-medium text-sm-a11y text-gray-900 dark:text-white mb-3">
                    {qIdx + 1}. {q.question}
                  </p>
                  <div className="space-y-2" role="radiogroup" aria-label={`Question ${qIdx + 1}`}>
                    {q.options.map((opt, optIdx) => {
                      const chosen = answers[qIdx] === optIdx;
                      const isCorrect = q.correctIndex === optIdx;
                      const revealed = answers[qIdx] !== undefined;

                      let optClass =
                        'glass-card px-4 py-2.5 text-sm cursor-pointer transition-all duration-200 hover:bg-gray-50/50 dark:hover:bg-white/[0.02]';
                      if (revealed && chosen && isCorrect)
                        optClass += ' border-emerald-500 bg-emerald-50/50 dark:bg-emerald-900/10';
                      else if (revealed && chosen && !isCorrect)
                        optClass += ' border-red-500 bg-red-50/50 dark:bg-red-900/10';
                      else if (revealed && isCorrect)
                        optClass += ' border-emerald-400/50';

                      return (
                        <button
                          key={optIdx}
                          role="radio"
                          aria-checked={chosen}
                          onClick={() => !revealed && selectAnswer(qIdx, optIdx)}
                          className={`w-full text-left flex items-center gap-3 ${optClass}`}
                          disabled={revealed}
                        >
                          <span className="text-gray-700 dark:text-gray-300 flex-1">{opt}</span>
                          {revealed && isCorrect && (
                            <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                          )}
                          {revealed && chosen && !isCorrect && (
                            <XCircle className="h-4 w-4 text-red-500 shrink-0" />
                          )}
                        </button>
                      );
                    })}
                  </div>
                </motion.div>
              ))
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Empty state */}
      {!summaryData && !loadingSummary && quiz.length === 0 && !loadingQuiz && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="glass-card flex flex-col items-center justify-center p-14 text-center"
        >
          <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-100 to-primary-50 dark:from-accent-900/30 dark:to-accent-800/20">
            <BookOpen className="h-8 w-8 text-primary-500 dark:text-accent-400" />
          </div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-1">
            No results yet
          </h3>
          <p className="text-sm text-gray-500 dark:text-gray-400 max-w-sm">
            Select a document above and click Summarize or Generate Quiz to get started.
          </p>
        </motion.div>
      )}
    </div>
  );
}
