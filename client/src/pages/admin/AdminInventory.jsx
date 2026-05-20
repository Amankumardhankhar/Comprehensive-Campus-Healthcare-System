import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext.jsx';
import { apiFetch, getToken } from '../../lib/api.js';
import AdminLayout from './AdminLayout.jsx';

const EMPTY_FORM = { name: '', genericName: '', category: 'analgesic', quantity: 0, pricePerUnit: 0, unit: 'tablet', expiryDate: '', minStockLevel: 10, otcSafe: false, dispensableByMachine: false, maxPerSession: 2 };
const CATEGORIES = ['analgesic','antibiotic','antacid','antihistamine','antiseptic','vitamin','antipyretic','other'];

export default function AdminInventory() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const [medicines, setMedicines] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [modal, setModal] = useState(null); // null | 'add' | 'edit' | 'adjust' | 'otc'
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);
  const [adjustQty, setAdjustQty] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/medicines');
      setMedicines(res.items || res.data || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };

  useEffect(() => { if (!getToken()) { navigate('/login'); return; } load(); }, [navigate]);

  const filtered = medicines.filter(m =>
    m.name?.toLowerCase().includes(search.toLowerCase()) ||
    m.genericName?.toLowerCase().includes(search.toLowerCase()) ||
    m.category?.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => { setForm(EMPTY_FORM); setError(''); setModal('add'); };
  const openEdit = (m) => { setSelected(m); setForm({ ...m, expiryDate: m.expiryDate?.slice(0,10) || '' }); setError(''); setModal('edit'); };
  const openAdjust = (m) => { setSelected(m); setAdjustQty(''); setAdjustReason(''); setError(''); setModal('adjust'); };
  const openOtc = (m) => { setSelected(m); setForm({ otcSafe: m.otcSafe, dispensableByMachine: m.dispensableByMachine, maxPerSession: m.maxPerSession || 2 }); setError(''); setModal('otc'); };
  const closeModal = () => { setModal(null); setSelected(null); setError(''); };

  const handleSave = async () => {
    setSaving(true); setError('');
    try {
      if (modal === 'add') await apiFetch('/api/medicines', { method: 'POST', body: form });
      else if (modal === 'edit') await apiFetch(`/api/medicines/${selected._id}`, { method: 'PUT', body: form });
      await load(); closeModal();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleAdjust = async () => {
    if (!adjustQty || !adjustReason) return setError('Fill all fields');
    setSaving(true); setError('');
    try {
      await apiFetch(`/api/medicines/${selected._id}/adjust`, { method: 'POST', body: { quantity: Number(adjustQty), reason: adjustReason } });
      await load(); closeModal();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleOtc = async () => {
    setSaving(true); setError('');
    try {
      await apiFetch(`/api/medicines/${selected._id}/otc`, { method: 'PATCH', body: { otcSafe: form.otcSafe, dispensableByMachine: form.dispensableByMachine, maxPerSession: Number(form.maxPerSession) } });
      await load(); closeModal();
    } catch (e) { setError(e.message); }
    finally { setSaving(false); }
  };

  const handleDelete = async (m) => {
    if (!window.confirm(`Deactivate "${m.name}"?`)) return;
    try { await apiFetch(`/api/medicines/${m._id}`, { method: 'DELETE' }); await load(); }
    catch (e) { alert(e.message); }
  };

  const card = isDark ? 'bg-white/5 ring-1 ring-white/10' : 'bg-white/80 ring-1 ring-slate-200';
  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const subText = isDark ? 'text-white/60' : 'text-slate-500';
  const inputCls = `w-full rounded-xl px-3 py-2 text-sm border focus:outline-none focus:ring-2 focus:ring-brand-500 ${isDark ? 'bg-white/10 border-white/20 text-white' : 'bg-white border-slate-200 text-slate-900'}`;
  const labelCls = `block text-xs font-semibold mb-1 ${subText}`;

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className={`text-3xl font-bold ${textColor}`}>Inventory</h1>
            <p className={`mt-1 text-sm ${subText}`}>{medicines.length} medicines · {medicines.filter(m=>m.quantity<=m.minStockLevel).length} low stock</p>
          </div>
          <button onClick={openAdd} className="inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-brand-500 to-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-brand-500/30">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
            Add Medicine
          </button>
        </div>

        {/* Search */}
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, generic, category..."
          className={`${inputCls} max-w-sm`} />

        {/* Table */}
        <div className={`rounded-2xl backdrop-blur-xl overflow-hidden ${card}`}>
          {loading ? (
            <div className={`p-8 text-center text-sm ${subText}`}>Loading...</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className={`border-b text-xs uppercase tracking-wider ${isDark ? 'border-white/10 text-white/40' : 'border-slate-200 text-slate-400'}`}>
                    <th className="px-4 py-3 text-left">Medicine</th>
                    <th className="px-4 py-3 text-left">Category</th>
                    <th className="px-4 py-3 text-right">Stock</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="px-4 py-3 text-left">Expiry</th>
                    <th className="px-4 py-3 text-center">OTC</th>
                    <th className="px-4 py-3 text-center">Machine</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-inherit">
                  {filtered.map((m) => {
                    const low = m.quantity <= (m.minStockLevel || 10);
                    const expired = m.expiryDate && new Date(m.expiryDate) < new Date();
                    return (
                      <tr key={m._id} className={`transition-colors ${isDark ? 'hover:bg-white/5 border-white/5' : 'hover:bg-slate-50 border-slate-100'}`}>
                        <td className="px-4 py-3">
                          <div className={`font-semibold ${textColor}`}>{m.name}</div>
                          <div className={`text-xs ${subText}`}>{m.genericName}</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs capitalize ring-1 ${isDark ? 'ring-white/10 text-white/70' : 'ring-slate-200 text-slate-600'}`}>{m.category}</span>
                        </td>
                        <td className="px-4 py-3 text-right">
                          <span className={`font-semibold ${low ? 'text-red-500' : textColor}`}>{m.quantity}</span>
                          <span className={` text-xs ${subText}`}> {m.unit}</span>
                        </td>
                        <td className={`px-4 py-3 text-right font-semibold ${textColor}`}>₹{m.pricePerUnit}</td>
                        <td className="px-4 py-3">
                          <span className={expired ? 'text-red-500 font-semibold' : subText}>{m.expiryDate ? new Date(m.expiryDate).toLocaleDateString('en-IN') : '—'}</span>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`h-2 w-2 rounded-full inline-block ${m.otcSafe ? 'bg-emerald-400' : (isDark ? 'bg-white/20' : 'bg-slate-300')}`} />
                        </td>
                        <td className="px-4 py-3 text-center">
                          <span className={`h-2 w-2 rounded-full inline-block ${m.dispensableByMachine ? 'bg-brand-400' : (isDark ? 'bg-white/20' : 'bg-slate-300')}`} />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center justify-end gap-1">
                            <ActionBtn onClick={() => openAdjust(m)} title="Adjust stock" isDark={isDark}>
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><path d="M12 5v14M5 12h14"/></svg>
                            </ActionBtn>
                            <ActionBtn onClick={() => openOtc(m)} title="OTC settings" isDark={isDark}>
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 1v4M12 19v4M4.22 4.22l2.83 2.83M16.95 16.95l2.83 2.83M1 12h4M19 12h4M4.22 19.78l2.83-2.83M16.95 7.05l2.83-2.83"/></svg>
                            </ActionBtn>
                            <ActionBtn onClick={() => openEdit(m)} title="Edit" isDark={isDark}>
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 013 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>
                            </ActionBtn>
                            <ActionBtn onClick={() => handleDelete(m)} title="Delete" isDark={isDark} danger>
                              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6"/><path d="M10 11v6M14 11v6"/></svg>
                            </ActionBtn>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                  {filtered.length === 0 && (
                    <tr><td colSpan={8} className={`px-4 py-8 text-center text-sm ${subText}`}>No medicines found</td></tr>
                  )}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* Modal */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4" style={{ background: 'rgba(0,0,0,0.6)' }}>
          <div className={`w-full max-w-lg rounded-3xl p-7 shadow-2xl backdrop-blur-xl ${isDark ? 'bg-slate-900/95 ring-1 ring-white/10' : 'bg-white/95 ring-1 ring-slate-200'}`}>
            <div className={`text-lg font-bold mb-5 ${textColor}`}>
              {modal === 'add' && 'Add Medicine'}
              {modal === 'edit' && `Edit: ${selected?.name}`}
              {modal === 'adjust' && `Adjust Stock: ${selected?.name}`}
              {modal === 'otc' && `OTC Settings: ${selected?.name}`}
            </div>

            {error && <div className={`mb-4 rounded-xl px-4 py-2.5 text-sm ${isDark ? 'bg-red-500/15 text-red-200' : 'bg-red-50 text-red-700'}`}>{error}</div>}

            {(modal === 'add' || modal === 'edit') && (
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2"><label className={labelCls}>Name</label><input className={inputCls} value={form.name} onChange={e=>setForm(f=>({...f,name:e.target.value}))} /></div>
                <div className="col-span-2"><label className={labelCls}>Generic Name</label><input className={inputCls} value={form.genericName} onChange={e=>setForm(f=>({...f,genericName:e.target.value}))} /></div>
                <div><label className={labelCls}>Category</label>
                  <select className={inputCls} value={form.category} onChange={e=>setForm(f=>({...f,category:e.target.value}))}>
                    {CATEGORIES.map(c=><option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div><label className={labelCls}>Unit</label><input className={inputCls} value={form.unit} onChange={e=>setForm(f=>({...f,unit:e.target.value}))} /></div>
                <div><label className={labelCls}>Quantity</label><input type="number" className={inputCls} value={form.quantity} onChange={e=>setForm(f=>({...f,quantity:Number(e.target.value)}))} /></div>
                <div><label className={labelCls}>Price per Unit (₹)</label><input type="number" className={inputCls} value={form.pricePerUnit} onChange={e=>setForm(f=>({...f,pricePerUnit:Number(e.target.value)}))} /></div>
                <div><label className={labelCls}>Expiry Date</label><input type="date" className={inputCls} value={form.expiryDate} onChange={e=>setForm(f=>({...f,expiryDate:e.target.value}))} /></div>
                <div><label className={labelCls}>Min Stock Level</label><input type="number" className={inputCls} value={form.minStockLevel} onChange={e=>setForm(f=>({...f,minStockLevel:Number(e.target.value)}))} /></div>
              </div>
            )}

            {modal === 'adjust' && (
              <div className="space-y-4">
                <div className={`text-sm ${subText}`}>Current stock: <span className={`font-bold ${textColor}`}>{selected?.quantity} {selected?.unit}</span></div>
                <div><label className={labelCls}>Quantity (+ to add, − to remove)</label><input type="number" className={inputCls} value={adjustQty} onChange={e=>setAdjustQty(e.target.value)} placeholder="e.g. 50 or -10" /></div>
                <div><label className={labelCls}>Reason</label><input className={inputCls} value={adjustReason} onChange={e=>setAdjustReason(e.target.value)} placeholder="e.g. Monthly restock" /></div>
              </div>
            )}

            {modal === 'otc' && (
              <div className="space-y-4">
                <Toggle label="OTC Safe (can be given without prescription)" value={form.otcSafe} onChange={v=>setForm(f=>({...f,otcSafe:v}))} isDark={isDark} textColor={textColor} />
                <Toggle label="Dispensable by Machine" value={form.dispensableByMachine} onChange={v=>setForm(f=>({...f,dispensableByMachine:v}))} isDark={isDark} textColor={textColor} />
                <div><label className={labelCls}>Max per Session</label><input type="number" min="1" max="10" className={inputCls} value={form.maxPerSession} onChange={e=>setForm(f=>({...f,maxPerSession:Number(e.target.value)}))} /></div>
              </div>
            )}

            <div className="flex justify-end gap-3 mt-6">
              <button onClick={closeModal} className={`rounded-full px-5 py-2 text-sm font-medium ring-1 ${isDark ? 'ring-white/20 text-white/70' : 'ring-slate-200 text-slate-600'}`}>Cancel</button>
              <button disabled={saving} onClick={modal === 'adjust' ? handleAdjust : modal === 'otc' ? handleOtc : handleSave}
                className="rounded-full bg-gradient-to-r from-brand-500 to-brand-700 px-6 py-2 text-sm font-semibold text-white shadow-md disabled:opacity-60">
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminLayout>
  );
}

function ActionBtn({ onClick, title, isDark, danger, children }) {
  return (
    <button onClick={onClick} title={title}
      className={`rounded-lg p-1.5 transition-colors ${danger
        ? (isDark ? 'hover:bg-red-500/20 text-red-400' : 'hover:bg-red-50 text-red-500')
        : (isDark ? 'hover:bg-white/10 text-white/60' : 'hover:bg-slate-100 text-slate-500')}`}>
      {children}
    </button>
  );
}

function Toggle({ label, value, onChange, isDark, textColor }) {
  return (
    <label className="flex items-center justify-between cursor-pointer">
      <span className={`text-sm ${textColor}`}>{label}</span>
      <button type="button" onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${value ? 'bg-brand-500' : (isDark ? 'bg-white/20' : 'bg-slate-200')}`}>
        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${value ? 'translate-x-6' : 'translate-x-1'}`} />
      </button>
    </label>
  );
}
