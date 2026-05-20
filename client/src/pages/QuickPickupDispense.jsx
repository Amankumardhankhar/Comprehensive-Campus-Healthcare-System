import { useEffect, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import MedicalBackground from '../components/MedicalBackground.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import LanguageSelector from '../components/LanguageSelector.jsx';
import Logo from '../components/Logo.jsx';
import AccountBox from '../components/AccountBox.jsx';
import MedicineArt from '../components/MedicineArt.jsx';
import LeftSidebar from '../components/LeftSidebar.jsx';
import RightSidebar from '../components/RightSidebar.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { apiFetch, getToken } from '../lib/api.js';

const MIN_ANIMATION_MS = 1800;

export default function QuickPickupDispense() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { sessionId } = useParams();

  const [phase, setPhase] = useState('dispensing');
  const [session, setSession] = useState(null);
  const [error, setError] = useState('');
  const dispatchedRef = useRef(false);

  const run = async () => {
    if (!getToken()) {
      navigate(`/login?next=/quick/dispensing/${sessionId}`);
      return;
    }
    setPhase('dispensing');
    setError('');
    const started = Date.now();
    try {
      const res = await apiFetch(
        `/api/machine/session/${sessionId}/dispense`,
        { method: 'POST' }
      );
      const elapsed = Date.now() - started;
      const wait = Math.max(0, MIN_ANIMATION_MS - elapsed);
      setTimeout(() => {
        setSession(res.data);
        setPhase('done');
      }, wait);
    } catch (e) {
      setError(e.message);
      setPhase('error');
    }
  };

  useEffect(() => {
    if (dispatchedRef.current) return;
    dispatchedRef.current = true;
    run();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const subText = isDark ? 'text-white/70' : 'text-slate-600';
  const cardBg = isDark
    ? 'bg-white/5 ring-white/10'
    : 'bg-white/80 ring-slate-200';

  return (
    <div className="relative min-h-screen overflow-hidden">
      <MedicalBackground />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-6 py-5 md:px-10">
          <div className={`flex items-center gap-3 ${textColor}`}>
            <Logo size={40} />
            <div>
              <div className="text-base font-semibold leading-tight">
                {t('welcome.quickPickup')}
              </div>
              <div className={`text-xs ${subText}`}>
                {phase === 'done'
                  ? t('quickDone.title')
                  : t('quickDone.dispensing')}
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
          <div className="grid gap-8 lg:grid-cols-[260px_1fr_260px] items-start">
            <LeftSidebar tipLabel="Wellness Tip" />
            <div>
            {phase === 'dispensing' && (
              <div
                className={`mx-auto rounded-3xl p-10 text-center backdrop-blur-xl ring-1 ${cardBg}`}
              >
                <VendingMachine isDark={isDark} />
                <div className={`mt-8 text-2xl font-bold ${textColor}`}>
                  {t('quickDone.dispensing')}
                </div>
                <div className={`mt-2 text-sm ${subText}`}>
                  {t('quickDone.dispensingSub')}
                </div>
              </div>
            )}

            {phase === 'error' && (
              <div
                className={`mx-auto rounded-3xl p-8 text-center backdrop-blur-xl ring-1 ${cardBg}`}
              >
                <div
                  className={`mx-auto inline-flex h-16 w-16 items-center justify-center rounded-full ${
                    isDark
                      ? 'bg-red-500/20 text-red-200'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  <svg
                    className="h-8 w-8"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M12 9v4M12 17h.01" />
                    <circle cx="12" cy="12" r="10" />
                  </svg>
                </div>
                <div className={`mt-4 text-xl font-semibold ${textColor}`}>
                  {t('quickDone.error')}
                </div>
                <div className={`mt-1 text-sm ${subText}`}>{error}</div>
                <div className="mt-6 flex justify-center gap-3">
                  <button
                    type="button"
                    onClick={run}
                    className="rounded-full bg-gradient-to-r from-brand-500 to-brand-700 px-6 py-2.5 text-sm font-semibold text-white shadow-md shadow-brand-500/30"
                  >
                    {t('quickDone.retry')}
                  </button>
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className={`rounded-full px-6 py-2.5 text-sm font-semibold ring-1 ${
                      isDark
                        ? 'bg-white/10 text-white ring-white/20'
                        : 'bg-white/80 text-slate-800 ring-slate-200'
                    }`}
                  >
                    {t('common.back')}
                  </button>
                </div>
              </div>
            )}

            {phase === 'done' && session && (
              <div
                className={`mx-auto rounded-3xl p-8 backdrop-blur-xl ring-1 ${cardBg}`}
              >
                <div className="flex flex-col items-center text-center">
                  <div
                    className={`inline-flex h-20 w-20 items-center justify-center rounded-full ${
                      isDark
                        ? 'bg-emerald-400/15 text-emerald-300'
                        : 'bg-emerald-100 text-emerald-700'
                    }`}
                  >
                    <svg
                      className="h-10 w-10"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 13l4 4L19 7" />
                    </svg>
                  </div>
                  <div className={`mt-4 text-2xl font-bold ${textColor}`}>
                    {t('quickDone.title')}
                  </div>
                  <div className={`mt-1 text-sm ${subText}`}>
                    {t('quickDone.thankYou')}
                  </div>
                </div>

                <div className="mt-8">
                  <div
                    className={`mb-2 text-xs uppercase tracking-widest ${subText}`}
                  >
                    {t('quickDone.summaryTitle')}
                  </div>
                  <div className="space-y-2">
                    {(session.dispensed || []).map((item, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center gap-3 rounded-xl p-3 ${
                          isDark ? 'bg-white/5' : 'bg-white/70'
                        }`}
                      >
                        <div
                          className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-lg ring-1 ${
                            isDark
                              ? 'bg-white/80 ring-white/20'
                              : 'bg-white ring-slate-200'
                          }`}
                        >
                          <MedicineArt
                            genericName={item.medicine?.genericName || item.genericName}
                            className="h-10 w-10"
                          />
                        </div>
                        <div className="min-w-0 flex-1">
                          <div className={`text-sm font-semibold ${textColor}`}>
                            {item.medicineName}
                          </div>
                          <div className={`text-xs ${subText}`}>
                            × {item.quantity} @ ₹{item.unitPrice}
                          </div>
                        </div>
                        <div className={`text-sm font-semibold ${textColor}`}>
                          ₹{item.quantity * item.unitPrice}
                        </div>
                      </div>
                    ))}
                  </div>

                  <div
                    className={`mt-4 flex items-center justify-between border-t pt-3 ${
                      isDark ? 'border-white/10' : 'border-slate-200'
                    }`}
                  >
                    <div className={`text-sm ${subText}`}>
                      {t('quickDone.totalPaid')}
                    </div>
                    <div className={`text-lg font-bold ${textColor}`}>
                      ₹{session.payment?.amount ?? 0}
                    </div>
                  </div>
                </div>

                <div className="mt-8 flex justify-center">
                  <button
                    type="button"
                    onClick={() => navigate('/')}
                    className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-brand-700 px-10 py-3.5 text-base font-semibold text-white shadow-xl shadow-brand-500/30 transition-transform hover:scale-[1.03] active:scale-[0.98]"
                  >
                    {t('quickDone.backHome')}
                    <svg
                      className="h-5 w-5"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  </button>
                </div>
              </div>
            )}
          </div>
          <RightSidebar />
        </div>
        </main>
      </div>
    </div>
  );
}

function VendingMachine({ isDark }) {
  const body = isDark ? '#1e293b' : '#f1f5f9';
  const trim = isDark ? '#334155' : '#cbd5e1';
  const screen = isDark ? '#0f172a' : '#e2e8f0';
  const slot = isDark ? '#020617' : '#1e293b';
  return (
    <div className="mx-auto w-56">
      <svg viewBox="0 0 200 240" className="w-full">
        <rect x="10" y="10" width="180" height="220" rx="18" fill={body} stroke={trim} strokeWidth="2" />
        <rect x="22" y="22" width="156" height="90" rx="10" fill={screen} stroke={trim} strokeWidth="1.5" />
        {/* Items sliding */}
        <g className="vending-items">
          <circle cx="60" cy="55" r="9" fill="#f97316" />
          <rect x="90" y="46" width="22" height="18" rx="4" fill="#38bdf8" />
          <rect x="130" y="44" width="24" height="20" rx="10" fill="#fbbf24" />
        </g>
        {/* Dispensing slot */}
        <rect x="22" y="124" width="156" height="30" rx="6" fill={slot} />
        <rect x="30" y="132" width="140" height="14" rx="3" fill={isDark ? '#1e293b' : '#334155'} />
        {/* Tray */}
        <rect x="22" y="168" width="156" height="52" rx="10" fill={screen} stroke={trim} strokeWidth="1.5" />
        <g className="vending-drop">
          <rect x="88" y="174" width="24" height="20" rx="10" fill="#22c55e" />
        </g>
      </svg>
      <style>{`
        .vending-items {
          animation: shake 1.4s ease-in-out infinite;
          transform-origin: 100px 60px;
        }
        @keyframes shake {
          0%, 100% { transform: translateY(0); }
          50% { transform: translateY(-4px); }
        }
        .vending-drop {
          animation: drop 1.8s cubic-bezier(.4,0,.2,1) infinite;
        }
        @keyframes drop {
          0% { transform: translateY(-60px); opacity: 0; }
          30% { opacity: 1; }
          70% { transform: translateY(0); opacity: 1; }
          100% { transform: translateY(0); opacity: 0.6; }
        }
      `}</style>
    </div>
  );
}
