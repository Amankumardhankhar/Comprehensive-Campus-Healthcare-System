import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import MedicalBackground from '../components/MedicalBackground.jsx';
import ThemeToggle from '../components/ThemeToggle.jsx';
import LanguageSelector from '../components/LanguageSelector.jsx';
import Logo from '../components/Logo.jsx';
import AccountBox from '../components/AccountBox.jsx';
import ProfileEditModal from '../components/ProfileEditModal.jsx';
import { useTheme } from '../context/ThemeContext.jsx';
import { apiFetch, getToken, getUser, setAuth } from '../lib/api.js';

const STATUS_COLORS = {
  in_progress: { dark: 'bg-purple-500/20 text-purple-300 ring-purple-400/30', light: 'bg-purple-50 text-purple-700 ring-purple-200' },
  completed:   { dark: 'bg-emerald-500/20 text-emerald-300 ring-emerald-400/30', light: 'bg-emerald-50 text-emerald-700 ring-emerald-200' },
  cancelled:   { dark: 'bg-red-500/20 text-red-300 ring-red-400/30', light: 'bg-red-50 text-red-700 ring-red-200' },
  failed:      { dark: 'bg-red-500/20 text-red-300 ring-red-400/30', light: 'bg-red-50 text-red-700 ring-red-200' },
};

const RISK_COLORS = {
  LOW:    { dark: 'text-emerald-300', light: 'text-emerald-700' },
  MEDIUM: { dark: 'text-amber-300',   light: 'text-amber-700' },
  HIGH:   { dark: 'text-red-300',     light: 'text-red-700' },
};

