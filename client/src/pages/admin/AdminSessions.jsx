import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext.jsx';
import { apiFetch, getToken } from '../../lib/api.js';
import AdminLayout from './AdminLayout.jsx';

const STATUS_BADGE = {
  dispensed:   'bg-emerald-500/15 text-emerald-400 ring-emerald-400/30',
  paid:        'bg-blue-500/15 text-blue-400 ring-blue-400/30',
  analyzing:   'bg-amber-500/15 text-amber-400 ring-amber-400/30',
  cancelled:   'bg-red-500/15 text-red-400 ring-red-400/30',
  in_progress: 'bg-purple-500/15 text-purple-400 ring-purple-400/30',
  pending:     'bg-slate-500/15 text-slate-400 ring-slate-400/30',
};
const STATUS_BADGE_LIGHT = {
  dispensed:   'bg-emerald-100 text-emerald-700 ring-emerald-200',
  paid:        'bg-blue-100 text-blue-700 ring-blue-200',
  analyzing:   'bg-amber-100 text-amber-700 ring-amber-200',
  cancelled:   'bg-red-100 text-red-700 ring-red-200',
  in_progress: 'bg-purple-100 text-purple-700 ring-purple-200',
  pending:     'bg-slate-100 text-slate-600 ring-slate-200',
};

