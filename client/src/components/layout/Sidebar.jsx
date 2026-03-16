import { NavLink, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutDashboard,
  Upload,
  MessageSquare,
  ClipboardList,
  Settings,
  FileText,
  X,
  Sparkles,
} from 'lucide-react';
import { useApp } from '../../context/AppContext';

const navItems = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/upload', icon: Upload, label: 'Upload Slides' },
  { to: '/chat', icon: MessageSquare, label: 'AI Chat' },
  { to: '/summary', icon: ClipboardList, label: 'Summary & Quiz' },
  { to: '/settings', icon: Settings, label: 'Settings' },
];

export default function Sidebar() {
  const { state, dispatch } = useApp();
  const { sidebarOpen, documents } = state;
  const location = useLocation();

  const closeSidebar = () => dispatch({ type: 'TOGGLE_SIDEBAR' });

  return (
    <>
      {/* Mobile overlay */}
      <AnimatePresence>
        {sidebarOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.4 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-20 bg-black/60 backdrop-blur-sm md:hidden"
            onClick={closeSidebar}
          />
        )}
      </AnimatePresence>

      <aside
        className={`fixed inset-y-0 left-0 z-30 w-[264px] transform transition-transform duration-300 md:relative md:translate-x-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex h-full flex-col glass-card rounded-none md:rounded-r-2xl border-0 border-r border-white/10 dark:border-gray-800/60">
          {/* ── Logo / Brand ──────────────────── */}
          <div className="flex h-16 shrink-0 items-center justify-between px-5">
            <div className="flex items-center gap-2.5">
              <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-br from-primary-500 to-primary-700 dark:from-accent-500 dark:to-accent-700 shadow-md">
                <Sparkles className="h-[18px] w-[18px] text-white" />
              </div>
              <span className="text-lg font-bold text-gradient select-none">SlideAI</span>
            </div>
            <button
              onClick={closeSidebar}
              className="btn-ghost rounded-lg p-1.5 md:hidden"
              aria-label="Close sidebar"
            >
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* ── Navigation ────────────────────── */}
          <nav className="flex-1 overflow-y-auto px-3 py-4" aria-label="Main navigation">
            <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
              Menu
            </p>
            <ul className="space-y-1">
              {navItems.map(({ to, icon: Icon, label }) => {
                const isActive = location.pathname.startsWith(to);
                return (
                  <li key={to}>
                    <NavLink
                      to={to}
                      onClick={() => sidebarOpen && closeSidebar()}
                      className={`group relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm-a11y font-medium transition-all duration-200 ${
                        isActive
                          ? 'bg-primary-500/10 dark:bg-accent-500/10 text-primary-700 dark:text-accent-300'
                          : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100/60 dark:hover:bg-white/5'
                      }`}
                    >
                      {/* Active indicator bar */}
                      {isActive && (
                        <motion.div
                          layoutId="sidebar-active"
                          className="absolute left-0 top-1/2 -translate-y-1/2 h-6 w-[3px] rounded-full bg-gradient-to-b from-primary-500 to-primary-600 dark:from-accent-400 dark:to-accent-600"
                          transition={{ type: 'spring', stiffness: 350, damping: 30 }}
                        />
                      )}
                      <Icon className={`h-[18px] w-[18px] shrink-0 transition-colors ${isActive ? 'text-primary-600 dark:text-accent-400' : 'group-hover:text-gray-800 dark:group-hover:text-gray-200'}`} />
                      <span>{label}</span>
                    </NavLink>
                  </li>
                );
              })}
            </ul>

            {/* ── Recent Documents ─────────────── */}
            {documents.length > 0 && (
              <div className="mt-6">
                <p className="mb-2 px-3 text-[11px] font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                  Recent Slides
                </p>
                <ul className="space-y-0.5">
                  {documents.slice(0, 6).map((doc) => (
                    <li key={doc._id}>
                      <NavLink
                        to={`/slides/${doc._id}`}
                        className={({ isActive: active }) =>
                          `flex items-center gap-2 rounded-xl px-3 py-2 text-sm transition-colors ${
                            active
                              ? 'bg-primary-500/10 dark:bg-accent-500/10 text-primary-700 dark:text-accent-300'
                              : 'text-gray-500 dark:text-gray-500 hover:bg-gray-100/60 dark:hover:bg-white/5 hover:text-gray-700 dark:hover:text-gray-300'
                          }`
                        }
                      >
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="truncate">{doc.originalName}</span>
                      </NavLink>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </nav>

          {/* ── Footer / Version ──────────────── */}
          <div className="shrink-0 border-t border-gray-200/40 dark:border-gray-700/30 px-5 py-3">
            <p className="text-xs text-gray-400 dark:text-gray-600 select-none">
              SlideAI v1.0 — Powered by AI
            </p>
          </div>
        </div>
      </aside>
    </>
  );
}
