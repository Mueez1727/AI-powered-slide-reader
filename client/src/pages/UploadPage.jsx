import { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload as UploadIcon, FileText } from 'lucide-react';
import FileUpload from '../components/ui/FileUpload';
import { useApp } from '../context/AppContext';
import { useNavigate } from 'react-router-dom';
import toast from 'react-hot-toast';

export default function UploadPage() {
  const { dispatch } = useApp();
  const navigate = useNavigate();

  const handleSuccess = (doc) => {
    dispatch({ type: 'ADD_DOCUMENT', payload: doc });
    toast.success('Upload complete! Redirecting…');
    setTimeout(() => navigate(`/slides/${doc._id}`), 800);
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Upload Slides</h1>
        <p className="text-sm-a11y text-gray-500 dark:text-gray-400 mt-0.5">
          Upload a PDF or PowerPoint file to get started
        </p>
      </div>

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="glass-card p-6"
      >
        <FileUpload onUploadSuccess={handleSuccess} />
      </motion.div>
    </div>
  );
}
