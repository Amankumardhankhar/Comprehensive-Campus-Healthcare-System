import { useTranslation } from 'react-i18next';
import { useTheme } from '../context/ThemeContext.jsx';

const LANGS = [
  { code: 'en', label: 'English', short: 'EN' },
  { code: 'hi', label: 'हिंदी', short: 'HI' },
  { code: 'ta', label: 'தமிழ்', short: 'TA' },
];

export default function LanguageSelector({ compact = false }) {
  const { i18n } = useTranslation();
  const { isDark } = useTheme();
  const active = i18n.resolvedLanguage || i18n.language || 'en';

  return (
    <div
      className={`inline-flex rounded-full p-1 backdrop-blur-xl ring-1 ${
        isDark
          ? 'bg-white/10 ring-white/15'
          : 'bg-white/70 ring-slate-200'
      }`}
    >
      {LANGS.map((l) => {
        const isActive = active === l.code;
        return (
          <button
            key={l.code}
            type="button"
            onClick={() => i18n.changeLanguage(l.code)}
            className={`px-4 ${compact ? 'py-1 text-xs' : 'py-2 text-sm'} font-medium rounded-full transition-all ${
              isActive
                ? isDark
                  ? 'bg-white text-slate-900 shadow'
                  : 'bg-slate-900 text-white shadow'
                : isDark
                ? 'text-white/70 hover:text-white'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            {compact ? l.short : l.label}
          </button>
        );
      })}
    </div>
  );
}
