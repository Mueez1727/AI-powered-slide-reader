import { Sun, Moon, Menu, LogOut, User, Search } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { useTheme } from '../../context/ThemeContext';
import { useAuth } from '../../context/AuthContext';
import { useApp } from '../../context/AppContext';
import { useNavigate } from 'react-router-dom';

export default function Header() {
  const { darkMode, toggleTheme } = useTheme();
  const { user, logout } = useAuth();
  const { dispatch } = useApp();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const initials = (user?.name || 'U')
    .split(' ')
    .map((w) => w[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  return (
    <header className="glass-card sticky top-0 z-10 flex h-16 shrink-0 items-center justify-between rounded-none border-0 border-b border-white/10 dark:border-gray-800/50 px-4 md:px-6">
      {/* Left — hamburger + title */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => dispatch({ type: 'TOGGLE_SIDEBAR' })}
          className="btn-ghost rounded-xl p-2 md:hidden"
          aria-label="Toggle sidebar"
        >
          <Menu className="h-5 w-5" />
        </button>

        <h1 className="hidden text-base-a11y font-semibold text-gray-800 dark:text-gray-100 sm:block">
          Slide Reader AI
        </h1>
      </div>

      {/* Right — search, theme toggle, avatar, logout */}
      <div className="flex items-center gap-2">
        {/* Search placeholder button */}
        <button
          className="btn-ghost rounded-xl p-2 hidden lg:flex"
          aria-label="Search"
        >
          <Search className="h-[18px] w-[18px] text-gray-500 dark:text-gray-400" />
        </button>

        {/* Dark-mode toggle with animated icons */}
        <button
          onClick={toggleTheme}
          className="relative btn-ghost rounded-xl p-2"
          aria-label={darkMode ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          <AnimatePresence mode="wait" initial={false}>
            {darkMode ? (
              <motion.div
                key="sun"
                initial={{ scale: 0, rotate: -90 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: 90 }}
                transition={{ duration: 0.2 }}
              >
                <Sun className="h-5 w-5 text-amber-400" />
              </motion.div>
            ) : (
              <motion.div
                key="moon"
                initial={{ scale: 0, rotate: 90 }}
                animate={{ scale: 1, rotate: 0 }}
                exit={{ scale: 0, rotate: -90 }}
                transition={{ duration: 0.2 }}
              >
                <Moon className="h-5 w-5 text-primary-600" />
              </motion.div>
            )}
          </AnimatePresence>
        </button>

        {/* User avatar pill */}
        <div className="flex items-center gap-2 rounded-full bg-gray-100/70 dark:bg-white/5 backdrop-blur-sm pl-1 pr-3 py-1">
          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-primary-500 to-primary-700 dark:from-accent-500 dark:to-accent-600 text-[11px] font-bold text-white select-none">
            {initials}
          </div>
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200 hidden sm:inline">
            {user?.name || 'User'}
          </span>
        </div>

        {/* Logout */}
        <button
          onClick={handleLogout}
          className="btn-ghost rounded-xl p-2 text-red-500 hover:text-red-600 dark:hover:text-red-400"
          aria-label="Logout"
        >
          <LogOut className="h-[18px] w-[18px]" />
        </button>
      </div>
    </header>
  );
}
