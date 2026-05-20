import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext.jsx';
import { apiFetch, getToken } from '../../lib/api.js';
import AdminLayout from './AdminLayout.jsx';

export default function AdminDashboard() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [aiHealth, setAiHealth] = useState(null);
  const [recentSessions, setRecentSessions] = useState([]);
  const [lowStockItems, setLowStockItems] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { navigate('/login'); return; }
    (async () => {
      try {
        const [medStats, health, sessions, lowStock] = await Promise.all([
          apiFetch('/api/medicines/stats'),
          apiFetch('/api/analytics/ai-health'),
          apiFetch('/api/machine/sessions?limit=8&sort=-createdAt'),
          apiFetch('/api/medicines?lowStock=true&limit=10'),
        ]);
        setStats(medStats.data);
        setAiHealth(health.data);
        setRecentSessions(sessions.items || []);
        setLowStockItems(lowStock.items || lowStock.data || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [navigate]);

  const card = isDark ? 'bg-white/5 ring-1 ring-white/10' : 'bg-white/80 ring-1 ring-slate-200';
  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const subText = isDark ? 'text-white/60' : 'text-slate-500';

  const STATUS_COLORS = {
    dispensed: 'bg-emerald-500',
    paid: 'bg-blue-500',
    analyzing: 'bg-amber-500',
    cancelled: 'bg-red-500',
    in_progress: 'bg-purple-500',
  };

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className={`text-3xl font-bold ${textColor}`}>Dashboard</h1>
          <p className={`mt-1 text-sm ${subText}`}>Campus Healthcare System — live overview</p>
        </div>

        {loading ? (
          <div className={`text-sm ${subText}`}>Loading...</div>
        ) : (
          <>
            {/* Stat cards */}
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard label="Total Medicines" value={stats?.total ?? '—'} sub="in inventory" color="brand" isDark={isDark} icon={
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z"/></svg>
              } />
              <StatCard label="Low Stock" value={stats?.lowStock ?? '—'} sub="need restocking" color="amber" isDark={isDark} icon={
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 9v4M12 17h.01"/><circle cx="12" cy="12" r="10"/></svg>
              } />
              <StatCard label="OTC Medicines" value={stats?.otcCount ?? '—'} sub="dispensable by machine" color="emerald" isDark={isDark} icon={
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="9 11 12 14 22 4"/><path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11"/></svg>
              } />
              <StatCard label="Expiring Soon" value={stats?.expiringSoon ?? '—'} sub="within 30 days" color="red" isDark={isDark} icon={
                <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              } />
            </div>

            {/* Low stock alert (only when there are items) */}
            {lowStockItems.length > 0 && (
              <div className={`rounded-2xl p-5 ring-1 backdrop-blur-xl ${
                isDark ? 'bg-amber-500/10 ring-amber-400/30' : 'bg-amber-50 ring-amber-200'
              }`}>
                <div className="flex items-start gap-4 flex-wrap">
                  <div className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ${
                    isDark ? 'bg-amber-500/30 text-amber-200' : 'bg-amber-500 text-white'
                  }`}>
                    <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 9v2m0 4h.01" />
                      <path d="M10.3 3.5L2.3 17a2 2 0 001.7 3h16a2 2 0 001.7-3l-8-13.5a2 2 0 00-3.4 0z" />
                    </svg>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className={`text-base font-bold ${textColor}`}>
                        {lowStockItems.length === 1 ? '1 medicine below threshold' : `${lowStockItems.length} medicines below threshold`}
                      </div>
                      <button
                        type="button"
                        onClick={() => navigate('/admin/inventory')}
                        className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 transition-colors ${
                          isDark ? 'bg-white/10 text-white ring-white/15 hover:bg-white/20' : 'bg-white text-slate-700 ring-slate-200 hover:bg-slate-50'
                        }`}
                      >
                        Open inventory →
                      </button>
                    </div>
                    <p className={`mt-0.5 text-xs ${subText}`}>
                      Current quantity is at or below the medicine's minimum stock level. Restock to avoid kiosk failures.
                    </p>
                    <div className="mt-3 grid gap-2 sm:grid-cols-2">
                      {lowStockItems.slice(0, 8).map((m) => {
                        const ratio = m.minStockLevel > 0 ? (m.quantity / m.minStockLevel) : 0;
                        const dangerCls = m.quantity === 0
                          ? (isDark ? 'text-red-300' : 'text-red-700')
                          : (isDark ? 'text-amber-300' : 'text-amber-700');
                        return (
                          <div key={m._id} className={`flex items-center justify-between gap-3 rounded-xl px-3 py-2 ring-1 ${
                            isDark ? 'bg-amber-500/5 ring-amber-400/20' : 'bg-white ring-amber-200'
                          }`}>
                            <div className="min-w-0">
                              <div className={`truncate text-sm font-semibold ${textColor}`}>{m.name}</div>
                              <div className={`text-xs ${subText} truncate`}>{m.genericName || m.category}</div>
                            </div>
                            <div className="shrink-0 text-right">
                              <div className={`text-sm font-bold tabular-nums ${dangerCls}`}>
                                {m.quantity}<span className={`text-xs font-normal ${subText}`}> / {m.minStockLevel}</span>
                              </div>
                              <div className={`text-[10px] uppercase tracking-wider ${subText}`}>{m.unit || 'unit'}</div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    {lowStockItems.length > 8 && (
                      <div className={`mt-2 text-xs ${subText}`}>+ {lowStockItems.length - 8} more</div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* AI Health + Recent Sessions */}
            <div className="grid gap-6 lg:grid-cols-2">
              {/* AI Health */}
              <div className={`rounded-2xl p-6 backdrop-blur-xl ${card}`}>
                <div className={`text-xs uppercase tracking-widest font-semibold mb-4 ${subText}`}>AI Service Health</div>
                <div className="space-y-2">
                  {aiHealth ? Object.entries(aiHealth).map(([svc, info]) => (
                    <div key={svc} className={`flex items-center justify-between rounded-xl px-3 py-2 ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${info.status === 'ok' ? 'bg-emerald-400' : 'bg-red-400'}`} />
                        <span className={`text-sm capitalize ${textColor}`}>{svc.replace(/_/g, ' ')}</span>
                      </div>
                      <span className={`text-xs ${info.status === 'ok' ? (isDark ? 'text-emerald-300' : 'text-emerald-700') : (isDark ? 'text-red-300' : 'text-red-600')}`}>
                        {info.status === 'ok' ? `Online · ${info.latencyMs}ms` : 'Offline'}
                      </span>
                    </div>
                  )) : <div className={`text-sm ${subText}`}>Health data unavailable</div>}
                </div>
              </div>

              {/* Recent Sessions */}
              <div className={`rounded-2xl p-6 backdrop-blur-xl ${card}`}>
                <div className="flex items-center justify-between mb-4">
                  <div className={`text-xs uppercase tracking-widest font-semibold ${subText}`}>Recent Sessions</div>
                  <button onClick={() => navigate('/admin/sessions')} className={`text-xs underline-offset-2 hover:underline ${subText}`}>View all</button>
                </div>
                <div className="space-y-2">
                  {recentSessions.length === 0 && <div className={`text-sm ${subText}`}>No sessions yet</div>}
                  {recentSessions.map((s) => (
                    <div key={s._id} className={`flex items-center justify-between rounded-xl px-3 py-2 ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
                      <div>
                        <div className={`text-sm font-medium ${textColor}`}>{s.type === 'quick' ? 'Quick Pickup' : 'Consultation'}</div>
                        <div className={`text-xs ${subText}`}>{new Date(s.createdAt).toLocaleString('en-IN')}</div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`h-2 w-2 rounded-full ${STATUS_COLORS[s.status] || 'bg-slate-400'}`} />
                        <span className={`text-xs capitalize ${subText}`}>{s.status}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

function StatCard({ label, value, sub, color, isDark, icon }) {
  const colors = {
    brand:  { bg: isDark ? 'bg-brand-500/15 text-brand-300'  : 'bg-brand-50 text-brand-700' },
    amber:  { bg: isDark ? 'bg-amber-500/15 text-amber-300'  : 'bg-amber-50 text-amber-700' },
    emerald:{ bg: isDark ? 'bg-emerald-500/15 text-emerald-300':'bg-emerald-50 text-emerald-700' },
    red:    { bg: isDark ? 'bg-red-500/15 text-red-300'      : 'bg-red-50 text-red-700' },
  };
  const card = isDark ? 'bg-white/5 ring-1 ring-white/10' : 'bg-white/80 ring-1 ring-slate-200';
  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const subText = isDark ? 'text-white/60' : 'text-slate-500';
  return (
    <div className={`rounded-2xl p-5 backdrop-blur-xl ${card}`}>
      <div className="flex items-start justify-between">
        <div>
          <div className={`text-xs uppercase tracking-widest ${subText}`}>{label}</div>
          <div className={`mt-2 text-4xl font-bold ${textColor}`}>{value}</div>
          <div className={`mt-1 text-xs ${subText}`}>{sub}</div>
        </div>
        <div className={`rounded-xl p-2.5 ${colors[color]?.bg}`}>{icon}</div>
      </div>
    </div>
  );
}
