import { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext.jsx';

const TIPS = [
  'Drink 8+ glasses of water daily to stay hydrated.',
  'Wash hands 20 seconds before meals and after restroom.',
  'Sleep 7–9 hours to support immune function.',
  'A 5-min walk every hour reduces sedentary risk.',
  'Normal SpO₂ is 95–100%. Feel breathless? Check it.',
  'Resting heart rate 60–100 bpm is healthy for adults.',
  'Temperature above 100.4°F (38°C) indicates fever.',
  'Stay away from crowded areas when feeling unwell.',
];

const VITALS = [
  { label: 'Heart Rate',  range: '60–100',  unit: 'bpm', icon: '❤️',  okColor: 'text-rose-400' },
  { label: 'Temperature', range: '97–99.5', unit: '°F',  icon: '🌡️', okColor: 'text-orange-400' },
  { label: 'SpO₂',       range: '95–100',  unit: '%',   icon: '💧',  okColor: 'text-sky-400' },
  { label: 'Respiration', range: '12–20',   unit: 'rpm', icon: '🫁',  okColor: 'text-emerald-400' },
];

function LiveClock({ isDark }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  const subText = isDark ? 'text-white/50' : 'text-slate-400';
  const textColor = isDark ? 'text-white' : 'text-slate-900';

  return (
    <div className="text-center">
      <div className={`text-3xl font-bold tabular-nums tracking-tight ${textColor}`}>
        {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Kolkata' })}
      </div>
      <div className={`mt-0.5 text-[10px] font-bold uppercase tracking-widest ${subText}`}>IST</div>
      <div className={`mt-1 text-xs ${subText}`}>
        {now.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata' })}
      </div>
    </div>
  );
}

function RotatingTip({ isDark }) {
  const [idx, setIdx] = useState(Math.floor(Math.random() * TIPS.length));
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % TIPS.length);
        setVisible(true);
      }, 350);
    }, 5500);
    return () => clearInterval(id);
  }, []);

  return (
    <p className={`text-sm leading-relaxed transition-opacity duration-300 ${visible ? 'opacity-100' : 'opacity-0'} ${isDark ? 'text-white/75' : 'text-slate-600'}`}>
      {TIPS[idx]}
    </p>
  );
}

export default function LeftSidebar({ tipLabel = 'Health Tip' }) {
  const { isDark } = useTheme();
  const cardBg = isDark ? 'bg-white/6 ring-white/10' : 'bg-white/80 ring-slate-200';
  const subText = isDark ? 'text-white/45' : 'text-slate-400';

  return (
    <aside className="hidden lg:flex flex-col gap-5">
      {/* Clock */}
      <div className={`rounded-3xl p-6 backdrop-blur-xl ring-1 ${cardBg}`}>
        <div className={`mb-3 text-[10px] font-bold uppercase tracking-widest ${subText}`}>Live Time · VIT Vellore</div>
        <LiveClock isDark={isDark} />
      </div>

      {/* Vitals reference */}
      <div className={`rounded-3xl p-6 backdrop-blur-xl ring-1 ${cardBg}`}>
        <div className={`mb-4 text-[10px] font-bold uppercase tracking-widest ${subText}`}>Normal Ranges</div>
        <div className="space-y-3.5">
          {VITALS.map((v) => (
            <div key={v.label} className="flex items-center gap-3">
              <span className="text-xl w-7 text-center">{v.icon}</span>
              <div className="flex-1 min-w-0">
                <div className={`text-xs ${isDark ? 'text-white/60' : 'text-slate-500'}`}>{v.label}</div>
                <div className={`text-sm font-semibold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                  {v.range} <span className="text-xs font-normal opacity-70">{v.unit}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Tip */}
      <div className={`rounded-3xl p-6 backdrop-blur-xl ring-1 ${cardBg}`}>
        <div className={`mb-3 flex items-center gap-2 text-[10px] font-bold uppercase tracking-widest ${subText}`}>
          <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
          {tipLabel}
        </div>
        <RotatingTip isDark={isDark} />
      </div>
    </aside>
  );
}
