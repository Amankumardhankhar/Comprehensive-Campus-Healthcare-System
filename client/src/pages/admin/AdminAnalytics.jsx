import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext.jsx';
import { apiFetch, getToken } from '../../lib/api.js';
import AdminLayout from './AdminLayout.jsx';

const DISEASE_LABELS = ['cold','flu','headache','fever','stomach_ache','back_pain','anxiety','allergy','migraine','hypertension'];

export default function AdminAnalytics() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [riskDist, setRiskDist] = useState(null);
  const [trend, setTrend] = useState(null);
  const [trendLabel, setTrendLabel] = useState('fever');
  const [trendLoading, setTrendLoading] = useState(false);
  const [medicines, setMedicines] = useState([]);
  const [forecastMed, setForecastMed] = useState('');
  const [forecast, setForecast] = useState(null);
  const [forecastLoading, setForecastLoading] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!getToken()) { navigate('/login'); return; }
    (async () => {
      try {
        const [dist, meds] = await Promise.all([
          apiFetch('/api/analytics/risk-distribution'),
          apiFetch('/api/medicines'),
        ]);
        setRiskDist(dist.data);
        const medList = meds.items || meds.data || [];
        setMedicines(medList);
        if (medList.length > 0) setForecastMed(medList[0]._id);
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    })();
  }, [navigate]);

  const loadTrend = async () => {
    setTrendLoading(true);
    try {
      const res = await apiFetch(`/api/analytics/disease-trends?label=${trendLabel}&days=90`);
      setTrend(res);
    } catch (e) { console.error(e); }
    finally { setTrendLoading(false); }
  };

  const loadForecast = async () => {
    if (!forecastMed) return;
    setForecastLoading(true);
    try {
      const res = await apiFetch(`/api/analytics/forecast/${forecastMed}?horizonDays=14`);
      setForecast(res);
    } catch (e) { console.error(e); }
    finally { setForecastLoading(false); }
  };

  const card = isDark ? 'bg-white/5 ring-1 ring-white/10' : 'bg-white/80 ring-1 ring-slate-200';
  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const subText = isDark ? 'text-white/60' : 'text-slate-500';
  const inputCls = `rounded-xl px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-brand-500 ${isDark ? 'bg-white/10 border-white/20 text-white' : 'bg-white border-slate-200 text-slate-900'}`;

  const RISK_COLORS = { LOW: '#10b981', MEDIUM: '#f59e0b', HIGH: '#ef4444' };

  // Build bar chart from trend data
  const trendPoints = trend?.timeSeries || [];
  const maxCount = Math.max(...trendPoints.map(p => p.count || 0), 1);

  // Build simple bar chart for risk distribution
  const riskTotal = riskDist ? Object.values(riskDist).reduce((a, b) => a + b, 0) : 0;

  return (
    <AdminLayout>
      <div className="space-y-8">
        <div>
          <h1 className={`text-3xl font-bold ${textColor}`}>Analytics</h1>
          <p className={`mt-1 text-sm ${subText}`}>Disease trends · Risk distribution · Demand forecasting</p>
        </div>

        {loading ? <div className={`text-sm ${subText}`}>Loading...</div> : (
          <div className="space-y-6">

            {/* Risk Distribution */}
            <div className={`rounded-2xl p-6 backdrop-blur-xl ${card}`}>
              <div className={`text-xs uppercase tracking-widest font-semibold mb-5 ${subText}`}>Population Risk Distribution</div>
              {riskDist && riskTotal > 0 ? (
                <div className="space-y-3">
                  {Object.entries(riskDist).map(([level, count]) => (
                    <div key={level} className="flex items-center gap-4">
                      <div className="w-20 text-right">
                        <span className="text-xs font-semibold" style={{ color: RISK_COLORS[level] }}>{level}</span>
                      </div>
                      <div className={`flex-1 rounded-full h-4 overflow-hidden ${isDark ? 'bg-white/10' : 'bg-slate-100'}`}>
                        <div className="h-full rounded-full transition-all duration-500"
                          style={{ width: `${(count / riskTotal) * 100}%`, background: RISK_COLORS[level] }} />
                      </div>
                      <div className={`w-20 text-sm font-semibold ${textColor}`}>{count} <span className={`text-xs font-normal ${subText}`}>({Math.round((count/riskTotal)*100)}%)</span></div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className={`text-sm ${subText}`}>No risk data yet — run some consultations first.</div>
              )}
            </div>

            {/* Disease Trend */}
            <div className={`rounded-2xl p-6 backdrop-blur-xl ${card}`}>
              <div className={`text-xs uppercase tracking-widest font-semibold mb-4 ${subText}`}>Disease Trend (90 days)</div>
              <div className="flex gap-3 mb-5">
                <select value={trendLabel} onChange={e => setTrendLabel(e.target.value)} className={inputCls}>
                  {DISEASE_LABELS.map(l => <option key={l} value={l}>{l}</option>)}
                </select>
                <button onClick={loadTrend} disabled={trendLoading}
                  className="rounded-xl bg-gradient-to-r from-brand-500 to-brand-700 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  {trendLoading ? 'Loading…' : 'Load'}
                </button>
              </div>

              {trend && trendPoints.length > 0 ? (
                <div>
                  <div className="flex items-end gap-1 h-32">
                    {trendPoints.slice(-30).map((p, i) => (
                      <div key={i} className="flex-1 flex flex-col items-center justify-end h-full group relative">
                        <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden group-hover:block text-[10px] whitespace-nowrap rounded px-1 py-0.5"
                          style={{ background: isDark ? '#1e293b' : '#f1f5f9', color: isDark ? 'white' : '#334155' }}>
                          {p.date?.slice(5)}: {p.count}
                        </div>
                        <div className="w-full rounded-t"
                          style={{ height: `${Math.max(4, (p.count / maxCount) * 100)}%`, background: p.spike ? '#ef4444' : '#6366f1' }} />
                      </div>
                    ))}
                  </div>
                  <div className={`mt-2 text-xs ${subText}`}>Last 30 days · <span className="text-red-400">red = spike detected</span></div>
                  <div className="mt-3 grid grid-cols-3 gap-3">
                    <MiniStat label="Total Cases" value={trend.totalCount ?? '—'} isDark={isDark} textColor={textColor} subText={subText} />
                    <MiniStat label="Avg per Day" value={trend.avgPerDay?.toFixed(1) ?? '—'} isDark={isDark} textColor={textColor} subText={subText} />
                    <MiniStat label="Spikes" value={trend.spikeCount ?? '—'} isDark={isDark} textColor={textColor} subText={subText} />
                  </div>
                </div>
              ) : (
                <div className={`text-sm ${subText}`}>{trend ? 'No data for this disease.' : 'Select a disease and click Load.'}</div>
              )}
            </div>

            {/* Demand Forecast */}
            <div className={`rounded-2xl p-6 backdrop-blur-xl ${card}`}>
              <div className={`text-xs uppercase tracking-widest font-semibold mb-4 ${subText}`}>Medicine Demand Forecast (14 days)</div>
              <div className="flex gap-3 mb-5">
                <select value={forecastMed} onChange={e => setForecastMed(e.target.value)} className={`${inputCls} flex-1`}>
                  {medicines.map(m => <option key={m._id} value={m._id}>{m.name}</option>)}
                </select>
                <button onClick={loadForecast} disabled={forecastLoading || !forecastMed}
                  className="rounded-xl bg-gradient-to-r from-teal-500 to-emerald-600 px-5 py-2 text-sm font-semibold text-white disabled:opacity-60">
                  {forecastLoading ? 'Loading…' : 'Forecast'}
                </button>
              </div>
              {forecast ? (
                <div className="grid grid-cols-3 gap-4">
                  <MiniStat label="Predicted Units" value={forecast.forecastedUnits ?? forecast.data?.forecastedUnits ?? '—'} isDark={isDark} textColor={textColor} subText={subText} />
                  <MiniStat label="Confidence" value={forecast.confidence ? `${Math.round(forecast.confidence*100)}%` : '—'} isDark={isDark} textColor={textColor} subText={subText} />
                  <MiniStat label="Restock By" value={forecast.restockBy ?? forecast.data?.restockBy ?? '—'} isDark={isDark} textColor={textColor} subText={subText} />
                </div>
              ) : (
                <div className={`text-sm ${subText}`}>Select a medicine and click Forecast.</div>
              )}
            </div>

          </div>
        )}
      </div>
    </AdminLayout>
  );
}

function MiniStat({ label, value, isDark, textColor, subText }) {
  return (
    <div className={`rounded-xl p-3 ${isDark ? 'bg-white/5' : 'bg-slate-50'}`}>
      <div className={`text-[10px] uppercase tracking-widest ${subText}`}>{label}</div>
      <div className={`mt-1 text-xl font-bold ${textColor}`}>{value}</div>
    </div>
  );
}
