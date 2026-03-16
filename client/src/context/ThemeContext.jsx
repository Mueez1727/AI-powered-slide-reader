import { createContext, useContext, useEffect, useState, useCallback } from 'react';

const ThemeContext = createContext();

export function ThemeProvider({ children }) {
  const [darkMode, setDarkMode] = useState(() => {
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('theme');
      if (stored) return stored === 'dark';
      return window.matchMedia('(prefers-color-scheme: dark)').matches;
    }
    return true;
  });

  const [highContrast, setHighContrast] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('highContrast') === 'true';
    }
    return false;
  });

  const [largerText, setLargerText] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('largerText') === 'true';
    }
    return false;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (darkMode) {
      root.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      root.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  }, [darkMode]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('high-contrast', highContrast);
    localStorage.setItem('highContrast', highContrast);
  }, [highContrast]);

  useEffect(() => {
    const root = document.documentElement;
    root.classList.toggle('larger-text', largerText);
    localStorage.setItem('largerText', largerText);
  }, [largerText]);

  // Listen for OS-level preference changes
  useEffect(() => {
    const mq = window.matchMedia('(prefers-color-scheme: dark)');
    const handler = (e) => {
      if (!localStorage.getItem('theme')) {
        setDarkMode(e.matches);
      }
    };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const toggleTheme = useCallback(() => setDarkMode((prev) => !prev), []);
  const toggleHighContrast = useCallback(() => setHighContrast((prev) => !prev), []);
  const toggleLargerText = useCallback(() => setLargerText((prev) => !prev), []);

  return (
    <ThemeContext.Provider
      value={{
        darkMode,
        toggleTheme,
        highContrast,
        toggleHighContrast,
        largerText,
        toggleLargerText,
      }}
    >
      {children}
    </ThemeContext.Provider>
  );
}

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error('useTheme must be used within ThemeProvider');
  return ctx;
};
