import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AUTH_EVENT, clearAuth, getUser } from '../lib/api.js';
import { useTheme } from '../context/ThemeContext.jsx';

function initials(name) {
  if (!name) return '?';
  return name
    .split(' ')
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? '')
    .join('');
}

const ROLE_COLORS = {
  dark: {
    admin: 'bg-purple-500/20 text-purple-300 ring-purple-400/30',
    staff: 'bg-blue-500/20 text-blue-300 ring-blue-400/30',
    student: 'bg-emerald-500/20 text-emerald-300 ring-emerald-400/30',
  },
  light: {
    admin: 'bg-purple-100 text-purple-700 ring-purple-200',
    staff: 'bg-blue-100 text-blue-700 ring-blue-200',
    student: 'bg-emerald-100 text-emerald-700 ring-emerald-200',
  },
};

export default function AccountBox() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const [user, setUser] = useState(null);
  const ref = useRef(null);

  useEffect(() => {
    setUser(getUser());
    const sync = () => setUser(getUser());
    window.addEventListener(AUTH_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(AUTH_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  const handleLogout = () => {
    setOpen(false);
    clearAuth();
    navigate('/');
  };

  if (!user) {
    return (
      <button
        type="button"
        onClick={() => navigate('/login')}
        className={`rounded-2xl px-6 py-3 text-base font-semibold ring-1 transition ${
          isDark
            ? 'bg-white/10 text-white ring-white/20 hover:bg-white/15'
            : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50 shadow-md'
        }`}
      >
        Login
      </button>
    );
  }

  const roleKey = user.role?.toLowerCase() ?? 'student';
  const roleBadge = isDark
    ? ROLE_COLORS.dark[roleKey] ?? ROLE_COLORS.dark.student
    : ROLE_COLORS.light[roleKey] ?? ROLE_COLORS.light.student;

  return (
    <div ref={ref} className="relative">
      {/* Large always-visible card trigger */}
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-4 rounded-2xl px-5 py-3.5 ring-1 transition ${
          isDark
            ? 'bg-white/10 ring-white/15 hover:bg-white/15'
            : 'bg-white ring-slate-200 hover:bg-slate-50 shadow-lg'
        }`}
      >
        {/* Large avatar */}
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 text-xl font-bold text-white shadow-md">
          {initials(user.name)}
        </span>

        {/* Info block */}
        <div className="text-left">
          <div className={`text-base font-bold leading-tight ${isDark ? 'text-white' : 'text-slate-900'}`}>
            {user.name}
          </div>
          <div className={`mt-0.5 text-sm ${isDark ? 'text-white/60' : 'text-slate-500'}`}>
            {user.email}
          </div>
          <div className="mt-1.5 flex items-center gap-2">
            <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 capitalize ${roleBadge}`}>
              {roleKey}
            </span>
            {user.campusId && (
              <span className={`text-xs ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                ID: {user.campusId}
              </span>
            )}
          </div>
        </div>

        {/* Chevron */}
        <svg
          className={`ml-2 h-5 w-5 shrink-0 transition-transform ${isDark ? 'text-white/40' : 'text-slate-400'} ${open ? 'rotate-180' : ''}`}
          viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"
          strokeLinecap="round" strokeLinejoin="round"
        >
          <path d="M6 9l6 6 6-6" />
        </svg>
      </button>

      {/* Dropdown */}
      {open && (
        <div
          className={`absolute right-0 top-full z-50 mt-2 w-80 rounded-2xl p-1.5 shadow-2xl ring-1 backdrop-blur-xl ${
            isDark ? 'bg-slate-900/90 ring-white/10' : 'bg-white/95 ring-slate-200'
          }`}
        >
          {/* Detail block */}
          <div className={`rounded-xl px-5 py-4 ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
            <div className="flex items-center gap-4">
              <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 text-xl font-bold text-white">
                {initials(user.name)}
              </span>
              <div className="min-w-0">
                <div className={`truncate text-base font-bold ${isDark ? 'text-white' : 'text-slate-900'}`}>
                  {user.name}
                </div>
                <div className={`truncate text-sm mt-0.5 ${isDark ? 'text-white/50' : 'text-slate-500'}`}>
                  {user.email}
                </div>
                <div className="mt-2 flex items-center gap-2">
                  <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 capitalize ${roleBadge}`}>
                    {roleKey}
                  </span>
                  {user.campusId && (
                    <span className={`text-xs ${isDark ? 'text-white/40' : 'text-slate-400'}`}>
                      Campus ID: {user.campusId}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className={`my-1.5 h-px ${isDark ? 'bg-white/10' : 'bg-slate-100'}`} />

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              navigate(roleKey === 'admin' ? '/admin' : '/dashboard');
            }}
            className={`flex w-full items-center gap-3 rounded-xl px-5 py-3 text-sm font-semibold transition ${
              isDark ? 'text-white hover:bg-white/5' : 'text-slate-700 hover:bg-slate-50'
            }`}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/>
              <rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
            </svg>
            {roleKey === 'admin' ? 'Admin panel' : 'My dashboard'}
          </button>

          <button
            type="button"
            onClick={handleLogout}
            className={`flex w-full items-center gap-3 rounded-xl px-5 py-3.5 text-base font-semibold transition ${
              isDark ? 'text-red-400 hover:bg-red-500/10' : 'text-red-600 hover:bg-red-50'
            }`}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor"
              strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4" />
              <polyline points="16 17 21 12 16 7" />
              <line x1="21" y1="12" x2="9" y2="12" />
            </svg>
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
