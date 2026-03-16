import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { FileText, MessageSquare, Mic, Brain, ArrowRight, Sparkles } from 'lucide-react';

const features = [
  {
    icon: FileText,
    title: 'Smart Slide Extraction',
    description: 'Upload PDF or PPT files and extract content with OCR-powered text recognition.',
    gradient: 'from-primary-500 to-primary-700',
  },
  {
    icon: MessageSquare,
    title: 'Conversational AI',
    description: 'Ask questions about your slides and get intelligent answers powered by local AI.',
    gradient: 'from-emerald-500 to-emerald-700',
  },
  {
    icon: Brain,
    title: 'Intelligent Summarization',
    description: 'Get concise summaries of entire presentations or individual slides.',
    gradient: 'from-amber-500 to-orange-600',
  },
  {
    icon: Mic,
    title: 'Voice Interaction',
    description: 'Speak your questions and listen to AI responses with speech-to-text and text-to-speech.',
    gradient: 'from-pink-500 to-rose-600',
  },
];

export default function Landing() {
  return (
    <div className="min-h-screen bg-background-light dark:bg-background-dark bg-mesh transition-colors duration-300">
      {/* Header */}
      <header className="glass-card sticky top-0 z-20 flex items-center justify-between rounded-none border-0 border-b border-white/10 dark:border-gray-800/50 px-6 py-3 md:px-12">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 dark:from-accent-500 dark:to-accent-700">
            <Sparkles className="h-4 w-4 text-white" />
          </div>
          <span className="text-lg font-bold text-gradient select-none">SlideAI</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="btn-ghost text-sm font-medium">Sign In</Link>
          <Link to="/register" className="btn-primary text-sm">Get Started</Link>
        </div>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-5xl px-6 py-20 text-center md:py-32">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        >
          <span className="inline-flex items-center gap-1.5 rounded-full bg-primary-100/80 dark:bg-accent-900/20 backdrop-blur-sm px-4 py-1.5 text-sm font-medium text-primary-700 dark:text-accent-300 mb-6 border border-primary-200/50 dark:border-accent-700/30">
            <Sparkles className="h-3.5 w-3.5" />
            AI-Powered &middot; Runs Locally &middot; Privacy-First
          </span>
          <h1 className="text-4xl font-bold tracking-tight text-gray-900 dark:text-white md:text-6xl leading-tight">
            Chat with Your{' '}
            <span className="text-gradient">Presentations</span>
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg text-gray-600 dark:text-gray-400 leading-relaxed">
            Upload your slides, extract content intelligently, and have natural conversations
            about your presentations using local AI — no cloud required.
          </p>
          <div className="mt-10 flex items-center justify-center gap-4">
            <Link to="/register" className="btn-primary text-base px-7 py-3.5">
              Start Free <ArrowRight className="h-4 w-4" />
            </Link>
          </div>
        </motion.div>
      </section>

      {/* Features */}
      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {features.map((feature, i) => (
            <motion.div
              key={feature.title}
              initial={{ opacity: 0, y: 24 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.15 + i * 0.1, duration: 0.5, ease: 'easeOut' }}
              className="glass-card-hover p-6"
            >
              <div className={`mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br ${feature.gradient} shadow-md`}>
                <feature.icon className="h-5 w-5 text-white" />
              </div>
              <h3 className="text-base font-semibold mb-1.5 text-gray-900 dark:text-white">{feature.title}</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400 leading-relaxed">{feature.description}</p>
            </motion.div>
          ))}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-gray-200/50 dark:border-gray-800/50 py-8 text-center text-sm text-gray-400 dark:text-gray-600">
        <p>&copy; {new Date().getFullYear()} SlideAI. All rights reserved.</p>
      </footer>
    </div>
  );
}
