import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  MessageSquare,
  Trash2,
  Clock,
  Plus,
  Upload,
  Sparkles,
  BarChart3,
} from 'lucide-react';
import { useApp } from '../context/AppContext';
import FileUpload from '../components/ui/FileUpload';
import Skeleton, { CardSkeleton } from '../components/ui/Skeleton';
import { formatDate, formatFileSize, truncateText } from '../lib/utils';
import api from '../lib/api';
import toast from 'react-hot-toast';

/* ─── Stat cards shown at the top ─────────────── */
function StatCard({ icon: Icon, label, value, gradient }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      className="glass-card-hover p-5"
    >
      <div className="flex items-center gap-3">
        <div className={`flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br ${gradient} shadow-md`}>
          <Icon className="h-5 w-5 text-white" />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
          <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
        </div>
      </div>
    </motion.div>
  );
}

export default function Dashboard() {
  const { state, dispatch } = useApp();
  const { documents } = state;
  const [loading, setLoading] = useState(true);
  const [showUpload, setShowUpload] = useState(false);

  useEffect(() => {
    fetchDocuments();
  }, []);

  const fetchDocuments = async () => {
    try {
      const { data } = await api.get('/documents');
      dispatch({ type: 'SET_DOCUMENTS', payload: data.documents });
    } catch {
      toast.error('Failed to load documents');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id) => {
    if (!confirm('Are you sure you want to delete this document?')) return;
    try {
      await api.delete(`/documents/${id}`);
      dispatch({ type: 'REMOVE_DOCUMENT', payload: id });
      toast.success('Document deleted');
    } catch {
      toast.error('Failed to delete document');
    }
  };

  const handleUploadSuccess = (doc) => {
    dispatch({ type: 'ADD_DOCUMENT', payload: doc });
    setShowUpload(false);
  };

  const totalSlides = documents.reduce((sum, d) => sum + (d.slideCount || 0), 0);

  /* ── Loading skeleton ────────────────────── */
  if (loading) {
    return (
      <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3">
          {[0, 1, 2].map((i) => (
            <CardSkeleton key={i} />
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="glass-card p-5 space-y-3">
              <Skeleton variant="rect" className="h-10 w-10 rounded-xl" />
              <Skeleton variant="rect" className="h-4 w-3/4" />
              <Skeleton variant="text" lines={2} />
              <div className="flex gap-2">
                <Skeleton variant="rect" className="h-8 flex-1 rounded-xl" />
                <Skeleton variant="rect" className="h-8 flex-1 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* ── Header row ──────────────────── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Dashboard</h1>
          <p className="text-sm-a11y text-gray-500 dark:text-gray-400 mt-0.5">
            Manage your slide decks and AI conversations
          </p>
        </div>
        <button onClick={() => setShowUpload(!showUpload)} className="btn-primary">
          <Plus className="h-4 w-4" />
          Upload Slides
        </button>
      </div>

      {/* ── Stats row ───────────────────── */}
      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard
          icon={FileText}
          label="Documents"
          value={documents.length}
          gradient="from-primary-500 to-primary-700 dark:from-accent-500 dark:to-accent-700"
        />
        <StatCard
          icon={BarChart3}
          label="Total Slides"
          value={totalSlides}
          gradient="from-emerald-500 to-emerald-700"
        />
        <StatCard
          icon={Sparkles}
          label="AI Sessions"
          value={documents.filter((d) => d.chatHistory?.length).length}
          gradient="from-amber-500 to-orange-600"
        />
      </div>

      {/* ── Upload area ─────────────────── */}
      <AnimatePresence>
        {showUpload && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="glass-card p-6">
              <FileUpload onUploadSuccess={handleUploadSuccess} />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Empty state ─────────────────── */}
      {documents.length === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="glass-card flex flex-col items-center justify-center p-14 text-center"
        >
          <div className="mb-5 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-primary-100 to-primary-50 dark:from-accent-900/30 dark:to-accent-800/20">
            <Upload className="h-9 w-9 text-primary-500 dark:text-accent-400" />
          </div>
          <h3 className="text-lg font-semibold mb-1.5 text-gray-900 dark:text-white">
            No documents yet
          </h3>
          <p className="text-sm-a11y text-gray-500 dark:text-gray-400 mb-5 max-w-sm">
            Upload your first slide deck to start asking AI-powered questions about your content.
          </p>
          <button onClick={() => setShowUpload(true)} className="btn-primary">
            <Plus className="h-4 w-4" /> Upload Slides
          </button>
        </motion.div>
      ) : (
        /* ── Document grid ────────────── */
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {documents.map((doc, i) => (
            <motion.div
              key={doc._id}
              initial={{ opacity: 0, y: 14 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.04, duration: 0.35 }}
              className="glass-card-hover group p-5"
            >
              <div className="flex items-start justify-between mb-3">
                <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-primary-100 to-primary-50 dark:from-accent-900/30 dark:to-accent-800/20">
                  <FileText className="h-5 w-5 text-primary-600 dark:text-accent-400" />
                </div>
                <button
                  onClick={() => handleDelete(doc._id)}
                  className="rounded-xl p-1.5 text-gray-400 opacity-0 group-hover:opacity-100 hover:bg-red-50 hover:text-red-500 dark:hover:bg-red-900/20 transition-all"
                  aria-label={`Delete ${doc.originalName}`}
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>

              <h3
                className="font-semibold text-sm-a11y mb-1 truncate text-gray-900 dark:text-white"
                title={doc.originalName}
              >
                {doc.originalName}
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">
                {formatFileSize(doc.fileSize)} &middot; {doc.slideCount || '—'} slides
              </p>

              <div className="flex items-center gap-1.5 text-xs text-gray-400 dark:text-gray-500 mb-4">
                <Clock className="h-3 w-3" />
                {formatDate(doc.createdAt)}
              </div>

              <div className="flex gap-2">
                <Link
                  to={`/slides/${doc._id}`}
                  className="btn-secondary flex-1 justify-center text-xs py-2"
                >
                  <FileText className="h-3.5 w-3.5" /> View
                </Link>
                <Link
                  to={`/chat/${doc._id}`}
                  className="btn-primary flex-1 justify-center text-xs py-2"
                >
                  <MessageSquare className="h-3.5 w-3.5" /> Chat
                </Link>
              </div>
            </motion.div>
          ))}
        </div>
      )}
    </div>
  );
}
