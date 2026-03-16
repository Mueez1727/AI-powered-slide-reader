import { motion } from 'framer-motion';
import { Moon, Sun, Eye, Type, Monitor } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function Settings() {
  const { darkMode, toggleTheme, highContrast, toggleHighContrast, largerText, toggleLargerText } =
    useTheme();

  const sections = [
    {
      title: 'Appearance',
      items: [
        {
          icon: darkMode ? Moon : Sun,
          label: 'Dark Mode',
          description: 'Switch between light and dark colour scheme',
          checked: darkMode,
          onChange: toggleTheme,
        },
        {
          icon: Eye,
          label: 'High Contrast',
          description: 'Increase contrast for better readability',
          checked: highContrast,
          onChange: toggleHighContrast,
        },
        {
          icon: Type,
          label: 'Larger Text',
          description: 'Use larger font sizes throughout the app',
          checked: largerText,
          onChange: toggleLargerText,
        },
      ],
    },
  ];

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Settings</h1>
        <p className="text-sm-a11y text-gray-500 dark:text-gray-400 mt-0.5">
          Customize your experience
        </p>
      </div>

      {sections.map((section) => (
        <motion.div
          key={section.title}
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="glass-card p-1"
        >
          <p className="px-5 pt-4 pb-2 text-xs font-semibold uppercase tracking-widest text-gray-400 dark:text-gray-500">
            {section.title}
          </p>

          <div className="divide-y divide-gray-200/40 dark:divide-gray-700/30">
            {section.items.map((item) => (
              <label
                key={item.label}
                className="flex items-center justify-between gap-4 px-5 py-4 cursor-pointer hover:bg-gray-50/50 dark:hover:bg-white/[0.02] transition-colors rounded-xl"
              >
                <div className="flex items-center gap-3.5">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gray-100 dark:bg-gray-800/60">
                    <item.icon className="h-[18px] w-[18px] text-gray-500 dark:text-gray-400" />
                  </div>
                  <div>
                    <p className="text-sm-a11y font-medium text-gray-900 dark:text-white">
                      {item.label}
                    </p>
                    <p className="text-xs text-gray-500 dark:text-gray-400">{item.description}</p>
                  </div>
                </div>

                {/* Toggle switch */}
                <div className="relative inline-flex h-6 w-11 items-center">
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={item.onChange}
                    className="peer sr-only"
                  />
                  <div className="h-6 w-11 rounded-full bg-gray-300 dark:bg-gray-600 peer-checked:bg-primary-500 dark:peer-checked:bg-accent-500 transition-colors" />
                  <div className="pointer-events-none absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
                </div>
              </label>
            ))}
          </div>
        </motion.div>
      ))}

      {/* About */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1 }}
        className="glass-card p-6 text-center"
      >
        <p className="text-sm font-medium text-gray-900 dark:text-white">SlideAI v1.0</p>
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
          Multimodal AI-Powered Conversational Slide Reader
        </p>
      </motion.div>
    </div>
  );
}
