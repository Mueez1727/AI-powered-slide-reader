import { useCallback, useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, FileText, X, CheckCircle, AlertCircle } from 'lucide-react';
import { formatFileSize } from '../../lib/utils';
import api from '../../lib/api';
import toast from 'react-hot-toast';

const ACCEPTED_TYPES = {
  'application/pdf': ['.pdf'],
  'application/vnd.ms-powerpoint': ['.ppt'],
  'application/vnd.openxmlformats-officedocument.presentationml.presentation': ['.pptx'],
};

export default function FileUpload({ onUploadSuccess }) {
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [selectedFile, setSelectedFile] = useState(null);

  const onDrop = useCallback((acceptedFiles, rejectedFiles) => {
    if (rejectedFiles.length > 0) {
      toast.error('Invalid file type. Please upload PDF or PPT/PPTX files.');
      return;
    }
    if (acceptedFiles.length > 0) {
      setSelectedFile(acceptedFiles[0]);
    }
  }, []);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: ACCEPTED_TYPES,
    maxFiles: 1,
    maxSize: 50 * 1024 * 1024,
  });

  const handleUpload = async () => {
    if (!selectedFile) return;

    setUploading(true);
    setUploadProgress(0);

    const formData = new FormData();
    formData.append('file', selectedFile);

    try {
      const { data } = await api.post('/documents/upload', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (progressEvent) => {
          const percent = Math.round((progressEvent.loaded * 100) / progressEvent.total);
          setUploadProgress(percent);
        },
      });

      toast.success('File uploaded and processing started!');
      setSelectedFile(null);
      onUploadSuccess?.(data.document);
    } catch (err) {
      toast.error(err.response?.data?.message || 'Upload failed. Please try again.');
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  return (
    <div className="space-y-4">
      {/* Dropzone */}
      <div
        {...getRootProps()}
        className={`cursor-pointer rounded-2xl border-2 border-dashed p-10 text-center transition-all duration-300 ${
          isDragActive
            ? 'border-primary-500 dark:border-accent-400 bg-primary-50/50 dark:bg-accent-900/10 scale-[1.01]'
            : 'border-gray-300/70 dark:border-gray-600/50 hover:border-primary-400 dark:hover:border-accent-500 hover:bg-gray-50/50 dark:hover:bg-white/[0.02]'
        }`}
        role="button"
        tabIndex={0}
        aria-label="Upload slide file"
      >
        <input {...getInputProps()} aria-label="File input" />
        <motion.div
          animate={isDragActive ? { scale: 1.1, y: -4 } : { scale: 1, y: 0 }}
          transition={{ type: 'spring', stiffness: 300, damping: 20 }}
        >
          <div className={`mx-auto flex h-14 w-14 items-center justify-center rounded-2xl transition-colors ${
            isDragActive
              ? 'bg-primary-100 dark:bg-accent-900/30'
              : 'bg-gray-100 dark:bg-gray-800/60'
          }`}>
            <Upload className={`h-6 w-6 ${isDragActive ? 'text-primary-500 dark:text-accent-400' : 'text-gray-400'}`} />
          </div>
        </motion.div>
        <p className="mt-4 text-sm font-medium text-gray-700 dark:text-gray-300">
          {isDragActive ? 'Drop your file here' : 'Drag & drop your slides here'}
        </p>
        <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
          PDF, PPT, PPTX up to 50MB
        </p>
      </div>

      {/* Selected file card */}
      <AnimatePresence>
        {selectedFile && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="glass-card flex items-center gap-3 p-4"
          >
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary-100 dark:bg-accent-900/30">
              <FileText className="h-5 w-5 text-primary-500 dark:text-accent-400" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-sm font-medium text-gray-900 dark:text-white">{selectedFile.name}</p>
              <p className="text-xs text-gray-500 dark:text-gray-400">{formatFileSize(selectedFile.size)}</p>
            </div>
            {!uploading && (
              <button
                onClick={() => setSelectedFile(null)}
                className="btn-ghost rounded-xl p-1.5"
                aria-label="Remove selected file"
              >
                <X className="h-4 w-4" />
              </button>
            )}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Animated progress bar */}
      {uploading && (
        <div className="space-y-2">
          <div className="h-2 overflow-hidden rounded-full bg-gray-200/60 dark:bg-gray-700/40">
            <motion.div
              className="h-full rounded-full bg-gradient-to-r from-primary-500 to-primary-600 dark:from-accent-500 dark:to-accent-600"
              initial={{ width: 0 }}
              animate={{ width: `${uploadProgress}%` }}
              transition={{ duration: 0.3, ease: 'easeOut' }}
            />
          </div>
          <p className="text-center text-xs text-gray-500 dark:text-gray-400">{uploadProgress}% uploaded</p>
        </div>
      )}

      {selectedFile && !uploading && (
        <button onClick={handleUpload} className="btn-primary w-full">
          <Upload className="h-4 w-4" />
          Upload & Process
        </button>
      )}
    </div>
  );
}
