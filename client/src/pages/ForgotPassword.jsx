import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import MedicalBackground from '../components/MedicalBackground.jsx';
import Logo from '../components/Logo.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { apiFetch } from '../lib/api.js';

export default function ForgotPassword() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await apiFetch('/api/auth/forgot-password', { method: 'POST', body: { email } });
      setSent(true);
    } catch (err) {
      const detail = err?.payload?.details?.[0]?.message || err?.payload?.message || err.message;
      setError(detail);
    } finally {
      setLoading(false);
    }
  };

  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const subText = isDark ? 'text-slate-200' : 'text-slate-600';
  const cardBg = isDark
    ? 'bg-white/10 backdrop-blur-xl border-white/20'
    : 'bg-white/80 backdrop-blur-xl border-slate-200';
  const inputStyle = isDark
    ? 'bg-white/10 border-white/20 text-white placeholder-slate-300'
    : 'bg-white/90 border-slate-200 text-slate-800 placeholder-slate-400';
  const linkStyle = isDark ? 'text-brand-300 hover:text-white' : 'text-brand-600 hover:text-brand-700';

  return (
    <div className="relative min-h-screen overflow-hidden">
      <MedicalBackground />
      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-6 py-5 md:px-10">
          <button
            type="button"
            onClick={() => navigate('/login')}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ring-1 backdrop-blur transition-colors ${
              isDark ? 'bg-white/10 text-white ring-white/15 hover:bg-white/20'
                     : 'bg-white/80 text-slate-800 ring-slate-200 hover:bg-white'
            }`}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M11 6l-6 6 6 6" />
            </svg>
            {t('forgotPassword.backToSignIn')}
          </button>
          <ThemeToggle />
        </header>

        <main className="flex-1 flex items-center justify-center px-6 pb-16">
          <div className={`w-full max-w-md rounded-3xl shadow-2xl border p-8 ${cardBg}`}>
            <div className="flex items-center gap-3 mb-6">
              <Logo size={48} />
              <div>
                <h1 className={`text-xl font-bold ${textColor}`}>{t('forgotPassword.title')}</h1>
                <p className={`text-sm ${subText}`}>{t('forgotPassword.subtitle')}</p>
              </div>
            </div>

            {sent ? (
              <div className="space-y-4">
                <div className={`rounded-xl px-4 py-4 ring-1 ${
                  isDark ? 'bg-emerald-500/10 text-emerald-200 ring-emerald-400/30' : 'bg-emerald-50 text-emerald-700 ring-emerald-200'
                }`}>
                  <div className="font-semibold">{t('forgotPassword.sentTitle')}</div>
                  <p className="text-sm mt-1 opacity-90">
                    {t('forgotPassword.sentBody', { email })}
                  </p>
                </div>
                <p className={`text-xs ${subText}`}>
                  {t('forgotPassword.didntGet')}{' '}
                  <button type="button" onClick={() => { setSent(false); setEmail(''); }} className={`font-semibold ${linkStyle}`}>
                    {t('forgotPassword.tryDifferent')}
                  </button>.
                </p>
                <button
                  type="button"
                  onClick={() => navigate('/login')}
                  className="w-full py-3 rounded-xl bg-gradient-to-r from-brand-500 to-brand-700 text-white font-semibold shadow-lg shadow-brand-500/40 hover:opacity-90 transition-opacity"
                >
                  {t('forgotPassword.backToSignIn')}
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="space-y-5">
                <div>
                  <label className={`block text-xs font-semibold mb-1.5 ${subText}`}>{t('forgotPassword.emailLabel')}</label>
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder={t('forgotPassword.emailPlaceholder')}
                    className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-brand-500 ${inputStyle}`}
                  />
                </div>

                {error && (
                  <div className={`rounded-xl text-sm px-4 py-3 ring-1 ${
                    isDark ? 'bg-red-500/10 text-red-200 ring-red-400/30' : 'bg-red-50 text-red-700 ring-red-200'
                  }`}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full py-3.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-700 text-white font-semibold text-base shadow-lg shadow-brand-500/40 hover:opacity-90 transition-opacity disabled:opacity-60"
                >
                  {loading ? t('forgotPassword.sending') : t('forgotPassword.sendLink')}
                </button>

                <div className={`text-center text-sm ${subText}`}>
                  {t('forgotPassword.rememberIt')}{' '}
                  <a href="/login" className={`font-semibold ${linkStyle}`}>{t('forgotPassword.signIn')}</a>
                </div>
              </form>
            )}
          </div>
        </main>
      </div>
    </div>
  );
}
