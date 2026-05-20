/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#eef7ff',
          100: '#d9ecff',
          500: '#2f80ed',
          600: '#1e6fd9',
          700: '#1857b0',
        },
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      keyframes: {
        'float-slow': {
          '0%, 100%': { transform: 'translate(0, 0) rotate(0deg)' },
          '25%': { transform: 'translate(12px, -18px) rotate(6deg)' },
          '50%': { transform: 'translate(-8px, -28px) rotate(-4deg)' },
          '75%': { transform: 'translate(-16px, -10px) rotate(3deg)' },
        },
        'pulse-slow': {
          '0%, 100%': { opacity: '0.4' },
          '50%': { opacity: '0.9' },
        },
        'heart-spin': {
          '0%':   { transform: 'rotate(0deg) scale(1)' },
          '25%':  { transform: 'rotate(90deg) scale(1.1)' },
          '50%':  { transform: 'rotate(180deg) scale(1)' },
          '75%':  { transform: 'rotate(270deg) scale(1.1)' },
          '100%': { transform: 'rotate(360deg) scale(1)' },
        },
      },
      animation: {
        'float-slow': 'float-slow 16s ease-in-out infinite',
        'pulse-slow': 'pulse-slow 4s ease-in-out infinite',
        'heart-spin': 'heart-spin 5s ease-in-out infinite',
      },
    },
  },
  plugins: [],
};