export default function AdminSessions() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [typeFilter, setTypeFilter] = useState('all');
  const [expanded, setExpanded] = useState(null);

  useEffect(() => {
    if (!getToken()) { navigate('/login'); return; }
    (async () => {
      try {
        const res = await apiFetch('/api/machine/sessions?limit=100&sort=-createdAt');
        setSessions(res.items || []);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [navigate]);

  const filtered = sessions.filter(s => {
    if (filter !== 'all' && s.status !== filter) return false;
    if (typeFilter !== 'all' && s.type !== typeFilter) return false;
    return true;
  });

  const card = isDark ? 'bg-white/5 ring-1 ring-white/10' : 'bg-white/80 ring-1 ring-slate-200';
  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const subText = isDark ? 'text-white/60' : 'text-slate-500';
  const badge = (status) => (isDark ? STATUS_BADGE[status] : STATUS_BADGE_LIGHT[status]) || (isDark ? STATUS_BADGE.pending : STATUS_BADGE_LIGHT.pending);

  const FilterBtn = ({ value, current, label, setter }) => (
    <button onClick={() => setter(value)}
      className={`rounded-full px-4 py-1.5 text-xs font-medium transition-colors ring-1 ${
        current === value
          ? 'bg-brand-500 text-white ring-brand-500 shadow shadow-brand-500/30'
          : (isDark ? 'ring-white/20 text-white/60 hover:bg-white/10' : 'ring-slate-200 text-slate-600 hover:bg-slate-50')
      }`}>{label}</button>
  );

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div>
          <h1 className={`text-3xl font-bold ${textColor}`}>Sessions</h1>
          <p className={`mt-1 text-sm ${subText}`}>{sessions.length} total · {sessions.filter(s=>s.status==='dispensed').length} dispensed</p>
        </div>

        <div className="flex flex-wrap gap-3">
          <div className="flex gap-2">
            {['all','dispensed','in_progress','cancelled','paid'].map(s => (
              <FilterBtn key={s} value={s} current={filter} label={s === 'all' ? 'All Status' : s.replace('_',' ')} setter={setFilter} />
            ))}
          </div>
          <div className="flex gap-2">
            {['all','kiosk','quick'].map(t => (
              <FilterBtn key={t} value={t} current={typeFilter} label={t === 'all' ? 'All Types' : t === 'kiosk' ? 'Consultation' : 'Quick Pickup'} setter={setTypeFilter} />
            ))}
          </div>
        </div>

        <div className={`rounded-2xl backdrop-blur-xl overflow-hidden ${card}`}>
          {loading ? (
            <div className={`p-8 text-center text-sm ${subText}`}>Loading...</div>
          ) : (
            <div className="divide-y divide-inherit">
              {filtered.length === 0 && <div className={`p-8 text-center text-sm ${subText}`}>No sessions found</div>}
              {filtered.map((s) => (
                <div key={s._id}>
                  <div
                    onClick={() => setExpanded(expanded === s._id ? null : s._id)}
                    className={`flex items-center justify-between px-5 py-4 cursor-pointer transition-colors ${isDark ? 'hover:bg-white/5 border-white/5' : 'hover:bg-slate-50 border-slate-100'}`}
                  >
                    <div className="flex items-center gap-4 min-w-0">
                      <div className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-xs font-bold ${
                        s.type === 'quick'
                          ? (isDark ? 'bg-brand-500/20 text-brand-300' : 'bg-brand-100 text-brand-700')
                          : (isDark ? 'bg-teal-500/20 text-teal-300' : 'bg-teal-100 text-teal-700')
                      }`}>{s.type === 'quick' ? 'QP' : 'AI'}</div>
                      <div className="min-w-0">
                        <div className={`text-sm font-semibold truncate ${textColor}`}>
                          {s.type === 'quick' ? 'Quick Pickup' : 'AI Consultation'}
                          {s.decision?.action && <span className={`ml-2 text-xs font-normal ${subText}`}>→ {s.decision.action}</span>}
                        </div>
                        <div className={`text-xs ${subText}`}>{new Date(s.createdAt).toLocaleString('en-IN')} · {s._id.slice(-8)}</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-3 shrink-0">
                      {s.payment?.amount > 0 && <span className={`text-sm font-semibold ${textColor}`}>₹{s.payment.amount}</span>}
                      <span className={`rounded-full px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ring-1 ${badge(s.status)}`}>{s.status}</span>
                      <svg className={`h-4 w-4 transition-transform ${expanded === s._id ? 'rotate-180' : ''} ${subText}`} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M6 9l6 6 6-6"/></svg>
                    </div>
                  </div>

                  {expanded === s._id && (
                    <div className={`px-5 pb-5 pt-1 ${isDark ? 'bg-white/[0.02]' : 'bg-slate-50/80'}`}>
                      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                        {s.symptoms?.length > 0 && (
                          <InfoBlock title="Symptoms" isDark={isDark} subText={subText} textColor={textColor}>
                            <div className="flex flex-wrap gap-1">
                              {s.symptoms.map((sym, i) => (
                                <span key={i} className={`rounded-full px-2 py-0.5 text-xs ring-1 capitalize ${isDark ? 'ring-white/10 text-white/70' : 'ring-slate-200 text-slate-600'}`}>{sym}</span>
                              ))}
                            </div>
                          </InfoBlock>
                        )}
                        {s.aiResults?.disease && (
                          <InfoBlock title="AI Diagnosis" isDark={isDark} subText={subText} textColor={textColor}>
                            <div className={`font-semibold capitalize ${textColor}`}>{s.aiResults.disease.disease}</div>
                            <div className={`text-xs ${subText}`}>{Math.round((s.aiResults.disease.confidence||0)*100)}% confidence · Risk: {s.aiResults.risk?.level || '—'}</div>
                          </InfoBlock>
                        )}
                        {s.sensorData && Object.keys(s.sensorData).length > 0 && (
                          <InfoBlock title="Vitals" isDark={isDark} subText={subText} textColor={textColor}>
                            <div className="grid grid-cols-2 gap-1 text-xs">
                              {s.sensorData.heartRate && <span className={subText}>HR: <b className={textColor}>{s.sensorData.heartRate} bpm</b></span>}
                              {s.sensorData.temperature && <span className={subText}>Temp: <b className={textColor}>{s.sensorData.temperature}°F</b></span>}
                              {s.sensorData.spO2 && <span className={subText}>SpO₂: <b className={textColor}>{s.sensorData.spO2}%</b></span>}
                              {s.sensorData.respirationRate && <span className={subText}>Resp: <b className={textColor}>{s.sensorData.respirationRate} rpm</b></span>}
                            </div>
                          </InfoBlock>
                        )}
                        {(s.cart?.length > 0 || s.dispensed?.length > 0) && (
                          <InfoBlock title="Medicines" isDark={isDark} subText={subText} textColor={textColor}>
                            {(s.dispensed || s.cart || []).map((item, i) => (
                              <div key={i} className={`text-xs ${subText}`}>{item.medicineName} × {item.quantity} — ₹{item.unitPrice}</div>
                            ))}
                          </InfoBlock>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </AdminLayout>
  );
}

function InfoBlock({ title, children, isDark, subText, textColor }) {
  return (
    <div className={`rounded-xl p-3 ${isDark ? 'bg-white/5' : 'bg-white'}`}>
      <div className={`text-[10px] uppercase tracking-widest mb-2 ${subText}`}>{title}</div>
      {children}
    </div>
  );
}
