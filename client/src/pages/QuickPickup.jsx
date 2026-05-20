import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
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

export default function QuickPickup() {
  const { t, i18n } = useTranslation();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const [catalog, setCatalog] = useState([]);
  const [caps, setCaps] = useState({ maxTotalInr: 200, maxUnitsPerItem: 2 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // null = unanswered, false = no, true = yes (blocks flow)
  const [underAge, setUnderAge] = useState(null);
  const [hasAllergies, setHasAllergies] = useState(null);

  const [qty, setQty] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [openSession, setOpenSession] = useState(null);
  const [cancelling, setCancelling] = useState(false);

  const loadOpenSession = async () => {
    const res = await apiFetch(
      '/api/machine/sessions?status=in_progress&limit=1'
    );
    const s = (res.items || [])[0] || null;
    setOpenSession(s);
    return s;
  };

  useEffect(() => {
    if (!getToken()) {
      navigate(`/login?next=${encodeURIComponent('/quick')}`);
      return;
    }
    (async () => {
      try {
        const [cat] = await Promise.all([
          apiFetch('/api/machine/quick/catalog'),
          loadOpenSession(),
        ]);
        setCatalog(cat.data.items);
        setCaps(cat.data.caps);
      } catch (e) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const handleCancelOpen = async () => {
    if (!openSession) return;
    setCancelling(true);
    setError('');
    try {
      await apiFetch(`/api/machine/session/${openSession.sessionId}/cancel`, {
        method: 'POST',
        body: { reason: 'user started fresh Quick Pickup' },
      });
      await loadOpenSession();
    } catch (e) {
      setError(e.message);
    } finally {
      setCancelling(false);
    }
  };

  const handleResumeOpen = () => {
    if (!openSession) return;
    if (openSession.type === 'quick' && (openSession.cart?.length || 0) > 0) {
      navigate(`/quick/payment/${openSession.sessionId}`);
    }
  };

  const gateAnswered = underAge !== null && hasAllergies !== null;
  const gateBlocked = underAge === true || hasAllergies === true;

  const cart = useMemo(() => {
    return catalog
      .map((m) => ({ ...m, quantity: qty[m.id] || 0 }))
      .filter((m) => m.quantity > 0);
  }, [catalog, qty]);

  const total = cart.reduce((s, m) => s + m.pricePerUnit * m.quantity, 0);
  const overTotal = total > caps.maxTotalInr;
  const canProceed = !gateBlocked && gateAnswered && cart.length > 0 && !overTotal && !openSession;

  const bump = (id, delta, capPerItem) => {
    setQty((prev) => {
      const next = Math.max(0, Math.min(capPerItem, (prev[id] || 0) + delta));
      return { ...prev, [id]: next };
    });
  };

  const handleProceed = async () => {
    if (!canProceed) return;
    setSubmitting(true);
    setError('');
    try {
      const start = await apiFetch('/api/machine/quick/session/start', {
        method: 'POST',
        body: {
          underAge,
          hasAllergies,
          language: i18n.resolvedLanguage || 'en',
        },
      });
      const sessionId = start.data.sessionId;
      await apiFetch(`/api/machine/quick/session/${sessionId}/cart`, {
        method: 'POST',
        body: {
          items: cart.map((m) => ({ medicineId: m.id, quantity: m.quantity })),
        },
      });
      navigate(`/quick/payment/${sessionId}`);
    } catch (e) {
      setError(e.message);
    } finally {
      setSubmitting(false);
    }
  };

  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const subText = isDark ? 'text-white/70' : 'text-slate-600';
  const cardBg = isDark
    ? 'bg-white/5 ring-white/10'
    : 'bg-white/80 ring-slate-200';

  return (
    <div className="relative min-h-screen overflow-hidden pb-28">
      <MedicalBackground />

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Top bar */}
        <header className="flex items-center justify-between px-6 py-5 md:px-10">
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => navigate('/')}
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ring-1 backdrop-blur transition-colors ${
                isDark
                  ? 'bg-white/10 text-white ring-white/15 hover:bg-white/20'
                  : 'bg-white/80 text-slate-800 ring-slate-200 hover:bg-white'
              }`}
              aria-label={t('common.back')}
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5M11 6l-6 6 6 6" />
              </svg>
              {t('common.back')}
            </button>
            <div className={`hidden items-center gap-2 md:flex ${textColor}`}>
              <Logo size={36} />
              <div className="text-left">
                <div className="text-sm font-semibold leading-tight">
                  {t('welcome.quickPickup')}
                </div>
                <div className={`text-[11px] ${subText}`}>
                  {t('welcome.quickPickupDesc')}
                </div>
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

        <main className="flex-1 px-8 md:px-14">
          <div className="grid gap-8 lg:grid-cols-[260px_1fr_260px] items-start">
            <LeftSidebar tipLabel="Health Tip" />
            <div>
            {openSession && (
              <section
                className={`mt-2 rounded-2xl p-5 ring-1 backdrop-blur-xl ${
                  isDark
                    ? 'bg-amber-400/10 text-amber-100 ring-amber-300/20'
                    : 'bg-amber-50 text-amber-900 ring-amber-200'
                }`}
              >
                <div className="flex flex-col items-start gap-3 md:flex-row md:items-center md:justify-between">
                  <div>
                    <div className="text-sm font-semibold">
                      {t('quick.openSession.title')}
                    </div>
                    <div className="mt-0.5 text-xs opacity-80">
                      {openSession.type === 'quick' &&
                      (openSession.cart?.length || 0) > 0
                        ? t('quick.openSession.bodyQuickCart')
                        : openSession.type === 'quick'
                        ? t('quick.openSession.bodyQuickEmpty')
                        : t('quick.openSession.bodyOther')}
                    </div>
                  </div>
                  <div className="flex shrink-0 gap-2">
                    {openSession.type === 'quick' &&
                      (openSession.cart?.length || 0) > 0 && (
                        <button
                          type="button"
                          onClick={handleResumeOpen}
                          className="inline-flex items-center gap-1.5 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-4 py-2 text-xs font-semibold text-white shadow-md shadow-emerald-500/30"
                        >
                          {t('quick.openSession.resume')}
                          <span aria-hidden>→</span>
                        </button>
                      )}
                    <button
                      type="button"
                      disabled={cancelling}
                      onClick={handleCancelOpen}
                      className={`inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-semibold ring-1 transition-colors disabled:opacity-60 ${
                        isDark
                          ? 'bg-white/10 text-white ring-white/20 hover:bg-white/20'
                          : 'bg-white text-amber-900 ring-amber-300 hover:bg-amber-100'
                      }`}
                    >
                      {cancelling
                        ? t('quick.openSession.cancelling')
                        : t('quick.openSession.cancel')}
                    </button>
                  </div>
                </div>
              </section>
            )}

            {/* Gate */}
            <section
              className={`mt-4 rounded-2xl p-6 backdrop-blur-xl ring-1 ${cardBg} ${
                openSession ? 'pointer-events-none opacity-40' : ''
              }`}
            >
              <h2 className={`text-lg font-semibold ${textColor}`}>
                {t('quick.gateTitle')}
              </h2>
              <p className={`mt-1 text-sm ${subText}`}>{t('quick.gateSubtitle')}</p>

              <div className="mt-5 grid gap-4 md:grid-cols-2">
                <GateQuestion
                  label={t('quick.gate.underAge')}
                  value={underAge}
                  setValue={setUnderAge}
                  isDark={isDark}
                />
                <GateQuestion
                  label={t('quick.gate.allergies')}
                  value={hasAllergies}
                  setValue={setHasAllergies}
                  isDark={isDark}
                />
              </div>

              {gateBlocked && (
                <div
                  className={`mt-5 rounded-xl p-4 text-sm ring-1 ${
                    isDark
                      ? 'bg-amber-400/10 text-amber-200 ring-amber-300/20'
                      : 'bg-amber-50 text-amber-800 ring-amber-200'
                  }`}
                >
                  <div className="font-semibold">{t('quick.gateBlockedTitle')}</div>
                  <div className="mt-1">{t('quick.gateBlockedBody')}</div>
                  <button
                    type="button"
                    onClick={() => navigate('/kiosk')}
                    className="mt-3 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-brand-700 px-5 py-2 text-sm font-semibold text-white"
                  >
                    {t('welcome.begin')}
                    <span aria-hidden>→</span>
                  </button>
                </div>
              )}
            </section>

            {/* Picker */}
            {!gateBlocked && (
              <section className={`mt-8 ${openSession ? 'pointer-events-none opacity-40' : ''}`}>
                <div className="mb-3 flex items-baseline justify-between">
                  <h2 className={`text-lg font-semibold ${textColor}`}>
                    {t('quick.pickerTitle')}
                  </h2>
                  <div className={`text-xs ${subText}`}>
                    {t('quick.capsLine', {
                      perItem: caps.maxUnitsPerItem,
                      total: caps.maxTotalInr,
                    })}
                  </div>
                </div>

                {loading && (
                  <div className={`text-sm ${subText}`}>{t('quick.loading')}</div>
                )}

                {!loading && (
                  <div className="grid gap-4 sm:grid-cols-2">
                    {catalog.map((m) => {
                      const q = qty[m.id] || 0;
                      const oos = !m.inStock;
                      const capPerItem = Math.min(
                        m.maxPerSession,
                        caps.maxUnitsPerItem
                      );
                      return (
                        <div
                          key={m.id}
                          className={`rounded-2xl p-5 backdrop-blur-xl ring-1 ${cardBg} ${
                            oos ? 'opacity-60' : ''
                          } ${!gateAnswered ? 'opacity-60' : ''}`}
                        >
                          <div className="flex items-start gap-4">
                            <div
                              className={`flex h-20 w-20 shrink-0 items-center justify-center rounded-xl ring-1 ${
                                isDark
                                  ? 'bg-white/80 ring-white/20'
                                  : 'bg-white ring-slate-200'
                              }`}
                            >
                              <MedicineArt
                                genericName={m.genericName}
                                className="h-16 w-16"
                              />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-2">
                                <div className={`font-semibold leading-tight ${textColor}`}>
                                  {m.name}
                                </div>
                                <div
                                  className={`shrink-0 rounded-full px-2.5 py-0.5 text-[10px] font-medium ${
                                    oos
                                      ? isDark
                                        ? 'bg-red-400/15 text-red-200'
                                        : 'bg-red-100 text-red-700'
                                      : isDark
                                      ? 'bg-emerald-400/15 text-emerald-200'
                                      : 'bg-emerald-100 text-emerald-700'
                                  }`}
                                >
                                  {oos
                                    ? t('quick.outOfStock')
                                    : t('quick.inStock')}
                                </div>
                              </div>
                              <div className={`mt-1 text-xs ${subText}`}>
                                {m.indications?.slice(0, 3).join(' · ')}
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 flex items-center justify-between">
                            <div className={`text-base font-semibold ${textColor}`}>
                              ₹{m.pricePerUnit}
                              <span className={`ml-1 text-xs font-normal ${subText}`}>
                                / {m.unit}
                              </span>
                            </div>

                            <div
                              className={`inline-flex items-center overflow-hidden rounded-full ring-1 ${
                                isDark
                                  ? 'bg-white/5 ring-white/15'
                                  : 'bg-white ring-slate-200'
                              }`}
                            >
                              <button
                                type="button"
                                disabled={oos || !gateAnswered || q === 0}
                                onClick={() => bump(m.id, -1, capPerItem)}
                                className={`h-9 w-9 text-lg font-bold ${textColor} disabled:opacity-30`}
                              >
                                −
                              </button>
                              <div className={`min-w-[2rem] text-center text-sm font-semibold ${textColor}`}>
                                {q}
                              </div>
                              <button
                                type="button"
                                disabled={oos || !gateAnswered || q >= capPerItem}
                                onClick={() => bump(m.id, +1, capPerItem)}
                                className={`h-9 w-9 text-lg font-bold ${textColor} disabled:opacity-30`}
                              >
                                +
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </section>
            )}

            {error && (
              <div
                className={`mt-6 rounded-xl px-4 py-3 text-sm ring-1 ${
                  isDark
                    ? 'bg-red-500/15 text-red-100 ring-red-400/30'
                    : 'bg-red-50 text-red-700 ring-red-200'
                }`}
              >
                {error}
              </div>
            )}
          </div>
          <RightSidebar />
        </div>
        </main>
      </div>

      {/* Sticky bottom bar */}
      {!gateBlocked && (
        <div className="fixed inset-x-0 bottom-0 z-20 border-t backdrop-blur-xl px-6 py-4 md:px-10"
             style={{
               backgroundColor: isDark ? 'rgba(10,14,22,0.7)' : 'rgba(255,255,255,0.8)',
               borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.08)',
             }}>
          <div className="mx-auto flex w-full max-w-5xl items-center justify-between gap-4">
            <div>
              <div className={`text-sm ${subText}`}>
                {t('quick.itemsCount', { count: cart.reduce((s, m) => s + m.quantity, 0) })}
              </div>
              <div className={`text-lg font-bold ${overTotal ? 'text-red-500' : textColor}`}>
                ₹{total}{' '}
                <span className={`text-xs font-normal ${subText}`}>
                  / ₹{caps.maxTotalInr}
                </span>
              </div>
            </div>
            <button
              type="button"
              disabled={!canProceed || submitting}
              onClick={handleProceed}
              className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-8 py-3 text-base font-semibold text-white shadow-xl shadow-emerald-500/30 transition-transform hover:scale-[1.03] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-50 disabled:shadow-none"
            >
              {submitting ? t('quick.submitting') : t('quick.proceed')}
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
  );
}

function GateQuestion({ label, value, setValue, isDark }) {
  const base =
    'flex-1 rounded-full px-4 py-2 text-sm font-medium transition-all';
  const chosen =
    'bg-gradient-to-r from-brand-500 to-brand-700 text-white shadow shadow-brand-500/30';
  const unchosen = isDark
    ? 'bg-white/5 text-white/80 ring-1 ring-white/10 hover:bg-white/10'
    : 'bg-white/80 text-slate-700 ring-1 ring-slate-200 hover:bg-white';

  return (
    <div
      className={`rounded-xl p-4 ring-1 ${
        isDark ? 'bg-white/[0.03] ring-white/10' : 'bg-white/60 ring-slate-200'
      }`}
    >
      <div className={`mb-3 text-sm font-medium ${isDark ? 'text-white' : 'text-slate-800'}`}>
        {label}
      </div>
      <div className="flex gap-2">
        <button
          type="button"
          onClick={() => setValue(false)}
          className={`${base} ${value === false ? chosen : unchosen}`}
        >
          No
        </button>
        <button
          type="button"
          onClick={() => setValue(true)}
          className={`${base} ${value === true ? chosen : unchosen}`}
        >
          Yes
        </button>
      </div>
    </div>
  );
}
