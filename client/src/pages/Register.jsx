import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { setAuth } from '../lib/api.js';
import MedicalBackground from '../components/MedicalBackground.jsx';
import Logo from '../components/Logo.jsx';
import HealthTip from '../components/HealthTip.jsx';
import EmergencyContacts from '../components/EmergencyContacts.jsx';
import UsefulLinks from '../components/UsefulLinks.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import LanguageSelector from '../components/LanguageSelector.jsx';
import LeftSidebar from '../components/LeftSidebar.jsx';
import RightSidebar from '../components/RightSidebar.jsx';
import { useTheme } from '../context/ThemeContext.jsx';

const ROLE_KEYS = ['student', 'staff'];

export default function Register() {
  const { t } = useTranslation();
  const { isDark } = useTheme();
  const navigate = useNavigate();

  const ROLES = ROLE_KEYS.map((key) => ({
    key,
    label: t(`login.role${key.charAt(0).toUpperCase() + key.slice(1)}`),
  }));

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [role, setRole] = useState('student');
  const [studentId, setStudentId] = useState('');
  const [department, setDepartment] = useState('');
  const [phone, setPhone] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError(t('register.errPasswordShort'));
      return;
    }
    if (password !== confirmPassword) {
      setError(t('register.errPasswordMismatch'));
      return;
    }

    setLoading(true);
    try {
      const body = { name, email, password, role };
      if (studentId.trim()) body.studentId = studentId.trim();
      if (department.trim()) body.department = department.trim();
      if (phone.trim()) body.phone = phone.trim();

      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const payload = await res.json();
      if (!res.ok) {
        const detail = payload.details?.[0]?.message || payload.message || t('register.registrationFailed');
        throw new Error(detail);
      }
      const user = payload.data?.user;
      const token = payload.data?.token;
      if (!user || !token) throw new Error(t('register.unexpectedResponse'));
      setAuth(token, user);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const headingColor = isDark ? 'text-white' : 'text-slate-900';
  const subTextColor = isDark ? 'text-slate-200' : 'text-slate-600';
  const cardBg = isDark
    ? 'bg-white/10 backdrop-blur-xl border-white/20 text-white'
    : 'bg-white/70 backdrop-blur-xl border-slate-200 text-slate-800';
  const inputStyle = isDark
    ? 'bg-white/10 border-white/20 text-white placeholder-slate-300'
    : 'bg-white/80 border-slate-200 text-slate-800 placeholder-slate-400';
  const labelStyle = isDark ? 'text-slate-200' : 'text-slate-700';
  const dividerStyle = isDark ? 'border-white/10' : 'border-slate-200';
  const linkStyle = isDark ? 'text-brand-300 hover:text-white' : 'text-brand-600 hover:text-brand-700';
  const toggleInactive = isDark
    ? 'text-slate-200 hover:bg-white/5'
    : 'text-slate-600 hover:bg-slate-100';
  const roleBarBg = isDark
    ? 'bg-white/5 border-white/10'
    : 'bg-slate-100 border-slate-200';

  return (
    <div className="relative min-h-screen overflow-hidden">
      <MedicalBackground />

      <div className="relative z-10 flex min-h-screen flex-col">
        <header className="flex items-center justify-between px-6 py-5 md:px-10">
          <button
            type="button"
            onClick={() => navigate('/')}
            className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-medium ring-1 backdrop-blur transition-colors ${
              isDark
                ? 'bg-white/10 text-white ring-white/15 hover:bg-white/20'
                : 'bg-white/80 text-slate-800 ring-slate-200 hover:bg-white'
            }`}
          >
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5M11 6l-6 6 6 6" />
            </svg>
            {t('login.backHome')}
          </button>
          <div className="flex items-center gap-3">
            <LanguageSelector compact />
            <ThemeToggle />
          </div>
        </header>

        <main className="flex-1 px-8 pb-10 md:px-14">
          <div className="grid gap-8 lg:grid-cols-[260px_1fr_260px] items-start">
            <LeftSidebar tipLabel="Wellness Tip" />

            <div className="grid gap-6 md:grid-cols-[1fr_420px] items-start">
              <div className="space-y-6">
                <div className="flex items-center gap-5">
                  <Logo size={80} />
                  <div>
                    <h1 className={`text-4xl font-bold leading-tight tracking-tight ${headingColor}`}>
                      {t('login.brandTitle').split('\n').map((line, i) => (
                        <span key={i}>{line}{i === 0 && <br />}</span>
                      ))}
                    </h1>
                    <p className={`text-sm mt-2 ${subTextColor}`}>
                      {t('register.brandTagline')}
                    </p>
                  </div>
                </div>
                <div className="grid sm:grid-cols-2 gap-4">
                  <HealthTip compact />
                  <EmergencyContacts compact />
                  <div className="sm:col-span-2">
                    <UsefulLinks compact />
                  </div>
                </div>
              </div>

              <div>
                <div className={`rounded-3xl shadow-2xl border p-8 ${cardBg}`}>
                  <div className="mb-6">
                    <h2 className={`text-2xl font-bold ${headingColor}`}>{t('register.cardTitle')}</h2>
                    <p className={`text-sm mt-1.5 ${subTextColor}`}>
                      {t('register.cardSubtitle')}
                    </p>
                  </div>

                  <div className={`flex gap-1.5 p-1.5 border rounded-xl mb-6 ${roleBarBg}`}>
                    {ROLES.map((r) => (
                      <button
                        key={r.key}
                        type="button"
                        onClick={() => setRole(r.key)}
                        className={`flex-1 py-2 text-sm font-semibold rounded-lg transition ${
                          role === r.key
                            ? 'bg-brand-500 text-white shadow shadow-brand-500/40'
                            : toggleInactive
                        }`}
                      >
                        {r.label}
                      </button>
                    ))}
                  </div>

                  <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                      <label className={`block text-xs font-semibold mb-1.5 ${labelStyle}`}>
                        {t('register.nameLabel')}
                      </label>
                      <input
                        type="text"
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        placeholder={t('register.namePlaceholder')}
                        className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition ${inputStyle}`}
                      />
                    </div>

                    <div>
                      <label className={`block text-xs font-semibold mb-1.5 ${labelStyle}`}>
                        {t('register.emailLabel')}
                      </label>
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={t('register.emailPlaceholder')}
                        className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition ${inputStyle}`}
                      />
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className={`block text-xs font-semibold mb-1.5 ${labelStyle}`}>
                          {role === 'student' ? t('register.studentIdLabel') : t('register.staffIdLabel')} <span className="opacity-60">{t('register.optional')}</span>
                        </label>
                        <input
                          type="text"
                          value={studentId}
                          onChange={(e) => setStudentId(e.target.value)}
                          placeholder={role === 'student' ? t('register.studentIdPlaceholder') : t('register.staffIdPlaceholder')}
                          className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition ${inputStyle}`}
                        />
                      </div>
                      <div>
                        <label className={`block text-xs font-semibold mb-1.5 ${labelStyle}`}>
                          {t('register.departmentLabel')} <span className="opacity-60">{t('register.optional')}</span>
                        </label>
                        <input
                          type="text"
                          value={department}
                          onChange={(e) => setDepartment(e.target.value)}
                          placeholder={t('register.departmentPlaceholder')}
                          className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition ${inputStyle}`}
                        />
                      </div>
                    </div>

                    <div>
                      <label className={`block text-xs font-semibold mb-1.5 ${labelStyle}`}>
                        {t('register.phoneLabel')} <span className="opacity-60">{t('register.optional')}</span>
                      </label>
                      <input
                        type="tel"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder={t('register.phonePlaceholder')}
                        className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition ${inputStyle}`}
                      />
                    </div>

                    <div>
                      <label className={`block text-xs font-semibold mb-1.5 ${labelStyle}`}>
                        {t('register.passwordLabel')}
                      </label>
                      <div className="relative">
                        <input
                          type={showPassword ? 'text' : 'password'}
                          required
                          value={password}
                          onChange={(e) => setPassword(e.target.value)}
                          placeholder={t('register.passwordPlaceholder')}
                          className={`w-full px-4 py-3 pr-20 rounded-xl border focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition ${inputStyle}`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowPassword((v) => !v)}
                          className={`absolute right-3 top-1/2 -translate-y-1/2 text-xs font-semibold ${linkStyle}`}
                        >
                          {showPassword ? t('login.hide') : t('login.show')}
                        </button>
                      </div>
                    </div>

                    <div>
                      <label className={`block text-xs font-semibold mb-1.5 ${labelStyle}`}>
                        {t('register.confirmLabel')}
                      </label>
                      <input
                        type={showPassword ? 'text' : 'password'}
                        required
                        value={confirmPassword}
                        onChange={(e) => setConfirmPassword(e.target.value)}
                        placeholder={t('register.confirmPlaceholder')}
                        className={`w-full px-4 py-3 rounded-xl border focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent transition ${inputStyle}`}
                      />
                    </div>

                    {error && (
                      <div className={`rounded-xl text-sm px-4 py-3 border ${
                        isDark
                          ? 'bg-red-500/20 border-red-400/40 text-red-100'
                          : 'bg-red-50 border-red-200 text-red-700'
                      }`}>
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full py-3.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-700 text-white font-semibold text-base shadow-lg shadow-brand-500/40 hover:opacity-90 transition-opacity disabled:opacity-60 disabled:cursor-not-allowed"
                    >
                      {loading
                        ? t('register.creating')
                        : t('register.createAccount', { role: ROLES.find((r) => r.key === role).label })}
                    </button>
                  </form>

                  <div className={`mt-6 pt-6 border-t text-center text-sm ${dividerStyle} ${subTextColor}`}>
                    {t('register.haveAccount')}{' '}
                    <a href="/login" className={`font-semibold ${linkStyle}`}>
                      {t('register.signIn')}
                    </a>
                  </div>
                </div>
                <p className={`text-center text-xs mt-4 ${subTextColor}`}>
                  {t('register.footer')}
                </p>
              </div>
            </div>

            <RightSidebar />
          </div>
        </main>
      </div>
    </div>
  );
}
