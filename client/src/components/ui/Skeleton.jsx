import { motion } from 'framer-motion';

/** Configurable skeleton placeholder with shimmer animation */
export default function Skeleton({ className = '', variant = 'rect', lines = 1, width, height }) {
  const base = 'skeleton';

  if (variant === 'circle') {
    return (
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        className={`${base} rounded-full ${className}`}
        style={{ width: width || 40, height: height || 40 }}
        aria-hidden="true"
      />
    );
  }

  if (variant === 'text' || lines > 1) {
    return (
      <div className={`space-y-2.5 ${className}`} aria-hidden="true">
        {Array.from({ length: lines }).map((_, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.05 }}
            className={`${base} h-4`}
            style={{
              width: i === lines - 1 ? '70%' : '100%',
            }}
          />
        ))}
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`${base} ${className}`}
      style={{ width, height }}
      aria-hidden="true"
    />
  );
}

/** Pre-built card skeleton that mimics a glassmorllamasm stats card */
export function CardSkeleton() {
  return (
    <div className="glass-card p-6 space-y-4" aria-hidden="true">
      <div className="flex items-center justify-between">
        <Skeleton variant="rect" className="h-10 w-10 rounded-xl" />
        <Skeleton variant="rect" className="h-5 w-16 rounded-full" />
      </div>
      <Skeleton variant="rect" className="h-7 w-24" />
      <Skeleton variant="text" lines={2} />
    </div>
  );
}

/** Chat message skeleton */
export function MessageSkeleton({ align = 'left' }) {
  return (
    <div className={`flex gap-3 ${align === 'right' ? 'flex-row-reverse' : ''}`} aria-hidden="true">
      <Skeleton variant="circle" className="shrink-0" />
      <div className="space-y-2 max-w-[65%]">
        <Skeleton variant="rect" className="h-20 w-64 rounded-2xl" />
        <Skeleton variant="rect" className="h-3 w-16" />
      </div>
    </div>
  );
}
