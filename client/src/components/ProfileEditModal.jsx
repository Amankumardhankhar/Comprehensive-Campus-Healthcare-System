import { useEffect, useState } from 'react';
import { apiFetch } from '../lib/api.js';

export default function ProfileEditModal({ isDark, profile, onClose, onSaved, endpoint = '/api/auth/me' }) {
  const [form, setForm] = useState({
    name: profile?.name || '',
    phone: profile?.phone || '',
    department: profile?.department || '',
    studentId: profile?.studentId || '',
    dateOfBirth: profile?.dateOfBirth ? new Date(profile.dateOfBirth).toISOString().slice(0, 10) : '',
    chronicConditions: (profile?.chronicConditions || []).join(', '),
  });
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  const handleSubmit = async (e) => {
    e.preventDefault();
    setErr('');
    setSaving(true);
    try {
      const body = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        department: form.department.trim() || null,
        studentId: form.studentId.trim() || null,
        dateOfBirth: form.dateOfBirth ? new Date(form.dateOfBirth).toISOString() : null,
        chronicConditions: form.chronicConditions
          .split(',')
          .map((s) => s.trim())
          .filter(Boolean),
      };
      const res = await apiFetch(endpoint, { method: 'PATCH', body });
      onSaved(res.data?.user || res.data);
    } catch (e) {
      const detail = e?.payload?.details?.[0]?.message || e?.payload?.message || e.message || 'Failed to save';
      setErr(detail);
    } finally {
      setSaving(false);
    }
  };

  const labelCls = `block text-xs font-semibold uppercase tracking-wider mb-1.5 ${isDark ? 'text-white/60' : 'text-slate-500'}`;
  const inputCls = `w-full rounded-xl px-3.5 py-2.5 text-sm ring-1 transition outline-none focus:ring-2 ${
    isDark
      ? 'bg-white/5 text-white ring-white/15 placeholder-white/30 focus:ring-brand-400/60'
      : 'bg-white text-slate-900 ring-slate-200 placeholder-slate-400 focus:ring-brand-500/60'
  }`;
  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const subText = isDark ? 'text-white/60' : 'text-slate-500';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 py-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`relative w-full max-w-lg rounded-3xl p-6 ring-1 shadow-2xl ${
        isDark ? 'bg-slate-900 ring-white/10' : 'bg-white ring-slate-200'
      }`}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className={`text-lg font-bold ${textColor}`}>Edit profile</h3>
            <p className={`text-xs mt-0.5 ${subText}`}>Email and role cannot be changed</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className={`rounded-lg p-1.5 transition-colors ${isDark ? 'text-white/60 hover:bg-white/10 hover:text-white' : 'text-slate-500 hover:bg-slate-100 hover:text-slate-900'}`}
          >
            <svg className="h-5 w-5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 6L6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className={labelCls}>Full name</label>
            <input className={inputCls} value={form.name} onChange={(e) => set('name', e.target.value)} required maxLength={100} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Phone</label>
              <input className={inputCls} value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="+91…" />
            </div>
            <div>
              <label className={labelCls}>Department</label>
              <input className={inputCls} value={form.department} onChange={(e) => set('department', e.target.value)} placeholder="e.g. SCOPE" />
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className={labelCls}>Student/Staff ID</label>
              <input className={inputCls} value={form.studentId} onChange={(e) => set('studentId', e.target.value)} placeholder="e.g. 22BCE0001" />
            </div>
            <div>
              <label className={labelCls}>Date of birth</label>
              <input type="date" className={inputCls} value={form.dateOfBirth} onChange={(e) => set('dateOfBirth', e.target.value)} />
            </div>
          </div>

          <div>
            <label className={labelCls}>Chronic conditions <span className="normal-case font-normal opacity-70">(comma-separated)</span></label>
            <input className={inputCls} value={form.chronicConditions} onChange={(e) => set('chronicConditions', e.target.value)} placeholder="e.g. asthma, diabetes" />
          </div>

          {err && (
            <div className={`rounded-xl px-3.5 py-2.5 text-sm ring-1 ${
              isDark ? 'bg-red-500/10 text-red-200 ring-red-400/30' : 'bg-red-50 text-red-700 ring-red-200'
            }`}>
              {err}
            </div>
          )}

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              disabled={saving}
              className={`rounded-xl px-4 py-2.5 text-sm font-semibold ring-1 transition-colors ${
                isDark ? 'text-white/80 ring-white/15 hover:bg-white/10' : 'text-slate-700 ring-slate-200 hover:bg-slate-50'
              }`}
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-gradient-to-r from-brand-500 to-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow shadow-brand-500/30 hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              {saving ? 'Saving…' : 'Save changes'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
