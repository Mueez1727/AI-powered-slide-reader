import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Home } from 'lucide-react';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background-light dark:bg-background-dark bg-mesh text-center px-4">
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.4 }}
        className="flex flex-col items-center"
      >
        <h1 className="text-8xl font-bold text-gradient">404</h1>
        <p className="mt-4 text-xl font-semibold text-gray-900 dark:text-white">Page not found</p>
        <p className="mt-2 text-sm text-gray-500 dark:text-gray-400 max-w-sm">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
        </p>
        <Link to="/" className="btn-primary mt-6">
          <Home className="h-4 w-4" /> Go Home
        </Link>
      </motion.div>
    </div>
  );
}