const DECISION_LABEL = {
  DISPENSE: 'Dispensed',
  CONSULT_DOCTOR: 'Referred to doctor',
};

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function formatDateOnly(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

export default function Dashboard() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const cachedUser = getUser();

  const [profile, setProfile] = useState(cachedUser);
  const [sessions, setSessions] = useState([]);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [editing, setEditing] = useState(false);

  useEffect(() => {
    if (!getToken()) {
      navigate('/login', { replace: true });
      return;
    }
    (async () => {
      setError('');
      try {
        const [meRes, sessRes, recRes] = await Promise.allSettled([
          apiFetch('/api/auth/me'),
          apiFetch('/api/machine/sessions?limit=20&sort=-createdAt'),
          apiFetch('/api/records?limit=5&sort=-visitDate'),
        ]);

        if (meRes.status === 'fulfilled') {
          setProfile(meRes.value.data?.user || meRes.value.data || cachedUser);
        }
        if (sessRes.status === 'fulfilled') {
          setSessions(sessRes.value.items || []);
        }
        if (recRes.status === 'fulfilled') {
          setRecords(recRes.value.items || []);
        }

        const allFailed = [meRes, sessRes, recRes].every((r) => r.status === 'rejected');
        if (allFailed) {
          const firstErr = meRes.reason || sessRes.reason || recRes.reason;
          if (firstErr?.status === 401) {
            navigate('/login', { replace: true });
            return;
          }
          throw firstErr;
        }
      } catch (e) {
        setError(e?.message || 'Failed to load dashboard');
      } finally {
        setLoading(false);
      }
    })();
  }, [navigate]);

  const openReferrals = useMemo(
    () => sessions.filter((s) => s.decision?.action === 'CONSULT_DOCTOR' && !s.decision?.acknowledgedAt),
    [sessions]
  );

  const handleAcknowledge = async (sid) => {
    try {
      await apiFetch(`/api/machine/session/${sid}/acknowledge-referral`, { method: 'POST' });
      setSessions((list) =>
        list.map((s) =>
          s.sessionId === sid
            ? { ...s, decision: { ...(s.decision || {}), acknowledgedAt: new Date().toISOString() } }
            : s
        )
      );
    } catch (e) {
      alert(e?.payload?.message || e.message || 'Could not mark as resolved');
    }
  };

  const stats = useMemo(() => {
    const completed = sessions.filter((s) => s.status === 'completed');
    const totalDispensed = sessions.reduce(
      (sum, s) => sum + (s.dispensed?.reduce((q, d) => q + (d.quantity || 0), 0) || 0),
      0
    );
    const totalSpent = sessions.reduce((sum, s) => sum + (s.payment?.amount || 0), 0);
    const lastVisit = sessions[0]?.createdAt;
    return {
      total: sessions.length,
      completed: completed.length,
      dispensed: totalDispensed,
      spent: totalSpent,
      lastVisit,
    };
  }, [sessions]);

  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const subText   = isDark ? 'text-white/60' : 'text-slate-500';
  const mutedText = isDark ? 'text-white/70' : 'text-slate-600';
  const cardBg    = isDark ? 'bg-white/5 ring-white/10' : 'bg-white/80 ring-slate-200';
  const innerCard = isDark ? 'bg-white/5 ring-white/10' : 'bg-slate-50 ring-slate-200';

  const StatusBadge = ({ status }) => {
    const c = STATUS_COLORS[status] || STATUS_COLORS.in_progress;
    const cls = isDark ? c.dark : c.light;
    return (
      <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 capitalize ${cls}`}>
        {status?.replace('_', ' ') || 'unknown'}
      </span>
    );
  };

  return (
    <div className="relative min-h-screen overflow-hidden">
      <MedicalBackground />

      <div className="relative z-10 flex min-h-screen flex-col">
        {/* Header */}
        <header className="flex items-center justify-between px-6 py-5 md:px-10">
          <div className="flex items-center gap-4">
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
              Home
            </button>
            <div className="flex items-center gap-3">
              <Logo size={36} />
              <div>
                <div className={`text-base font-bold leading-tight ${textColor}`}>My Dashboard</div>
                <div className={`text-xs ${subText}`}>Campus Healthcare</div>
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

        <main className="flex-1 px-6 pb-10 md:px-10">
          {loading ? (
            <div className={`mt-20 text-center ${subText}`}>Loading your dashboard…</div>
          ) : error ? (
            <div className={`mt-20 mx-auto max-w-lg rounded-2xl px-6 py-5 text-center ring-1 ${
              isDark ? 'bg-red-500/10 text-red-200 ring-red-400/30' : 'bg-red-50 text-red-700 ring-red-200'
            }`}>
              {error}
            </div>
          ) : (
            <>
            {openReferrals.length > 0 && (
              <div className={`mb-6 rounded-3xl p-5 ring-1 backdrop-blur-xl ${
                isDark ? 'bg-amber-500/15 ring-amber-400/30' : 'bg-amber-50 ring-amber-200'
              }`}>
                <div className="flex items-start gap-4 flex-wrap">
                  <div className={`flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl ${
                    isDark ? 'bg-amber-500/30 text-amber-200' : 'bg-amber-500 text-white'
                  }`}>
                    <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 9v2m0 4h.01" />
                      <path d="M10.3 3.5L2.3 17a2 2 0 001.7 3h16a2 2 0 001.7-3l-8-13.5a2 2 0 00-3.4 0z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className={`text-base font-bold ${textColor}`}>
                      {openReferrals.length === 1 ? 'Open doctor referral' : `${openReferrals.length} open doctor referrals`}
                    </div>
                    <p className={`mt-0.5 text-sm ${mutedText}`}>
                      The kiosk recommended you visit the campus health centre. Mark each one resolved after you've gone.
                    </p>
                    <ul className="mt-3 space-y-2">
                      {openReferrals.map((s) => {
                        const topDisease = s.aiResults?.disease?.disease;
                        return (
                          <li key={s._id} className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2.5 ring-1 ${
                            isDark ? 'bg-amber-500/10 ring-amber-400/20' : 'bg-white ring-amber-200'
                          }`}>
                            <div className="min-w-0">
                              <div className={`text-sm font-semibold capitalize ${textColor}`}>
                                {topDisease ? topDisease.replace(/_/g, ' ') : 'Kiosk consultation'}
                              </div>
                              <div className={`text-xs ${subText}`}>{formatDate(s.createdAt)}</div>
                            </div>
                            <div className="flex items-center gap-1">
                              <button
                                type="button"
                                onClick={() => navigate(`/kiosk/result/${s.sessionId}`)}
                                className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 transition-colors ${
                                  isDark ? 'bg-white/10 text-white ring-white/15 hover:bg-white/20' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
                                }`}
                              >View</button>
                              <button
                                type="button"
                                onClick={() => handleAcknowledge(s.sessionId)}
                                className="rounded-lg bg-amber-500 hover:bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors"
                              >Mark resolved</button>
                            </div>
                          </li>
                        );
                      })}
                    </ul>
                  </div>
                </div>
              </div>
            )}
            <div className="grid gap-6 lg:grid-cols-[320px_1fr]">

              {/* LEFT: Profile + Stats */}
              <aside className="space-y-6">
                {/* Profile card */}
                <div className={`rounded-3xl p-6 backdrop-blur-xl ring-1 ${cardBg}`}>
                  <div className="flex items-start gap-4">
                    <span className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-brand-400 to-brand-700 text-2xl font-bold text-white shadow-md">
                      {profile?.name?.split(' ').slice(0,2).map((w) => w[0]?.toUpperCase()).join('') || '?'}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className={`truncate text-lg font-bold ${textColor}`}>{profile?.name || 'Account'}</div>
                      <div className={`truncate text-sm ${subText}`}>{profile?.email}</div>
                      <div className="mt-1.5">
                        <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 capitalize ${
                          isDark ? 'bg-brand-500/20 text-brand-300 ring-brand-400/30' : 'bg-brand-50 text-brand-700 ring-brand-200'
                        }`}>
                          {profile?.role || 'student'}
                        </span>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setEditing(true)}
                      title="Edit profile"
                      className={`shrink-0 rounded-lg p-2 ring-1 transition-colors ${
                        isDark ? 'bg-white/5 text-white/70 ring-white/15 hover:bg-white/10 hover:text-white' : 'bg-white text-slate-600 ring-slate-200 hover:bg-slate-50 hover:text-slate-900'
                      }`}
                    >
                      <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 20h9" />
                        <path d="M16.5 3.5a2.121 2.121 0 113 3L7 19l-4 1 1-4 12.5-12.5z" />
                      </svg>
                    </button>
                  </div>

                  <div className={`my-4 h-px ${isDark ? 'bg-white/10' : 'bg-slate-100'}`} />

                  <dl className="space-y-2 text-sm">
                    {profile?.studentId && (
                      <div className="flex justify-between gap-3">
                        <dt className={subText}>Student/Staff ID</dt>
                        <dd className={`font-medium truncate ${textColor}`}>{profile.studentId}</dd>
                      </div>
                    )}
                    {profile?.department && (
                      <div className="flex justify-between gap-3">
                        <dt className={subText}>Department</dt>
                        <dd className={`font-medium truncate ${textColor}`}>{profile.department}</dd>
                      </div>
                    )}
                    {profile?.phone && (
                      <div className="flex justify-between gap-3">
                        <dt className={subText}>Phone</dt>
                        <dd className={`font-medium ${textColor}`}>{profile.phone}</dd>
                      </div>
                    )}
                    {profile?.dateOfBirth && (
                      <div className="flex justify-between gap-3">
                        <dt className={subText}>Date of birth</dt>
                        <dd className={`font-medium ${textColor}`}>{formatDateOnly(profile.dateOfBirth)}</dd>
                      </div>
                    )}
                    {profile?.chronicConditions?.length > 0 && (
                      <div className="flex justify-between gap-3">
                        <dt className={subText}>Chronic conditions</dt>
                        <dd className={`font-medium text-right ${textColor}`}>{profile.chronicConditions.join(', ')}</dd>
                      </div>
                    )}
                    {profile?.createdAt && (
                      <div className="flex justify-between gap-3">
                        <dt className={subText}>Member since</dt>
                        <dd className={`font-medium ${textColor}`}>{formatDateOnly(profile.createdAt)}</dd>
                      </div>
                    )}
                  </dl>
                </div>

                {/* Stats card */}
                <div className={`rounded-3xl p-6 backdrop-blur-xl ring-1 ${cardBg}`}>
                  <div className={`mb-4 text-xs font-semibold uppercase tracking-widest ${subText}`}>Activity</div>
                  <div className="grid grid-cols-2 gap-3">
                    <div className={`rounded-xl p-3 ring-1 ${innerCard}`}>
                      <div className={`text-2xl font-bold ${textColor}`}>{stats.total}</div>
                      <div className={`mt-0.5 text-xs ${subText}`}>Total sessions</div>
                    </div>
                    <div className={`rounded-xl p-3 ring-1 ${innerCard}`}>
                      <div className={`text-2xl font-bold ${textColor}`}>{stats.completed}</div>
                      <div className={`mt-0.5 text-xs ${subText}`}>Completed</div>
                    </div>
                    <div className={`rounded-xl p-3 ring-1 ${innerCard}`}>
                      <div className={`text-2xl font-bold ${textColor}`}>{stats.dispensed}</div>
                      <div className={`mt-0.5 text-xs ${subText}`}>Items dispensed</div>
                    </div>
                    <div className={`rounded-xl p-3 ring-1 ${innerCard}`}>
                      <div className={`text-2xl font-bold ${textColor}`}>₹{stats.spent.toFixed(0)}</div>
                      <div className={`mt-0.5 text-xs ${subText}`}>Total spent</div>
                    </div>
                  </div>
                  <div className={`mt-4 text-xs ${subText}`}>
                    Last visit: <span className={`font-medium ${mutedText}`}>{formatDate(stats.lastVisit)}</span>
                  </div>
                </div>

                {/* Quick actions */}
                <div className={`rounded-3xl p-6 backdrop-blur-xl ring-1 ${cardBg}`}>
                  <div className={`mb-3 text-xs font-semibold uppercase tracking-widest ${subText}`}>Quick actions</div>
                  <div className="space-y-2">
                    <button
                      type="button"
                      onClick={() => navigate('/kiosk')}
                      className="w-full py-2.5 rounded-xl bg-gradient-to-r from-brand-500 to-brand-700 text-white font-semibold text-sm shadow shadow-brand-500/30 hover:opacity-90 transition-opacity"
                    >
                      Start AI consultation
                    </button>
                    <button
                      type="button"
                      onClick={() => navigate('/quick')}
                      className={`w-full py-2.5 rounded-xl font-semibold text-sm ring-1 transition-colors ${
                        isDark ? 'bg-white/5 text-white ring-white/15 hover:bg-white/10' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      Quick pickup
                    </button>
                  </div>
                </div>
              </aside>

              {/* RIGHT: Session history */}
              <section className="space-y-6">
                <div className={`rounded-3xl p-6 backdrop-blur-xl ring-1 ${cardBg}`}>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className={`text-lg font-bold ${textColor}`}>Recent visits</h2>
                      <p className={`text-xs ${subText}`}>Your last {sessions.length} kiosk and quick-pickup sessions</p>
                    </div>
                  </div>

                  {sessions.length === 0 ? (
                    <div className={`rounded-2xl p-8 text-center ring-1 ${innerCard}`}>
                      <div className={`text-base font-semibold ${textColor}`}>No visits yet</div>
                      <p className={`mt-1 text-sm ${subText}`}>Start your first AI consultation to see it here.</p>
                      <button
                        type="button"
                        onClick={() => navigate('/kiosk')}
                        className="mt-4 inline-flex items-center gap-2 rounded-xl bg-gradient-to-r from-brand-500 to-brand-700 text-white font-semibold text-sm px-5 py-2.5 shadow shadow-brand-500/30 hover:opacity-90 transition-opacity"
                      >
                        Start consultation
                      </button>
                    </div>
                  ) : (
                    <ul className="space-y-3">
                      {sessions.map((s) => {
                        const topDisease = s.aiResults?.disease?.disease;
                        const risk = s.aiResults?.risk?.level;
                        const riskCls = risk ? (isDark ? RISK_COLORS[risk]?.dark : RISK_COLORS[risk]?.light) : '';
                        const decisionLabel = s.decision?.action ? DECISION_LABEL[s.decision.action] : null;
                        const dispensedCount = s.dispensed?.reduce((q, d) => q + (d.quantity || 0), 0) || 0;
                        return (
                          <li key={s._id} className={`rounded-2xl p-4 ring-1 ${innerCard}`}>
                            <div className="flex items-start justify-between gap-3">
                              <div className="min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className={`text-sm font-semibold ${textColor}`}>
                                    {s.type === 'quick' ? 'Quick pickup' : 'Kiosk consultation'}
                                  </span>
                                  <StatusBadge status={s.status} />
                                  {risk && (
                                    <span className={`text-xs font-mono font-semibold ${riskCls}`}>
                                      Risk: {risk}
                                    </span>
                                  )}
                                </div>
                                <div className={`mt-0.5 text-xs ${subText}`}>{formatDate(s.createdAt)}</div>
                              </div>
                              {decisionLabel && (
                                <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
                                  s.decision.action === 'DISPENSE'
                                    ? (isDark ? 'bg-emerald-500/20 text-emerald-300 ring-emerald-400/30' : 'bg-emerald-50 text-emerald-700 ring-emerald-200')
                                    : (isDark ? 'bg-amber-500/20 text-amber-300 ring-amber-400/30' : 'bg-amber-50 text-amber-700 ring-amber-200')
                                }`}>
                                  {decisionLabel}
                                </span>
                              )}
                            </div>

                            {(topDisease || s.symptoms?.length || dispensedCount > 0) && (
                              <div className={`mt-3 grid gap-2 text-xs ${mutedText}`}>
                                {topDisease && (
                                  <div>
                                    <span className={`uppercase tracking-wider ${subText} mr-2`}>Top match</span>
                                    <span className="capitalize">{topDisease.replace(/_/g, ' ')}</span>
                                    {s.aiResults?.disease?.confidence != null && (
                                      <span className={`ml-1 ${subText}`}>
                                        ({Math.round(s.aiResults.disease.confidence * 100)}%)
                                      </span>
                                    )}
                                  </div>
                                )}
                                {s.symptoms?.length > 0 && (
                                  <div>
                                    <span className={`uppercase tracking-wider ${subText} mr-2`}>Symptoms</span>
                                    <span>{s.symptoms.slice(0, 5).map((sym) => sym.replace(/_/g, ' ')).join(', ')}</span>
                                    {s.symptoms.length > 5 && (
                                      <span className={subText}> +{s.symptoms.length - 5} more</span>
                                    )}
                                  </div>
                                )}
                                {dispensedCount > 0 && (
                                  <div>
                                    <span className={`uppercase tracking-wider ${subText} mr-2`}>Dispensed</span>
                                    <span>
                                      {s.dispensed.map((d) => `${d.medicineName} ×${d.quantity}`).join(', ')}
                                    </span>
                                  </div>
                                )}
                                {s.payment?.amount > 0 && (
                                  <div>
                                    <span className={`uppercase tracking-wider ${subText} mr-2`}>Paid</span>
                                    <span>₹{s.payment.amount.toFixed(2)} via {s.payment.method}</span>
                                  </div>
                                )}
                              </div>
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>

                <div className={`rounded-3xl p-6 backdrop-blur-xl ring-1 ${cardBg}`}>
                  <div className="flex items-start justify-between gap-3 mb-4">
                    <div>
                      <h2 className={`text-lg font-bold ${textColor}`}>In-person visits</h2>
                      <p className={`text-xs ${subText}`}>Consultations at the campus health centre</p>
                    </div>
                    <span className={`shrink-0 rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ${
                      isDark ? 'bg-amber-500/15 text-amber-300 ring-amber-400/30' : 'bg-amber-50 text-amber-700 ring-amber-200'
                    }`}>
                      Pending hospital integration
                    </span>
                  </div>

                  {records.length > 0 ? (
                    <ul className="space-y-3">
                      {records.map((r) => (
                        <li key={r._id} className={`rounded-2xl p-4 ring-1 ${innerCard}`}>
                          <div className="flex items-start justify-between gap-3">
                            <div className="min-w-0">
                              <div className={`text-sm font-semibold ${textColor}`}>{r.diagnosis || 'Consultation'}</div>
                              <div className={`mt-0.5 text-xs ${subText}`}>{formatDate(r.visitDate)}</div>
                            </div>
                            <span className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 capitalize ${
                              r.status === 'closed'
                                ? (isDark ? 'bg-slate-500/20 text-slate-300 ring-slate-400/30' : 'bg-slate-100 text-slate-600 ring-slate-200')
                                : (isDark ? 'bg-amber-500/20 text-amber-300 ring-amber-400/30' : 'bg-amber-50 text-amber-700 ring-amber-200')
                            }`}>
                              {r.status}
                            </span>
                          </div>
                          {r.symptoms?.length > 0 && (
                            <div className={`mt-2 text-xs ${mutedText}`}>
                              <span className={`uppercase tracking-wider ${subText} mr-2`}>Symptoms</span>
                              {r.symptoms.join(', ')}
                            </div>
                          )}
                          {r.prescribedMedicines?.length > 0 && (
                            <div className={`mt-1 text-xs ${mutedText}`}>
                              <span className={`uppercase tracking-wider ${subText} mr-2`}>Prescribed</span>
                              {r.prescribedMedicines.map((m) => `${m.medicineName} ×${m.quantity}`).join(', ')}
                            </div>
                          )}
                        </li>
                      ))}
                    </ul>
                  ) : (
                    <div className={`rounded-2xl p-5 ring-1 ${innerCard}`}>
                      <p className={`text-sm ${mutedText}`}>
                        Visits at the campus health centre will appear here once the system is connected to the affiliated hospital's records.
                      </p>
                      <p className={`mt-2 text-xs ${subText}`}>
                        For now, only kiosk and quick-pickup activity is tracked. If you saw a doctor in person, that record stays with the health centre's own system.
                      </p>
                    </div>
                  )}
                </div>
              </section>
            </div>
            </>
          )}
        </main>
      </div>

      {editing && (
        <ProfileEditModal
          isDark={isDark}
          profile={profile}
          onClose={() => setEditing(false)}
          onSaved={(updated) => {
            setProfile(updated);
            setAuth(getToken(), updated);
            setEditing(false);
          }}
        />
      )}
    </div>
  );
}

