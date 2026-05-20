import { useTheme } from '../context/ThemeContext.jsx';

const LINKS = [
  { label: 'Book appointment', href: '#', icon: '📅' },
  { label: 'Vaccination schedule', href: '#', icon: '💉' },
  { label: 'Mental wellness', href: '#', icon: '🧠' },
  { label: 'Pharmacy hours', href: '#', icon: '🏥' },
  { label: 'Insurance & claims', href: '#', icon: '📋' },
];

export default function UsefulLinks({ compact = false }) {
  const { isDark } = useTheme();
  const pad = compact ? 'p-4' : 'p-5';
  const card = isDark
    ? 'bg-white/10 backdrop-blur-md border-white/20'
    : 'bg-white/70 backdrop-blur-md border-slate-200';
  const label = isDark ? 'text-slate-200 group-hover:text-white' : 'text-slate-700 group-hover:text-slate-900';
  const hover = isDark ? 'hover:bg-white/10' : 'hover:bg-slate-100';

  return (
    <div className={`rounded-xl border ${pad} shadow-lg ${card}`}>
      <span className="text-[10px] font-semibold uppercase tracking-wider text-emerald-500 block mb-3">
        Useful links
      </span>
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5">
        {LINKS.map((l) => (
          <a
            key={l.label}
            href={l.href}
            className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg transition group ${hover}`}
          >
            <span className="text-lg">{l.icon}</span>
            <span className={`text-[11px] text-center leading-tight ${label}`}>
              {l.label}
            </span>
          </a>
        ))}
      </div>
    </div>
  );
}
