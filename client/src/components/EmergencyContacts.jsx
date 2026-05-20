import { useTheme } from '../context/ThemeContext.jsx';

const CONTACTS = [
  { label: 'Campus Infirmary', number: '+1-555-0101', desc: '24×7 clinic' },
  { label: 'Ambulance', number: '108', desc: 'Emergency' },
  { label: 'Mental Health', number: '1800-599-0019', desc: 'Counselling' },
  { label: 'Women Safety', number: '1091', desc: 'Helpline' },
];

export default function EmergencyContacts({ compact = false }) {
  const { isDark } = useTheme();
  const pad = compact ? 'p-4' : 'p-5';
  const card = isDark
    ? 'bg-white/10 backdrop-blur-md border-white/20'
    : 'bg-white/70 backdrop-blur-md border-slate-200';
  const title = isDark ? 'text-white' : 'text-slate-900';
  const sub = isDark ? 'text-slate-300' : 'text-slate-500';
  const num = isDark ? 'text-brand-300 group-hover:text-white' : 'text-brand-600 group-hover:text-brand-700';
  const hover = isDark ? 'hover:bg-white/5' : 'hover:bg-slate-100';

  return (
    <div className={`rounded-xl border ${pad} shadow-lg ${card}`}>
      <div className="flex items-center gap-2 mb-3">
        <svg className="w-3.5 h-3.5 text-rose-500" viewBox="0 0 24 24" fill="currentColor">
          <path d="M6.62 10.79a15.05 15.05 0 006.59 6.59l2.2-2.2a1 1 0 011.05-.24 11.36 11.36 0 003.57.57 1 1 0 011 1V20a1 1 0 01-1 1A17 17 0 013 4a1 1 0 011-1h3.5a1 1 0 011 1 11.36 11.36 0 00.57 3.57 1 1 0 01-.24 1.05z" />
        </svg>
        <span className="text-[10px] font-semibold uppercase tracking-wider text-rose-500">
          Emergency
        </span>
      </div>
      <ul className="space-y-1.5">
        {CONTACTS.map((c) => (
          <li key={c.label}>
            <a
              href={`tel:${c.number}`}
              className={`flex items-center justify-between gap-2 group -mx-1.5 px-1.5 py-1 rounded-md transition ${hover}`}
            >
              <div className="min-w-0">
                <p className={`text-xs font-medium truncate ${title}`}>{c.label}</p>
                <p className={`text-[10px] truncate ${sub}`}>{c.desc}</p>
              </div>
              <span className={`text-xs font-mono whitespace-nowrap ${num}`}>
                {c.number}
              </span>
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
