import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import MedicalBackground from '../components/MedicalBackground.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import LanguageSelector from '../components/LanguageSelector.jsx';
import Logo from '../components/Logo.jsx';
import AccountBox from '../components/AccountBox.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { apiFetch } from '../lib/api.js';

const HEALTH_TIPS = [
  'Drink at least 8 glasses of water daily to stay hydrated.',
  'Wash hands for 20 seconds before meals and after using the restroom.',
  'Sleep 7–9 hours per night to support immune function.',
  'Take a 5-minute walk every hour to reduce sedentary risk.',
  'Check your SpO₂ if you feel short of breath — normal is 95–100%.',
  'A resting heart rate of 60–100 bpm is healthy for most adults.',
];

const VITALS_REF = [
  { label: 'Heart Rate',   range: '60–100 bpm',   icon: '❤️' },
  { label: 'Temperature',  range: '97–99.5 °F',   icon: '🌡️' },
  { label: 'SpO₂',        range: '95–100 %',      icon: '💧' },
  { label: 'Respiration',  range: '12–20 rpm',     icon: '🫁' },
];

function LiveClock({ textColor, subText }) {
  const [now, setNow] = useState(new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);
  return (
    <div className="text-center">
      <div className={`text-4xl font-bold tabular-nums ${textColor}`}>
        {now.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', second: '2-digit', timeZone: 'Asia/Kolkata' })}
      </div>
      <div className={`mt-0.5 text-xs font-semibold tracking-widest ${subText}`}>IST</div>
      <div className={`mt-1 text-sm ${subText}`}>
        {now.toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' })}
      </div>
    </div>
  );
}

const AI_SERVICES = [
  { key: 'orchestrator', name: 'Orchestrator' },
  { key: 'risk',         name: 'Risk Classifier' },
  { key: 'trend',        name: 'Trend Analyzer' },
  { key: 'forecast',     name: 'Demand Forecast' },
];

function statusTone(status, isDark) {
  if (status === 'ok' || status === 'healthy') {
    return isDark ? 'bg-emerald-400/15 text-emerald-300' : 'bg-emerald-100 text-emerald-700';
  }
  if (status === 'unreachable' || status === 'error') {
    return isDark ? 'bg-red-400/15 text-red-300' : 'bg-red-100 text-red-700';
  }
  return isDark ? 'bg-slate-400/15 text-slate-300' : 'bg-slate-200 text-slate-600';
}

function statusDot(status) {
  if (status === 'ok' || status === 'healthy') return 'bg-emerald-400 animate-pulse';
  if (status === 'unreachable' || status === 'error') return 'bg-red-400';
  return 'bg-slate-400 animate-pulse';
}

function statusLabel(status) {
  if (status === 'ok' || status === 'healthy') return 'Online';
  if (status === 'unreachable') return 'Offline';
  if (status === 'error') return 'Error';
  return 'Checking…';
}

function AiServicesPanel({ isDark, cardBg, subText }) {
  const [statuses, setStatuses] = useState({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await apiFetch('/api/health/ai');
        if (!mounted) return;
        if (res?.success && res.data) {
          const next = {};
          for (const key of Object.keys(res.data)) {
            next[key] = res.data[key]?.status || 'unknown';
          }
          setStatuses(next);
        } else {
          setStatuses({ orchestrator: 'unreachable', risk: 'unreachable', trend: 'unreachable', forecast: 'unreachable' });
        }
      } catch {
        if (mounted) {
          setStatuses({ orchestrator: 'unreachable', risk: 'unreachable', trend: 'unreachable', forecast: 'unreachable' });
        }
      } finally {
        if (mounted) setLoaded(true);
      }
    };
    load();
    const id = setInterval(load, 30000);
    return () => { mounted = false; clearInterval(id); };
  }, []);

  return (
    <div className={`rounded-3xl p-6 backdrop-blur-xl ring-1 ${cardBg}`}>
      <div className={`mb-4 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest ${subText}`}>
        <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-400" />
        AI Services
      </div>
      <div className="space-y-2.5">
        {AI_SERVICES.map((s) => {
          const status = loaded ? (statuses[s.key] || 'unknown') : 'loading';
          return (
            <div key={s.key} className="flex items-center justify-between">
              <span className={`text-sm ${isDark ? 'text-white/80' : 'text-slate-700'}`}>{s.name}</span>
              <span className={`flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[11px] font-semibold ${statusTone(status, isDark)}`}>
                <span className={`h-1.5 w-1.5 rounded-full ${statusDot(status)}`} />
                {statusLabel(status)}
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function OutbreakBanner({ isDark }) {
  const [alerts, setAlerts] = useState([]);
  const [dismissed, setDismissed] = useState(() => {
    try { return JSON.parse(sessionStorage.getItem('outbreakDismissed') || '[]'); }
    catch { return []; }
  });

  useEffect(() => {
    let mounted = true;
    const load = async () => {
      try {
        const res = await apiFetch('/api/health/outbreak-alerts');
        if (!mounted || !res?.success) return;
        const trends = res.data?.trends || [];
        // Show only diseases with at least 5 cases this week AND >= 2x last week.
        const elevated = trends.filter(
          (t) => t.current >= 5 && t.current >= 2 * Math.max(t.previous, 1)
        );
        setAlerts(elevated);
      } catch {
        // silent — banner just stays empty
      }
    };
    load();
    return () => { mounted = false; };
  }, []);

  const visibleAlerts = alerts.filter((a) => !dismissed.includes(a.disease));
  if (visibleAlerts.length === 0) return null;

  const dismiss = (disease) => {
    const next = [...dismissed, disease];
    setDismissed(next);
    try { sessionStorage.setItem('outbreakDismissed', JSON.stringify(next)); } catch {}
  };

  return (
    <div className={`mb-6 rounded-2xl px-5 py-4 ring-1 backdrop-blur-xl ${
      isDark ? 'bg-amber-500/15 ring-amber-400/30' : 'bg-amber-50 ring-amber-200'
    }`}>
      <div className="flex items-start gap-3">
        <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl ${
          isDark ? 'bg-amber-500/30 text-amber-200' : 'bg-amber-500 text-white'
        }`}>
          <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 9v2m0 4h.01" />
            <path d="M10.3 3.5L2.3 17a2 2 0 001.7 3h16a2 2 0 001.7-3l-8-13.5a2 2 0 00-3.4 0z" />
          </svg>
        </div>
        <div className="min-w-0 flex-1">
          <div className={`text-xs font-bold uppercase tracking-widest ${isDark ? 'text-amber-300' : 'text-amber-800'}`}>
            Campus health watch
          </div>
          <ul className="mt-1.5 space-y-1.5">
            {visibleAlerts.map((a) => {
              const change = a.previous > 0
                ? `${a.current} cases this week (vs ${a.previous} last week)`
                : `${a.current} new cases this week`;
              return (
                <li key={a.disease} className="flex items-start justify-between gap-3">
                  <div className={`text-sm ${isDark ? 'text-white/90' : 'text-slate-800'}`}>
                    <span className="font-semibold capitalize">{a.disease.replace(/_/g, ' ')}</span>{' '}
                    <span className={isDark ? 'text-white/60' : 'text-slate-600'}>— {change}. Wash hands, stay hydrated, and visit the health centre if symptoms appear.</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => dismiss(a.disease)}
                    title="Dismiss"
                    className={`shrink-0 rounded-lg p-1 ${isDark ? 'text-white/50 hover:bg-white/10 hover:text-white' : 'text-slate-400 hover:bg-slate-100 hover:text-slate-700'}`}
                  >
                    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M18 6L6 18M6 6l12 12" />
                    </svg>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </div>
  );
}

function RotatingTip({ isDark }) {
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    const id = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => (i + 1) % HEALTH_TIPS.length);
        setVisible(true);
      }, 400);
    }, 5000);
    return () => clearInterval(id);
  }, []);
  return (
    <p
      className={`text-sm leading-relaxed transition-opacity duration-400 ${
        visible ? 'opacity-100' : 'opacity-0'
      } ${isDark ? 'text-white/80' : 'text-slate-700'}`}
    >
      {HEALTH_TIPS[idx]}
    </p>
  );
}

export default function Welcome() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const subText   = isDark ? 'text-white/60' : 'text-slate-500';
  const cardBg    = isDark ? 'bg-white/6 ring-white/10' : 'bg-white/80 ring-slate-200';

  const features = [
    { key: 'private', icon: PrivateIcon },
    { key: 'fast',    icon: FastIcon    },
    { key: 'safe',    icon: SafeIcon    },
  ];

  return (
    <div className="relative min-h-screen overflow-hidden">
      <MedicalBackground />

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-8 py-5 md:px-14">
          <div className="flex items-center gap-4">
            <Logo size={56} />
            <div className={`font-semibold tracking-tight ${textColor}`}>
              <div className="text-2xl leading-tight">Campus Health</div>
              <div className={`text-sm ${subText}`}>AI-Powered Medical Kiosk</div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <div className="flex items-center gap-3">
              <LanguageSelector compact />
              <ThemeToggle />
            </div>
            <AccountBox />
          </div>
        </header>

        <main className="flex-1 px-8 pb-10 md:px-14">
          <OutbreakBanner isDark={isDark} />
          <div className="grid gap-8 lg:grid-cols-[280px_1fr_280px] xl:grid-cols-[320px_1fr_320px]">

            {/* ── LEFT PANEL ── */}
            <aside className="hidden lg:flex flex-col gap-6">
              {/* Live clock */}
              <div className={`rounded-3xl p-6 backdrop-blur-xl ring-1 ${cardBg}`}>
                <div className={`mb-3 text-xs font-semibold uppercase tracking-widest ${subText}`}>Live Time</div>
                <LiveClock textColor={textColor} subText={subText} />
              </div>

              {/* Vitals reference */}
              <div className={`rounded-3xl p-6 backdrop-blur-xl ring-1 ${cardBg}`}>
                <div className={`mb-4 text-xs font-semibold uppercase tracking-widest ${subText}`}>Normal Ranges</div>
                <div className="space-y-3">
                  {VITALS_REF.map((v) => (
                    <div key={v.label} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="text-lg">{v.icon}</span>
                        <span className={`text-sm ${isDark ? 'text-white/80' : 'text-slate-700'}`}>{v.label}</span>
                      </div>
                      <span className={`text-xs font-mono font-semibold ${isDark ? 'text-emerald-300' : 'text-emerald-700'}`}>
                        {v.range}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Health tip */}
              <div className={`rounded-3xl p-6 backdrop-blur-xl ring-1 ${cardBg}`}>
                <div className={`mb-3 flex items-center gap-2 text-xs font-semibold uppercase tracking-widest ${subText}`}>
                  <span className="animate-pulse h-1.5 w-1.5 rounded-full bg-emerald-400" />
                  Health Tip
                </div>
                <RotatingTip isDark={isDark} />
              </div>
            </aside>

            {/* ── CENTER: Hero ── */}
            <div className="flex flex-col items-center justify-center py-6 text-center">
              <div className={`inline-flex items-center gap-2 rounded-full px-5 py-2 text-sm font-medium ring-1 backdrop-blur ${
                isDark ? 'bg-emerald-400/10 text-emerald-300 ring-emerald-300/20' : 'bg-emerald-100 text-emerald-700 ring-emerald-200'
              }`}>
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                {t('welcome.tagline')}
              </div>

              <h1 className={`mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-3 text-5xl font-bold tracking-tight md:text-7xl ${textColor}`}>
                <span>Campus</span>
                <svg viewBox="0 0 24 24" className="h-12 w-12 text-red-500 drop-shadow-[0_0_14px_rgba(239,68,68,0.6)] animate-heart-spin md:h-16 md:w-16" fill="currentColor" aria-hidden="true">
                  <path d="M12 21s-7-4.5-9.5-9A5.5 5.5 0 0112 6a5.5 5.5 0 019.5 6C19 16.5 12 21 12 21z" />
                </svg>
                <span className="bg-gradient-to-r from-brand-400 to-emerald-400 bg-clip-text text-transparent">Health</span>
              </h1>

              <p className={`mt-5 max-w-xl text-lg md:text-xl ${subText}`}>
                {t('welcome.subtitle')}
              </p>

              {/* Language picker */}
              <div className="mt-8 flex flex-col items-center gap-3">
                <div className={`text-xs uppercase tracking-widest ${subText}`}>{t('welcome.chooseLanguage')}</div>
                <LanguageSelector />
              </div>

              {/* CTA buttons */}
              <div className="mt-10 flex flex-col items-center gap-5 md:flex-row md:gap-8">
                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => navigate('/kiosk')}
                    className="group inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-brand-500 to-brand-700 px-14 py-6 text-2xl font-bold text-white shadow-2xl shadow-brand-500/40 ring-2 ring-white/20 transition-transform hover:scale-[1.04] active:scale-[0.98]"
                  >
                    {t('welcome.begin')}
                    <svg className="h-7 w-7 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </button>
                  <div className={`mt-3 text-sm ${subText}`}>{t('welcome.beginDesc')}</div>
                </div>

                <div className="flex flex-col items-center">
                  <button
                    type="button"
                    onClick={() => navigate('/quick')}
                    className="group inline-flex items-center gap-3 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-10 py-4.5 text-lg font-semibold text-white shadow-xl shadow-emerald-500/30 ring-1 ring-white/15 transition-transform hover:scale-[1.04] active:scale-[0.98]"
                  >
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 3h2l2 12a2 2 0 002 2h9a2 2 0 002-1.6L21 7H6" />
                      <circle cx="9" cy="20" r="1.5" />
                      <circle cx="17" cy="20" r="1.5" />
                    </svg>
                    {t('welcome.quickPickup')}
                  </button>
                  <div className={`mt-3 text-sm ${subText}`}>{t('welcome.quickPickupDesc')}</div>
                </div>
              </div>

              <button type="button" onClick={() => navigate('/login')} className={`mt-8 text-base underline-offset-4 hover:underline ${subText}`}>
                {t('welcome.admin_login')} →
              </button>

              {/* Feature cards */}
              <div className="mt-12 grid w-full grid-cols-1 gap-4 md:grid-cols-3">
                {features.map(({ key, icon: Icon }) => (
                  <div key={key} className={`rounded-2xl p-6 backdrop-blur-xl ring-1 ${cardBg}`}>
                    <div className={`mb-3 inline-flex h-12 w-12 items-center justify-center rounded-xl ${isDark ? 'bg-brand-500/20 text-brand-300' : 'bg-brand-100 text-brand-700'}`}>
                      <Icon />
                    </div>
                    <div className={`text-base font-semibold ${textColor}`}>{t(`welcome.features.${key}`)}</div>
                    <div className={`mt-1.5 text-sm ${subText}`}>{t(`welcome.features.${key}Desc`)}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* ── RIGHT PANEL ── */}
            <aside className="hidden lg:flex flex-col gap-6">
              {/* AI services live status */}
              <AiServicesPanel isDark={isDark} cardBg={cardBg} subText={subText} />

              {/* VIT Health Centre */}
              <div className={`rounded-3xl p-6 backdrop-blur-xl ring-1 ${cardBg}`}>
                <div className={`mb-1 text-xs font-semibold uppercase tracking-widest ${subText}`}>VIT Health Centre</div>
                <div className={`mb-4 text-[11px] ${isDark ? 'text-emerald-300/80' : 'text-emerald-700'}`}>
                  Open 24 hours · 7 days a week
                </div>
                <div className="space-y-3">
                  {[
                    { label: 'Location',     value: '1st Floor, Dr. A.L. Mudaliar Block (beside G.D. Naidu Block)' },
                    { label: 'Address',      value: 'VIT Vellore Campus, Tiruvalam Rd, Katpadi, Vellore, TN 632014' },
                    { label: 'Affiliation',  value: 'Sri Narayani Hospital & Research Centre' },
                    { label: 'Intercom',     value: '2000 / 2238 / 2217' },
                  ].map((r) => (
                    <div key={r.label}>
                      <div className={`text-[10px] uppercase tracking-wide ${subText}`}>{r.label}</div>
                      <div className={`text-sm font-medium leading-snug ${isDark ? 'text-white/90' : 'text-slate-800'}`}>{r.value}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* Emergency */}
              <div className={`rounded-3xl p-6 backdrop-blur-xl ring-1 ${
                isDark ? 'bg-red-500/10 ring-red-400/20' : 'bg-red-50 ring-red-200'
              }`}>
                <div className="flex items-center gap-2">
                  <span className="text-2xl">🚨</span>
                  <div className={`text-sm font-semibold ${isDark ? 'text-red-300' : 'text-red-700'}`}>Emergency</div>
                </div>
                <div className={`mt-2 text-3xl font-bold tabular-nums ${isDark ? 'text-red-300' : 'text-red-600'}`}>112</div>
                <div className={`mt-1 text-xs ${isDark ? 'text-red-300/70' : 'text-red-500'}`}>National emergency · available 24/7</div>
              </div>
            </aside>
          </div>
        </main>

        <footer className={`px-8 pb-6 text-center text-xs ${subText} md:px-14`}>
          {t('welcome.disclaimer')}
        </footer>
      </div>
    </div>
  );
}

function PrivateIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="5" y="11" width="14" height="10" rx="2" />
      <path d="M8 11V7a4 4 0 018 0v4" />
    </svg>
  );
}
function FastIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M13 2L3 14h7l-1 8 10-12h-7l1-8z" />
    </svg>
  );
}
function SafeIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2l8 4v6c0 5-3.5 9.5-8 10-4.5-.5-8-5-8-10V6l8-4z" />
      <path d="M9 12l2 2 4-4" />
    </svg>
  );
}
