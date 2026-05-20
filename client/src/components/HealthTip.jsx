import { useEffect, useState } from 'react';
import { useTheme } from '../context/ThemeContext.jsx';

const TIPS = [
  { emoji: '💧', title: 'Stay hydrated', text: 'Aim for 2–3 litres of water daily — mild dehydration drops focus and mood.' },
  { emoji: '😴', title: '7–9 hours of sleep', text: 'Consistent sleep cycles improve immunity and memory.' },
  { emoji: '🥗', title: 'Eat the rainbow', text: 'Half your plate should be vegetables and fruits.' },
  { emoji: '🏃', title: 'Move every day', text: '30 minutes of brisk activity lowers anxiety and boosts heart health.' },
  { emoji: '🧘', title: 'Practice mindfulness', text: '5 minutes of breathing exercises reduces stress hormones.' },
  { emoji: '☀️', title: 'Get some sunlight', text: '15 minutes of morning sun helps vitamin D and your sleep cycle.' },
  { emoji: '📴', title: 'Digital detox', text: 'A 1-hour screen-free window before bed improves sleep quality.' },
  { emoji: '🤝', title: 'Stay connected', text: 'Social connection is as vital to health as diet and exercise.' },
  { emoji: '🩺', title: 'Know your numbers', text: 'Annual check-ups catch issues early — prevention beats cure.' },
  { emoji: '🧠', title: 'Feed your brain', text: 'Omega-3s, leafy greens, and berries support cognition.' },
];

export default function HealthTip({ compact = false }) {
  const { isDark } = useTheme();
  const [index, setIndex] = useState(() => Math.floor(Math.random() * TIPS.length));
  const [fade, setFade] = useState(true);

  useEffect(() => {
    const timer = setInterval(() => {
      setFade(false);
      setTimeout(() => {
        setIndex((i) => (i + 1) % TIPS.length);
        setFade(true);
      }, 300);
    }, 7000);
    return () => clearInterval(timer);
  }, []);

  const tip = TIPS[index];
  const pad = compact ? 'p-4' : 'p-5';
  const card = isDark
    ? 'bg-white/10 backdrop-blur-md border-white/20'
    : 'bg-white/70 backdrop-blur-md border-slate-200';
  const title = isDark ? 'text-white' : 'text-slate-900';
  const body = isDark ? 'text-slate-200' : 'text-slate-600';
  const dot = isDark ? 'bg-white/30' : 'bg-slate-300';
  const dotActive = isDark ? 'bg-brand-400' : 'bg-brand-500';

  return (
    <div className={`rounded-xl border ${pad} shadow-lg ${card}`}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-brand-500">
          Health tip
        </span>
        <span className="flex gap-1">
          {TIPS.map((_, i) => (
            <span
              key={i}
              className={`h-1 rounded-full transition-all ${
                i === index ? `${dotActive} w-3` : `${dot} w-1`
              }`}
            />
          ))}
        </span>
      </div>
      <div className={`transition-opacity duration-300 ${fade ? 'opacity-100' : 'opacity-0'}`}>
        <div className="flex items-start gap-2.5">
          <span className="text-xl leading-none">{tip.emoji}</span>
          <div className="min-w-0">
            <h3 className={`font-semibold text-sm mb-0.5 ${title}`}>{tip.title}</h3>
            <p className={`text-xs leading-relaxed ${body}`}>{tip.text}</p>
          </div>
        </div>
      </div>
    </div>
  );
}
