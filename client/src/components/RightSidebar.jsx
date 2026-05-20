import { useTheme } from '../context/ThemeContext.jsx';

const AI_SERVICES = [
  { name: 'NLP Analyzer',     color: 'bg-sky-400'     },
  { name: 'Disease Predictor', color: 'bg-violet-400'  },
  { name: 'Risk Classifier',   color: 'bg-amber-400'   },
  { name: 'Med Recommender',   color: 'bg-emerald-400' },
  { name: 'Image Analysis',    color: 'bg-rose-400'    },
  { name: 'Anomaly Detector',  color: 'bg-teal-400'    },
];

const VIT_CONTACTS = [
  { label: 'Location',    value: '1st Floor, Dr. A.L. Mudaliar Block' },
  { label: 'Hours',       value: 'Open 24 hours · 7 days a week'      },
  { label: 'Affiliation', value: 'Sri Narayani Hospital & Research Centre' },
  { label: 'Intercom',    value: '2000 / 2238 / 2217'                 },
];

export default function RightSidebar({ extraPanel }) {
  const { isDark } = useTheme();
  const cardBg = isDark ? 'bg-white/6 ring-white/10' : 'bg-white/80 ring-slate-200';
  const subText = isDark ? 'text-white/45' : 'text-slate-400';
  const bodyText = isDark ? 'text-white/80' : 'text-slate-700';

  return (
    <aside className="hidden lg:flex flex-col gap-5">
      {/* AI services status */}
      <div className={`rounded-3xl p-6 backdrop-blur-xl ring-1 ${cardBg}`}>
        <div className={`mb-4 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${subText}`}>
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
          AI Services · Live
        </div>
        <div className="space-y-2.5">
          {AI_SERVICES.map((s) => (
            <div key={s.name} className="flex items-center justify-between">
              <span className={`text-sm ${bodyText}`}>{s.name}</span>
              <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${isDark ? 'bg-emerald-400/15 text-emerald-300' : 'bg-emerald-100 text-emerald-700'}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${s.color} animate-pulse`} />
                Online
              </span>
            </div>
          ))}
        </div>
      </div>

      {/* VIT Health Centre */}
      <div className={`rounded-3xl p-6 backdrop-blur-xl ring-1 ${cardBg}`}>
        <div className={`mb-4 text-[10px] font-bold uppercase tracking-widest ${subText}`}>VIT Health Centre</div>
        <div className="space-y-3">
          {VIT_CONTACTS.map((r) => (
            <div key={r.label}>
              <div className={`text-[10px] uppercase tracking-wide ${subText}`}>{r.label}</div>
              <div className={`text-sm font-medium leading-snug ${isDark ? 'text-white/90' : 'text-slate-800'}`}>{r.value}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Emergency */}
      <div className={`rounded-3xl p-6 backdrop-blur-xl ring-1 ${isDark ? 'bg-red-500/10 ring-red-400/20' : 'bg-red-50 ring-red-200'}`}>
        <div className="flex items-center gap-2 mb-2">
          <span className="text-xl">🚨</span>
          <div className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-red-300' : 'text-red-600'}`}>Emergency</div>
        </div>
        <div className={`text-4xl font-bold tabular-nums ${isDark ? 'text-red-300' : 'text-red-600'}`}>112</div>
        <div className={`mt-1 text-xs ${isDark ? 'text-red-300/60' : 'text-red-400'}`}>National emergency · 24/7</div>
      </div>

      {/* Optional extra panel passed as prop */}
      {extraPanel}
    </aside>
  );
}
