import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import MedicalBackground from '../components/MedicalBackground.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import LanguageSelector from '../components/LanguageSelector.jsx';
import Logo from '../components/Logo.jsx';
import AccountBox from '../components/AccountBox.jsx';
import LeftSidebar from '../components/LeftSidebar.jsx';
import RightSidebar from '../components/RightSidebar.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { apiFetch, getToken } from '../lib/api.js';

const STAGES = [
  { key: 'nlp', icon: NlpIcon },
  { key: 'anomaly', icon: AnomalyIcon },
  { key: 'disease', icon: DiseaseIcon },
  { key: 'risk', icon: RiskIcon },
  { key: 'medicine', icon: MedicineIcon },
  { key: 'decision', icon: DecisionIcon },
];

const STAGE_MS = 700;
const MIN_TOTAL_MS = STAGES.length * STAGE_MS; // ~4.9s floor

export default function KioskAnalyzing() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { sessionId } = useParams();

  const [stageIdx, setStageIdx] = useState(0);
  const [phase, setPhase] = useState('running'); // running | error
  const [error, setError] = useState('');
  const dispatched = useRef(false);

  const run = async () => {
    setPhase('running');
    setError('');
    setStageIdx(0);

    const started = performance.now();
    const animate = new Promise((resolve) => {
      const step = (i) => {
        setStageIdx(i);
        if (i >= STAGES.length - 1) {
          setTimeout(resolve, STAGE_MS);
          return;
        }
        setTimeout(() => step(i + 1), STAGE_MS);
      };
      step(0);
    });

    try {
      const [res] = await Promise.all([
        apiFetch(`/api/machine/session/${sessionId}/analyze`, {
          method: 'POST',
          body: {},
        }),
        animate,
      ]);
      const elapsed = performance.now() - started;
      const wait = Math.max(0, MIN_TOTAL_MS - elapsed);
      setTimeout(() => {
        setStageIdx(STAGES.length);
        // Result screen will read the persisted session — no need to pass data.
        navigate(`/kiosk/result/${sessionId}`);
      }, wait);
    } catch (e) {
      setError(e.message);
      setPhase('error');
    }
  };

  useEffect(() => {
    if (!getToken()) {
      navigate(`/login?next=${encodeURIComponent(`/kiosk/analyzing/${sessionId}`)}`);
      return;
    }
    if (dispatched.current) return;
    dispatched.current = true;
    run();
  }, [sessionId]); // eslint-disable-line react-hooks/exhaustive-deps

  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const subText = isDark ? 'text-white/70' : 'text-slate-600';
  const cardBg = isDark ? 'bg-white/5 ring-white/10' : 'bg-white/85 ring-slate-200';

  const progress = Math.min((stageIdx + 1) / STAGES.length, 1);

  return (
    <div className="relative min-h-screen overflow-hidden">
      <MedicalBackground />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-6 py-5 md:px-10">
          <div className={`flex items-center gap-3 ${textColor}`}>
            <Logo size={40} />
            <div>
              <div className="text-base font-semibold leading-tight">
                {t('kioskAnalyzing.title')}
              </div>
              <div className={`text-xs ${subText}`}>
                {phase === 'error' ? t('kioskAnalyzing.failed') : t('kioskAnalyzing.working')}
              </div>
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
          <div className="grid gap-8 lg:grid-cols-[280px_1fr_280px] items-start">
            <LeftSidebar tipLabel="While We Analyze" />
            <div>
            <div className={`rounded-3xl p-8 ring-1 backdrop-blur-xl md:p-12 ${cardBg}`}>
              <div className="text-center">
                <div className="mx-auto inline-flex h-24 w-24 items-center justify-center rounded-full bg-gradient-to-br from-brand-400 to-brand-700 shadow-lg shadow-brand-500/30">
                  <svg
                    className="h-12 w-12 animate-spin text-white"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                  >
                    <path d="M21 12a9 9 0 11-6.2-8.55" />
                  </svg>
                </div>
                <h1 className={`mt-6 text-4xl font-bold md:text-5xl ${textColor}`}>
                  {t('kioskAnalyzing.heading')}
                </h1>
                <p className={`mx-auto mt-3 max-w-xl text-base md:text-lg ${subText}`}>
                  {t('kioskAnalyzing.subheading')}
                </p>
              </div>

              {/* Progress bar */}
              <div className="mt-8">
                <div
                  className={`relative h-1.5 w-full overflow-hidden rounded-full ${
                    isDark ? 'bg-white/10' : 'bg-slate-200'
                  }`}
                >
                  <div
                    className="absolute inset-y-0 left-0 rounded-full bg-gradient-to-r from-brand-400 to-brand-600 transition-[width] duration-500 ease-out"
                    style={{ width: `${progress * 100}%` }}
                  />
                </div>
                <div className={`mt-2 text-right text-[11px] tabular-nums ${subText}`}>
                  {Math.round(progress * 100)}%
                </div>
              </div>

              {/* Stage list */}
              <ul className="mt-6 space-y-2">
                {STAGES.map((s, idx) => {
                  const Icon = s.icon;
                  const state =
                    idx < stageIdx
                      ? 'done'
                      : idx === stageIdx
                      ? 'active'
                      : 'pending';
                  return (
                    <li
                      key={s.key}
                      className={`flex items-center gap-3 rounded-xl px-3 py-2 transition-all ${
                        state === 'active'
                          ? isDark
                            ? 'bg-white/10 ring-1 ring-brand-400/50'
                            : 'bg-white ring-1 ring-brand-400/50 shadow-sm'
                          : state === 'done'
                          ? isDark
                            ? 'bg-white/5'
                            : 'bg-white/70'
                          : 'opacity-50'
                      }`}
                    >
                      <div
                        className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-lg ${
                          state === 'done'
                            ? isDark
                              ? 'bg-emerald-400/15 text-emerald-300'
                              : 'bg-emerald-100 text-emerald-700'
                            : state === 'active'
                            ? isDark
                              ? 'bg-brand-400/20 text-brand-200'
                              : 'bg-brand-100 text-brand-700'
                            : isDark
                            ? 'bg-white/10 text-white/50'
                            : 'bg-slate-100 text-slate-400'
                        }`}
                      >
                        {state === 'done' ? (
                          <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                        ) : (
                          <Icon />
                        )}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className={`text-sm font-medium ${textColor}`}>
                          {t(`kioskAnalyzing.stages.${s.key}.label`)}
                        </div>
                        <div className={`text-[11px] ${subText}`}>
                          {t(`kioskAnalyzing.stages.${s.key}.sub`)}
                        </div>
                      </div>
                      <div className="shrink-0">
                        {state === 'active' && (
                          <svg className="h-4 w-4 animate-spin text-brand-500" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
                            <path d="M21 12a9 9 0 11-6.2-8.55" />
                          </svg>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>

              {phase === 'error' && (
                <div
                  className={`mt-6 rounded-xl px-4 py-3 text-sm ring-1 ${
                    isDark
                      ? 'bg-red-500/15 text-red-100 ring-red-400/30'
                      : 'bg-red-50 text-red-700 ring-red-200'
                  }`}
                >
                  <div className="font-semibold">{t('kioskAnalyzing.errorTitle')}</div>
                  <div className="mt-0.5 text-xs opacity-90">{error}</div>
                  <div className="mt-3 flex gap-2">
                    <button
                      type="button"
                      onClick={() => {
                        dispatched.current = false;
                        run();
                        dispatched.current = true;
                      }}
                      className="rounded-full bg-gradient-to-r from-brand-500 to-brand-700 px-4 py-1.5 text-xs font-semibold text-white"
                    >
                      {t('kioskAnalyzing.retry')}
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/')}
                      className={`rounded-full px-4 py-1.5 text-xs font-medium ring-1 ${
                        isDark
                          ? 'bg-white/10 text-white ring-white/20'
                          : 'bg-white text-slate-700 ring-slate-200'
                      }`}
                    >
                      {t('common.back')}
                    </button>
                  </div>
                </div>
              )}
            </div>

            <p className={`mt-4 text-center text-sm ${subText}`}>
              {t('kioskAnalyzing.privacyNote')}
            </p>
            </div>
            <RightSidebar />
          </div>
        </main>
      </div>
    </div>
  );
}

function NlpIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M4 4h16v12H7l-3 3V4z" />
      <path d="M8 9h8M8 13h5" />
    </svg>
  );
}
function AnomalyIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 12h3l2-7 4 14 2-7h7" />
    </svg>
  );
}
function DiseaseIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 4v2M12 18v2M4 12h2M18 12h2M6.3 6.3l1.4 1.4M16.3 16.3l1.4 1.4M6.3 17.7l1.4-1.4M16.3 7.7l1.4-1.4" />
    </svg>
  );
}
function RiskIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 2L2 20h20L12 2z" />
      <path d="M12 9v5M12 17h.01" />
    </svg>
  );
}
function MedicineIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="9" width="18" height="8" rx="4" />
      <path d="M12 9v8" />
    </svg>
  );
}
function DecisionIcon() {
  return (
    <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 12l2 2 4-4" />
      <circle cx="12" cy="12" r="9" />
    </svg>
  );
}
