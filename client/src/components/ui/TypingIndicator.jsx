import { motion } from 'framer-motion';

/**
 * Animated "AI is typing…" indicator with bouncing dots.
 * Uses the `typing-dot` animation from tailwind.config.js.
 */
export default function TypingIndicator({ label = 'AI is thinking' }) {
  const dotVariants = {
    initial: { y: 0 },
    animate: (i) => ({
      y: [0, -6, 0],
      transition: {
        duration: 0.6,
        repeat: Infinity,
        delay: i * 0.15,
        ease: 'easeInOut',
      },
    }),
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="flex items-center gap-3"
      role="status"
      aria-label={label}
    >
      <div className="glass-card flex items-center gap-1.5 px-4 py-3 rounded-2xl rounded-bl-md">
        {[0, 1, 2].map((i) => (
          <motion.span
            key={i}
            custom={i}
            variants={dotVariants}
            initial="initial"
            animate="animate"
            className="block h-2 w-2 rounded-full bg-primary-500 dark:bg-accent-400"
          />
        ))}
        <span className="ml-2 text-xs text-gray-400 dark:text-gray-500 select-none">
          {label}…
        </span>
      </div>
    </motion.div>
  );
}
