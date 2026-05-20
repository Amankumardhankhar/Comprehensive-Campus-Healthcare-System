import { useEffect, useState } from 'react';
import { NavLink, useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext.jsx';
import { AUTH_EVENT, clearAuth, getToken, getUser, setAuth } from '../../lib/api.js';
import MedicalBackground from '../../components/MedicalBackground.jsx';
import ThemeToggle from '../../components/ThemeToggle.jsx';
import Logo from '../../components/Logo.jsx';
import ProfileEditModal from '../../components/ProfileEditModal.jsx';

const NAV = [
  { to: '/admin', label: 'Dashboard', end: true, icon: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/>
    </svg>
  )},
  { to: '/admin/inventory', label: 'Inventory', icon: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2v-4M9 21H5a2 2 0 01-2-2v-4m0 0h18"/>
    </svg>
  )},
  { to: '/admin/users', label: 'Users', icon: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 21v-2a4 4 0 00-4-4H5a4 4 0 00-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 00-3-3.87"/><path d="M16 3.13a4 4 0 010 7.75"/>
    </svg>
  )},
  { to: '/admin/sessions', label: 'Sessions', icon: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"/>
    </svg>
  )},
  { to: '/admin/analytics', label: 'Analytics', icon: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/>
    </svg>
  )},
  { to: '/admin/config', label: 'Config', icon: (
    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 00.33 1.82l.06.06a2 2 0 010 2.83 2 2 0 01-2.83 0l-.06-.06a1.65 1.65 0 00-1.82-.33 1.65 1.65 0 00-1 1.51V21a2 2 0 01-4 0v-.09A1.65 1.65 0 009 19.4a1.65 1.65 0 00-1.82.33l-.06.06a2 2 0 01-2.83-2.83l.06-.06A1.65 1.65 0 004.68 15a1.65 1.65 0 00-1.51-1H3a2 2 0 010-4h.09A1.65 1.65 0 004.6 9a1.65 1.65 0 00-.33-1.82l-.06-.06a2 2 0 012.83-2.83l.06.06A1.65 1.65 0 009 4.68a1.65 1.65 0 001-1.51V3a2 2 0 014 0v.09a1.65 1.65 0 001 1.51 1.65 1.65 0 001.82-.33l.06-.06a2 2 0 012.83 2.83l-.06.06A1.65 1.65 0 0019.4 9a1.65 1.65 0 001.51 1H21a2 2 0 010 4h-.09a1.65 1.65 0 00-1.51 1z"/>
    </svg>
  )},
];

export default function AdminLayout({ children }) {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [user, setUser] = useState(() => getUser());
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState(false);

  useEffect(() => {
    const sync = () => {
      const current = getUser();
      setUser(current);
      if (!current) navigate('/login', { replace: true });
    };
    window.addEventListener(AUTH_EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(AUTH_EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, [navigate]);

  const handleLogout = () => { clearAuth(); };

  const sidebar = isDark
    ? 'bg-slate-900/80 border-white/10'
    : 'bg-white/80 border-slate-200';
  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const subText = isDark ? 'text-white/60' : 'text-slate-500';
  const activeLink = isDark
    ? 'bg-brand-500/20 text-brand-300 border-brand-400'
    : 'bg-brand-50 text-brand-700 border-brand-500';
  const inactiveLink = isDark
    ? 'text-white/70 border-transparent hover:bg-white/5 hover:text-white'
    : 'text-slate-600 border-transparent hover:bg-slate-100 hover:text-slate-900';

  return (
    <div className="relative min-h-screen overflow-hidden">
      <MedicalBackground />
      <div className="relative z-10 flex min-h-screen">

        {/* Sidebar */}
        <aside className={`hidden md:flex flex-col w-64 shrink-0 border-r backdrop-blur-xl ${sidebar}`}>
          {/* Logo */}
          <div className="flex items-center gap-3 px-6 py-5 border-b border-inherit">
            <Logo size={36} />
            <div>
              <div className={`text-sm font-bold ${textColor}`}>Admin Panel</div>
              <div className={`text-xs ${subText}`}>Campus Healthcare</div>
            </div>
          </div>

          {/* Nav */}
          <nav className="flex-1 px-3 py-4 space-y-1">
            {NAV.map((item) => (
              <NavLink
                key={item.to}
                to={item.to}
                end={item.end}
                className={({ isActive }) =>
                  `flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium border-l-2 transition-all ${isActive ? activeLink : inactiveLink}`
                }
              >
                {item.icon}
                {item.label}
              </NavLink>
            ))}
          </nav>

          {/* User + edit + logout */}
          <div className={`px-4 py-4 border-t border-inherit`}>
            <div className="flex items-center justify-between gap-2">
              <div className="min-w-0">
                <div className={`truncate text-sm font-semibold ${textColor}`}>{user?.name || 'Admin'}</div>
                <div className={`truncate text-xs ${subText}`}>{user?.email}</div>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                <button onClick={() => setEditingProfile(true)} title="Edit profile"
                  className={`rounded-lg p-2 text-xs transition-colors ${isDark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-slate-100 text-slate-500'}`}>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 20h9" />
                    <path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z" />
                  </svg>
                </button>
                <button onClick={handleLogout} title="Sign out"
                  className={`rounded-lg p-2 text-xs transition-colors ${isDark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-slate-100 text-slate-500'}`}>
                  <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M9 21H5a2 2 0 01-2-2V5a2 2 0 012-2h4M16 17l5-5-5-5M21 12H9"/>
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </aside>

        {/* Main */}
        <div className="flex flex-1 flex-col min-w-0">
          {/* Top bar */}
          <header className={`flex items-center justify-between px-6 py-4 border-b backdrop-blur-xl ${sidebar}`}>
            <button className="md:hidden" onClick={() => setSidebarOpen(v => !v)}>
              <svg className={`h-6 w-6 ${textColor}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 6h16M4 12h16M4 18h16"/></svg>
            </button>
            <div className={`text-sm font-medium ${subText} hidden md:block`}>
              {new Date().toLocaleDateString('en-IN', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
            </div>
            <div className="flex items-center gap-3 ml-auto">
              <ThemeToggle />
              <button onClick={() => navigate('/')}
                className={`text-xs rounded-full px-4 py-1.5 ring-1 font-medium transition-colors ${isDark ? 'ring-white/20 text-white/70 hover:bg-white/10' : 'ring-slate-200 text-slate-600 hover:bg-slate-100'}`}>
                ← Back to App
              </button>
            </div>
          </header>

          <main className="flex-1 overflow-y-auto p-6 md:p-8">
            {children}
          </main>
        </div>
      </div>

      {editingProfile && (
        <ProfileEditModal
          isDark={isDark}
          profile={user}
          onClose={() => setEditingProfile(false)}
          onSaved={(updated) => {
            setUser(updated);
            setAuth(getToken(), updated);
            setEditingProfile(false);
          }}
        />
      )}
    </div>
  );
}
