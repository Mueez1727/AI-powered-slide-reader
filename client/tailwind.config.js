/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Light mode primary: soft blue
        primary: {
          50: '#eef4ff',
          100: '#d9e6ff',
          200: '#bbcfff',
          300: '#8db0ff',
          400: '#5885ff',
          500: '#3366ff',
          600: '#1a4cff',
          700: '#0d3ae6',
          800: '#1130ba',
          900: '#142e92',
          950: '#0f1d59',
        },
        // Dark mode accent: purple
        accent: {
          50: '#faf5ff',
          100: '#f3e8ff',
          200: '#e9d5ff',
          300: '#d8b4fe',
          400: '#c084fc',
          500: '#a855f7',
          600: '#9333ea',
          700: '#7e22ce',
          800: '#6b21a8',
          900: '#581c87',
          950: '#3b0764',
        },
        // Surfaces
        surface: {
          light: '#ffffff',
          dark: '#0f172a',
        },
        background: {
          light: '#f0f4f8',
          dark: '#020617',
        },
        glass: {
          light: 'rgba(255, 255, 255, 0.60)',
          dark: 'rgba(15, 23, 42, 0.60)',
        },
        navy: {
          800: '#0f172a',
          900: '#020617',
          950: '#010313',
        },
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', '-apple-system', 'sans-serif'],
      },
      fontSize: {
        'xs-a11y': ['0.8125rem', { lineHeight: '1.25rem' }],   // 13px accessible
        'sm-a11y': ['0.9375rem', { lineHeight: '1.375rem' }],  // 15px accessible
        'base-a11y': ['1.0625rem', { lineHeight: '1.625rem' }], // 17px accessible
      },
      borderRadius: {
        '2xl': '1rem',
        '3xl': '1.5rem',
      },
      backdropBlur: {
        xs: '2px',
        '2xl': '40px',
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(31, 38, 135, 0.15)',
        'glass-sm': '0 4px 16px 0 rgba(31, 38, 135, 0.10)',
        'glass-dark': '0 8px 32px 0 rgba(0, 0, 0, 0.35)',
        'glow-primary': '0 0 20px rgba(51, 102, 255, 0.3)',
        'glow-accent': '0 0 20px rgba(168, 85, 247, 0.3)',
        'card-hover': '0 20px 40px -12px rgba(0, 0, 0, 0.15)',
        'card-hover-dark': '0 20px 40px -12px rgba(0, 0, 0, 0.45)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.35s ease-out',
        'slide-down': 'slideDown 0.35s ease-out',
        'scale-in': 'scaleIn 0.2s ease-out',
        'pulse-slow': 'pulse 3s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'shimmer': 'shimmer 2s infinite linear',
        'typing-dot': 'typingDot 1.4s infinite',
        'float': 'float 6s ease-in-out infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { transform: 'translateY(12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        slideDown: {
          '0%': { transform: 'translateY(-12px)', opacity: '0' },
          '100%': { transform: 'translateY(0)', opacity: '1' },
        },
        scaleIn: {
          '0%': { transform: 'scale(0.95)', opacity: '0' },
          '100%': { transform: 'scale(1)', opacity: '1' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        typingDot: {
          '0%, 60%, 100%': { transform: 'translateY(0)', opacity: '0.4' },
          '30%': { transform: 'translateY(-6px)', opacity: '1' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          '0%': { boxShadow: '0 0 5px rgba(51, 102, 255, 0.2)' },
          '100%': { boxShadow: '0 0 20px rgba(51, 102, 255, 0.4)' },
        },
      },
    },
  },
  plugins: [],
};
