import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext.jsx';
import { apiFetch, getToken } from '../../lib/api.js';
import AdminLayout from './AdminLayout.jsx';

export default function AdminConfig() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [config, setConfig] = useState(null);
  const [form, setForm] = useState({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!getToken()) { navigate('/login'); return; }
    (async () => {
      try {
        const res = await apiFetch('/api/system/config');
        setConfig(res.data);
        setForm(res.data);
      } catch (e) { setError(e.message); }
      finally { setLoading(false); }
    })();
  }, [navigate]);

  const handleSave = async () => {
    setSaving(true); setError(''); setSaved(false);
    try {
      const res = await apiFetch('/api/system/config', { method: 'PUT', body: form });
      setConfig(res.data);
      setForm(res.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const set = (key, val) => setForm(f => ({ ...f, [key]: val }));

  const card = isDark ? 'bg-white/5 ring-1 ring-white/10' : 'bg-white/80 ring-1 ring-slate-200';
  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const subText = isDark ? 'text-white/60' : 'text-slate-500';
  const inputCls = `w-full rounded-xl px-3 py-2.5 text-sm border focus:outline-none focus:ring-2 focus:ring-brand-500 ${isDark ? 'bg-white/10 border-white/20 text-white' : 'bg-white border-slate-200 text-slate-900'}`;
  const labelCls = `block text-xs font-semibold mb-1.5 ${subText}`;

  return (
    <AdminLayout>
      <div className="space-y-8 max-w-2xl">
        <div>
          <h1 className={`text-3xl font-bold ${textColor}`}>System Config</h1>
          <p className={`mt-1 text-sm ${subText}`}>Global machine settings — changes apply immediately</p>
        </div>

        {loading ? (
          <div className={`text-sm ${subText}`}>Loading...</div>
        ) : (
          <>
            {error && (
              <div className={`rounded-xl px-4 py-3 text-sm ${isDark ? 'bg-red-500/15 text-red-200' : 'bg-red-50 text-red-700'}`}>{error}</div>
            )}

            {/* Quick Pickup Caps */}
            <Section title="Quick Pickup Limits" isDark={isDark} card={card} textColor={textColor} subText={subText}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Max Total (₹)</label>
                  <input type="number" className={inputCls} value={form.quickPickup?.maxTotalInr ?? 200}
                    onChange={e => set('quickPickup', { ...form.quickPickup, maxTotalInr: Number(e.target.value) })} />
                </div>
                <div>
                  <label className={labelCls}>Max Units per Item</label>
                  <input type="number" className={inputCls} value={form.quickPickup?.maxUnitsPerItem ?? 2}
                    onChange={e => set('quickPickup', { ...form.quickPickup, maxUnitsPerItem: Number(e.target.value) })} />
                </div>
                <div>
                  <label className={labelCls}>Sessions per User per Day</label>
                  <input type="number" className={inputCls} value={form.quickPickup?.sessionsPerUserPerDay ?? 2}
                    onChange={e => set('quickPickup', { ...form.quickPickup, sessionsPerUserPerDay: Number(e.target.value) })} />
                </div>
              </div>
            </Section>

            {/* Kiosk Settings */}
            <Section title="Kiosk / Consultation Settings" isDark={isDark} card={card} textColor={textColor} subText={subText}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Max Sessions per Day</label>
                  <input type="number" className={inputCls} value={form.kiosk?.maxSessionsPerDay ?? 5}
                    onChange={e => set('kiosk', { ...form.kiosk, maxSessionsPerDay: Number(e.target.value) })} />
                </div>
                <div>
                  <label className={labelCls}>Session Timeout (minutes)</label>
                  <input type="number" className={inputCls} value={form.kiosk?.sessionTimeoutMinutes ?? 30}
                    onChange={e => set('kiosk', { ...form.kiosk, sessionTimeoutMinutes: Number(e.target.value) })} />
                </div>
              </div>
            </Section>

            {/* Dispense Settings */}
            <Section title="Dispense Settings" isDark={isDark} card={card} textColor={textColor} subText={subText}>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className={labelCls}>Max Items per Dispense</label>
                  <input type="number" className={inputCls} value={form.dispense?.maxItems ?? 3}
                    onChange={e => set('dispense', { ...form.dispense, maxItems: Number(e.target.value) })} />
                </div>
                <div>
                  <label className={labelCls}>Payment Timeout (minutes)</label>
                  <input type="number" className={inputCls} value={form.dispense?.paymentTimeoutMinutes ?? 10}
                    onChange={e => set('dispense', { ...form.dispense, paymentTimeoutMinutes: Number(e.target.value) })} />
                </div>
              </div>
            </Section>

            {/* Raw JSON preview */}
            <Section title="Current Config (read-only)" isDark={isDark} card={card} textColor={textColor} subText={subText}>
              <pre className={`text-xs overflow-auto rounded-xl p-4 ${isDark ? 'bg-black/30 text-green-300' : 'bg-slate-100 text-slate-700'}`}>
                {JSON.stringify(config, null, 2)}
              </pre>
            </Section>

            <div className="flex items-center gap-4">
              <button onClick={handleSave} disabled={saving}
                className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-brand-700 px-8 py-3 text-sm font-semibold text-white shadow-lg shadow-brand-500/30 disabled:opacity-60">
                {saving ? 'Saving…' : 'Save Changes'}
              </button>
              {saved && <span className={`text-sm font-medium ${isDark ? 'text-emerald-300' : 'text-emerald-600'}`}>✓ Saved</span>}
            </div>
          </>
        )}
      </div>
    </AdminLayout>
  );
}

function Section({ title, children, isDark, card, textColor, subText }) {
  return (
    <div className={`rounded-2xl p-6 backdrop-blur-xl ${card}`}>
      <div className={`text-xs uppercase tracking-widest font-semibold mb-5 ${subText}`}>{title}</div>
      {children}
    </div>
  );
}
