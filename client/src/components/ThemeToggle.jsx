import { useTheme } from '../context/ThemeContext.jsx';

export default function ThemeToggle({ className = '' }) {
  const { theme, toggle, isDark } = useTheme();

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} theme`}
      className={`group relative flex items-center gap-2 px-3 py-2 rounded-full border backdrop-blur-md transition shadow-lg
        ${isDark
          ? 'bg-white/10 border-white/20 text-white hover:bg-white/20'
          : 'bg-white/70 border-slate-200 text-slate-700 hover:bg-white'} ${className}`}
    >
      <span
        className={`relative w-9 h-5 rounded-full transition-colors ${
          isDark ? 'bg-brand-500/60' : 'bg-slate-300'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform ${
            isDark ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </span>
      <span className="text-xs font-medium">
        {isDark ? '🌙 Dark' : '☀️ Light'}
      </span>
    </button>
  );
}
