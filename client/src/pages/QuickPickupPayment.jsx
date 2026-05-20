import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { QRCodeSVG } from 'qrcode.react';
import MedicalBackground from '../components/MedicalBackground.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import LanguageSelector from '../components/LanguageSelector.jsx';
import Logo from '../components/Logo.jsx';
import AccountBox from '../components/AccountBox.jsx';
import LeftSidebar from '../components/LeftSidebar.jsx';
import RightSidebar from '../components/RightSidebar.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { apiFetch, getToken } from '../lib/api.js';

export default function QuickPickupPayment() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const { sessionId } = useParams();

  const [session, setSession] = useState(null);
  const [intent, setIntent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) {
      navigate(`/login?next=/quick/payment/${sessionId}`);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const s = await apiFetch(`/api/machine/session/${sessionId}`);
        if (cancelled) return;
        setSession(s.data);
        const it = await apiFetch(
          `/api/machine/session/${sessionId}/payment/intent`,
          { method: 'POST', body: { method: 'upi' } }
        );
        if (cancelled) return;
        setIntent(it.data);
      } catch (e) {
        if (!cancelled) setError(e.message);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [sessionId, navigate]);

  const handleConfirm = async () => {
    if (!intent) return;
    setConfirming(true);
    setError('');
    try {
      await apiFetch(`/api/machine/session/${sessionId}/payment/confirm`, {
        method: 'POST',
        body: { transactionId: intent.transactionId },
      });
      navigate(`/quick/dispensing/${sessionId}`);
    } catch (e) {
      setError(e.message);
      setConfirming(false);
    }
  };

  const handleCancel = async () => {
    if (!window.confirm(t('quickPay.cancelConfirm'))) return;
    try {
      await apiFetch(`/api/machine/session/${sessionId}/cancel`, {
        method: 'POST',
        body: { reason: 'user cancelled at payment' },
      });
    } catch (_) {
      /* ignore */
    }
    navigate('/');
  };

  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const subText = isDark ? 'text-white/70' : 'text-slate-600';
  const cardBg = isDark
    ? 'bg-white/5 ring-white/10'
    : 'bg-white/80 ring-slate-200';

  const cart = session?.cart || [];
  const total = session?.payment?.amount ?? 0;

  return (
    <div className="relative min-h-screen overflow-hidden">
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
                  {t('quickPay.title')}
                </div>
                <div className={`text-[11px] ${subText}`}>
                  {t('quickPay.subtitle')}
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

        <main className="flex-1 px-8 pb-10 md:px-14">
          <div className="grid gap-8 lg:grid-cols-[260px_1fr_260px] items-start">
            <LeftSidebar tipLabel="Payment Tips" />
            <div>
            {loading && (
              <div className={`text-center text-sm ${subText}`}>
                {t('quickPay.loading')}
              </div>
            )}

            {error && !loading && (
              <div
                className={`mx-auto max-w-md rounded-xl px-4 py-3 text-sm ring-1 ${
                  isDark
                    ? 'bg-red-500/15 text-red-100 ring-red-400/30'
                    : 'bg-red-50 text-red-700 ring-red-200'
                }`}
              >
                {error}
              </div>
            )}

            {!loading && !error && session && intent && (
              <div className="grid gap-6 md:grid-cols-5">
                {/* QR card */}
                <div
                  className={`md:col-span-3 rounded-3xl p-8 backdrop-blur-xl ring-1 ${cardBg}`}
                >
                  <div className="flex flex-col items-center text-center">
                    <div className={`text-xs uppercase tracking-widest ${subText}`}>
                      {t('quickPay.amountLabel')}
                    </div>
                    <div className={`mt-1 text-5xl font-bold ${textColor}`}>
                      ₹{intent.amount}
                    </div>

                    <div className="mt-6 rounded-2xl bg-white p-5 ring-1 ring-slate-200">
                      <QRCodeSVG
                        value={intent.qrPayload}
                        size={240}
                        level="M"
                        includeMargin={false}
                      />
                    </div>

                    <div className={`mt-4 text-xs ${subText}`}>
                      {t('quickPay.qrCaption')} · {t('quickPay.expiryLabel')}
                    </div>

                    <button
                      type="button"
                      disabled={confirming}
                      onClick={handleConfirm}
                      className="mt-8 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-emerald-500 to-teal-600 px-10 py-4 text-lg font-semibold text-white shadow-xl shadow-emerald-500/30 transition-transform hover:scale-[1.03] active:scale-[0.98] disabled:opacity-60"
                    >
                      {confirming ? (
                        <>
                          <Spinner />
                          {t('quickPay.confirming')}
                        </>
                      ) : (
                        <>
                          {t('quickPay.iHavePaid')}
                          <svg
                            className="h-5 w-5"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          >
                            <path d="M5 13l4 4L19 7" />
                          </svg>
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      onClick={handleCancel}
                      className={`mt-4 text-xs underline-offset-4 hover:underline ${subText}`}
                    >
                      {t('quickPay.cancelLabel')}
                    </button>
                  </div>
                </div>

                {/* Summary */}
                <div
                  className={`md:col-span-2 rounded-3xl p-6 backdrop-blur-xl ring-1 ${cardBg}`}
                >
                  <div className={`text-xs uppercase tracking-widest ${subText}`}>
                    {t('quickPay.summaryTitle')}
                  </div>
                  <div className="mt-4 space-y-3">
                    {cart.map((item, idx) => (
                      <div
                        key={idx}
                        className={`flex items-center justify-between rounded-xl px-3 py-2 ${
                          isDark ? 'bg-white/5' : 'bg-white/60'
                        }`}
                      >
                        <div>
                          <div className={`text-sm font-medium ${textColor}`}>
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
                    className={`mt-5 flex items-center justify-between border-t pt-4 ${
                      isDark ? 'border-white/10' : 'border-slate-200'
                    }`}
                  >
                    <div className={`text-sm ${subText}`}>
                      {t('quickPay.totalLabel')}
                    </div>
                    <div className={`text-xl font-bold ${textColor}`}>
                      ₹{total}
                    </div>
                  </div>

                  <div
                    className={`mt-5 rounded-xl p-3 text-xs leading-relaxed ring-1 ${
                      isDark
                        ? 'bg-amber-400/5 text-amber-200/80 ring-amber-300/15'
                        : 'bg-amber-50 text-amber-800 ring-amber-200'
                    }`}
                  >
                    {t('quickPay.audit')}
                  </div>
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

function Spinner() {
  return (
    <svg
      className="h-5 w-5 animate-spin"
      viewBox="0 0 24 24"
      fill="none"
    >
      <circle cx="12" cy="12" r="10" stroke="currentColor" strokeOpacity="0.3" strokeWidth="3" />
      <path
        d="M22 12a10 10 0 00-10-10"
        stroke="currentColor"
        strokeWidth="3"
        strokeLinecap="round"
      />
    </svg>
  );
}
