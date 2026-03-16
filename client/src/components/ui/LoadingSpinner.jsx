import { motion } from 'framer-motion';
import { Loader2 } from 'lucide-react';

export default function LoadingSpinner({ size = 'md', text = 'Loading...' }) {
  const sizeMap = { sm: 'h-4 w-4', md: 'h-8 w-8', lg: 'h-12 w-12' };

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="flex flex-col items-center justify-center gap-3 py-12"
      role="status"
      aria-label={text}
    >
      <Loader2 className={`${sizeMap[size]} animate-spin text-primary-500 dark:text-accent-400`} />
      {text && <p className="text-sm-a11y text-gray-500 dark:text-gray-400">{text}</p>}
    </motion.div>
  );
}
