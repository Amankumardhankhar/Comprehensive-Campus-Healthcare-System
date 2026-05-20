import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from '../../context/ThemeContext.jsx';
import { apiFetch, getToken, getUser } from '../../lib/api.js';
import AdminLayout from './AdminLayout.jsx';

const ROLES = ['student', 'staff', 'admin'];

const ROLE_BADGE = {
  dark: {
    admin: 'bg-purple-500/20 text-purple-300 ring-purple-400/30',
    staff: 'bg-blue-500/20 text-blue-300 ring-blue-400/30',
    student: 'bg-emerald-500/20 text-emerald-300 ring-emerald-400/30',
  },
  light: {
    admin: 'bg-purple-50 text-purple-700 ring-purple-200',
    staff: 'bg-blue-50 text-blue-700 ring-blue-200',
    student: 'bg-emerald-50 text-emerald-700 ring-emerald-200',
  },
};

const EMPTY_CREATE = { name: '', email: '', password: '', role: 'student', studentId: '', department: '', phone: '' };

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
}

export default function AdminUsers() {
  const { isDark } = useTheme();
  const navigate = useNavigate();
  const me = getUser();

  const [users, setUsers] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [activeFilter, setActiveFilter] = useState('');
  const [page, setPage] = useState(1);
  const limit = 25;

  const [modal, setModal] = useState(null); // 'create' | 'edit'
  const [selected, setSelected] = useState(null);
  const [form, setForm] = useState(EMPTY_CREATE);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState('');

  const load = async () => {
    setLoading(true);
    setErr('');
    try {
      const params = new URLSearchParams();
      if (search.trim()) params.set('search', search.trim());
      if (roleFilter) params.set('role', roleFilter);
      if (activeFilter) params.set('isActive', activeFilter);
      params.set('page', page);
      params.set('limit', limit);
      const res = await apiFetch(`/api/admin/users?${params}`);
      setUsers(res.items || []);
      setTotal(res.total || 0);
    } catch (e) {
      setErr(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!getToken()) { navigate('/login'); return; }
    load();
  }, [page, roleFilter, activeFilter]);

  // Reset to page 1 when search/filter changes
  const onSearchSubmit = (e) => {
    e.preventDefault();
    setPage(1);
    load();
  };

  const openCreate = () => { setForm(EMPTY_CREATE); setErr(''); setModal('create'); };
  const openEdit = (u) => {
    setSelected(u);
    setForm({
      name: u.name || '',
      email: u.email || '',
      role: u.role || 'student',
      studentId: u.studentId || '',
      department: u.department || '',
      phone: u.phone || '',
      dateOfBirth: u.dateOfBirth ? new Date(u.dateOfBirth).toISOString().slice(0, 10) : '',
      chronicConditions: (u.chronicConditions || []).join(', '),
      isActive: u.isActive !== false,
      password: '',
    });
    setErr('');
    setModal('edit');
  };
  const closeModal = () => { setModal(null); setSelected(null); setErr(''); };

  const parseErr = (e) => e?.payload?.details?.[0]?.message || e?.payload?.message || e.message || 'Failed';

  const handleCreate = async (e) => {
    e.preventDefault();
    setSaving(true); setErr('');
    try {
      const body = {
        name: form.name.trim(),
        email: form.email.trim(),
        password: form.password,
        role: form.role,
        studentId: form.studentId.trim() || undefined,
        department: form.department.trim() || undefined,
        phone: form.phone.trim() || undefined,
      };
      await apiFetch('/api/admin/users', { method: 'POST', body });
      await load();
      closeModal();
    } catch (e) { setErr(parseErr(e)); }
    finally { setSaving(false); }
  };

  const handleUpdate = async (e) => {
    e.preventDefault();
    setSaving(true); setErr('');
    try {
      const body = {
        name: form.name.trim(),
        phone: form.phone.trim() || null,
        department: form.department.trim() || null,
        studentId: form.studentId.trim() || null,
        dateOfBirth: form.dateOfBirth ? new Date(form.dateOfBirth).toISOString() : null,
        chronicConditions: form.chronicConditions.split(',').map((s) => s.trim()).filter(Boolean),
        role: form.role,
        isActive: form.isActive,
      };
      if (form.password) body.password = form.password;
      await apiFetch(`/api/admin/users/${selected._id}`, { method: 'PATCH', body });
      await load();
      closeModal();
    } catch (e) { setErr(parseErr(e)); }
    finally { setSaving(false); }
  };

  const handleDelete = async (u) => {
    if (!window.confirm(`Permanently delete "${u.name}" (${u.email})? This cannot be undone.`)) return;
    try {
      await apiFetch(`/api/admin/users/${u._id}`, { method: 'DELETE' });
      await load();
    } catch (e) { alert(parseErr(e)); }
  };

  const toggleActive = async (u) => {
    try {
      await apiFetch(`/api/admin/users/${u._id}`, { method: 'PATCH', body: { isActive: !u.isActive } });
      await load();
    } catch (e) { alert(parseErr(e)); }
  };

  const textColor = isDark ? 'text-white' : 'text-slate-900';
  const subText   = isDark ? 'text-white/60' : 'text-slate-500';
  const cardBg    = isDark ? 'bg-white/5 ring-white/10' : 'bg-white ring-slate-200';
  const inputCls  = `rounded-xl px-3 py-2 text-sm ring-1 outline-none focus:ring-2 ${
    isDark ? 'bg-white/5 text-white ring-white/15 placeholder-white/30 focus:ring-brand-400/60'
           : 'bg-white text-slate-900 ring-slate-200 placeholder-slate-400 focus:ring-brand-500/60'
  }`;
  const labelCls = `block text-xs font-semibold uppercase tracking-wider mb-1.5 ${subText}`;
  const rowBg    = isDark ? 'border-white/5 hover:bg-white/[0.03]' : 'border-slate-100 hover:bg-slate-50';

  const pageCount = Math.max(1, Math.ceil(total / limit));

  return (
    <AdminLayout>
      <div className="space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h1 className={`text-2xl font-bold ${textColor}`}>Users</h1>
            <p className={`text-sm ${subText}`}>{total} total · manage students, staff, and admins</p>
          </div>
          <button
            type="button"
            onClick={openCreate}
            className="rounded-xl bg-gradient-to-r from-brand-500 to-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow shadow-brand-500/30 hover:opacity-90 transition-opacity"
          >
            + Add user
          </button>
        </div>

        {/* Filters */}
        <div className={`rounded-2xl p-4 ring-1 backdrop-blur-xl ${cardBg}`}>
          <form onSubmit={onSearchSubmit} className="flex items-center gap-3 flex-wrap">
            <input
              className={`${inputCls} flex-1 min-w-[200px]`}
              placeholder="Search name, email, or ID…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            <select className={inputCls} value={roleFilter} onChange={(e) => { setPage(1); setRoleFilter(e.target.value); }}>
              <option value="">All roles</option>
              {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
            </select>
            <select className={inputCls} value={activeFilter} onChange={(e) => { setPage(1); setActiveFilter(e.target.value); }}>
              <option value="">All statuses</option>
              <option value="true">Active</option>
              <option value="false">Disabled</option>
            </select>
            <button type="submit" className={`rounded-xl px-4 py-2 text-sm font-semibold ring-1 transition-colors ${
              isDark ? 'text-white/80 ring-white/15 hover:bg-white/10' : 'text-slate-700 ring-slate-200 hover:bg-slate-50'
            }`}>Search</button>
          </form>
        </div>

        {err && (
          <div className={`rounded-xl px-4 py-3 text-sm ring-1 ${
            isDark ? 'bg-red-500/10 text-red-200 ring-red-400/30' : 'bg-red-50 text-red-700 ring-red-200'
          }`}>
            {err}
          </div>
        )}

        {/* Table */}
        <div className={`rounded-2xl ring-1 backdrop-blur-xl overflow-hidden ${cardBg}`}>
          {loading ? (
            <div className={`p-10 text-center ${subText}`}>Loading users…</div>
          ) : users.length === 0 ? (
            <div className={`p-10 text-center ${subText}`}>No users match the current filters.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead className={`text-xs uppercase tracking-wider ${subText} ${isDark ? 'bg-white/[0.03]' : 'bg-slate-50'}`}>
                  <tr>
                    <th className="px-4 py-3 text-left">Name</th>
                    <th className="px-4 py-3 text-left">Email</th>
                    <th className="px-4 py-3 text-left">Role</th>
                    <th className="px-4 py-3 text-left">ID / Dept</th>
                    <th className="px-4 py-3 text-left">Status</th>
                    <th className="px-4 py-3 text-left">Joined</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((u) => {
                    const isSelf = me?._id === u._id;
                    const badge = (isDark ? ROLE_BADGE.dark : ROLE_BADGE.light)[u.role] || '';
                    return (
                      <tr key={u._id} className={`border-t transition-colors ${rowBg}`}>
                        <td className={`px-4 py-3 font-medium ${textColor}`}>
                          {u.name}
                          {isSelf && <span className={`ml-2 text-[10px] uppercase tracking-wider ${subText}`}>(you)</span>}
                        </td>
                        <td className={`px-4 py-3 ${subText}`}>{u.email}</td>
                        <td className="px-4 py-3">
                          <span className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 capitalize ${badge}`}>{u.role}</span>
                        </td>
                        <td className={`px-4 py-3 ${subText}`}>
                          <div className={textColor}>{u.studentId || '—'}</div>
                          <div className="text-xs">{u.department || ''}</div>
                        </td>
                        <td className="px-4 py-3">
                          <button
                            type="button"
                            onClick={() => !isSelf && toggleActive(u)}
                            disabled={isSelf}
                            className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
                              u.isActive
                                ? (isDark ? 'bg-emerald-500/20 text-emerald-300 ring-emerald-400/30' : 'bg-emerald-50 text-emerald-700 ring-emerald-200')
                                : (isDark ? 'bg-slate-500/20 text-slate-300 ring-slate-400/30' : 'bg-slate-100 text-slate-600 ring-slate-200')
                            } ${isSelf ? 'cursor-not-allowed opacity-60' : 'hover:opacity-80 cursor-pointer'}`}
                            title={isSelf ? 'Cannot disable your own account' : (u.isActive ? 'Click to disable' : 'Click to enable')}
                          >
                            {u.isActive ? 'Active' : 'Disabled'}
                          </button>
                        </td>
                        <td className={`px-4 py-3 ${subText}`}>{formatDate(u.createdAt)}</td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => openEdit(u)}
                            className={`mr-1 rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 transition-colors ${
                              isDark ? 'text-white/80 ring-white/15 hover:bg-white/10' : 'text-slate-700 ring-slate-200 hover:bg-slate-50'
                            }`}
                          >Edit</button>
                          <button
                            type="button"
                            onClick={() => handleDelete(u)}
                            disabled={isSelf}
                            className={`rounded-lg px-3 py-1.5 text-xs font-semibold ring-1 transition-colors ${
                              isDark ? 'text-red-300 ring-red-400/30 hover:bg-red-500/10' : 'text-red-600 ring-red-200 hover:bg-red-50'
                            } ${isSelf ? 'cursor-not-allowed opacity-50' : ''}`}
                          >Delete</button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Pagination */}
        {pageCount > 1 && (
          <div className={`flex items-center justify-between text-sm ${subText}`}>
            <div>Page {page} of {pageCount}</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className={`rounded-lg px-3 py-1.5 ring-1 transition-colors ${
                  isDark ? 'text-white/80 ring-white/15 hover:bg-white/10' : 'text-slate-700 ring-slate-200 hover:bg-slate-50'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >Previous</button>
              <button
                type="button"
                disabled={page >= pageCount}
                onClick={() => setPage((p) => Math.min(pageCount, p + 1))}
                className={`rounded-lg px-3 py-1.5 ring-1 transition-colors ${
                  isDark ? 'text-white/80 ring-white/15 hover:bg-white/10' : 'text-slate-700 ring-slate-200 hover:bg-slate-50'
                } disabled:opacity-40 disabled:cursor-not-allowed`}
              >Next</button>
            </div>
          </div>
        )}
      </div>

      {(modal === 'create' || modal === 'edit') && (
        <UserFormModal
          isDark={isDark}
          mode={modal}
          form={form}
          setForm={setForm}
          err={err}
          saving={saving}
          onClose={closeModal}
          onSubmit={modal === 'create' ? handleCreate : handleUpdate}
          isSelf={modal === 'edit' && me?._id === selected?._id}
          labelCls={labelCls}
          inputCls={inputCls}
          textColor={textColor}
          subText={subText}
        />
      )}
    </AdminLayout>
  );
}

function UserFormModal({ isDark, mode, form, setForm, err, saving, onClose, onSubmit, isSelf, labelCls, inputCls, textColor, subText }) {
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const isCreate = mode === 'create';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm px-4 py-6"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className={`relative w-full max-w-xl rounded-3xl p-6 ring-1 shadow-2xl max-h-[90vh] overflow-y-auto ${
        isDark ? 'bg-slate-900 ring-white/10' : 'bg-white ring-slate-200'
      }`}>
        <div className="flex items-start justify-between mb-5">
          <div>
            <h3 className={`text-lg font-bold ${textColor}`}>{isCreate ? 'Add new user' : 'Edit user'}</h3>
            <p className={`text-xs mt-0.5 ${subText}`}>
              {isCreate ? 'Set initial credentials and role' : 'Email cannot be changed. Leave password blank to keep it.'}
            </p>
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

        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <label className={labelCls}>Full name</label>
              <input className={`${inputCls} w-full`} value={form.name} onChange={(e) => set('name', e.target.value)} required maxLength={100} />
            </div>

            <div className="col-span-2">
              <label className={labelCls}>Email</label>
              <input
                type="email"
                className={`${inputCls} w-full ${!isCreate ? 'opacity-60 cursor-not-allowed' : ''}`}
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                required={isCreate}
                disabled={!isCreate}
              />
            </div>

            <div className="col-span-2">
              <label className={labelCls}>
                Password
                {!isCreate && <span className="normal-case font-normal opacity-70"> (leave blank to keep current)</span>}
              </label>
              <input
                type="password"
                className={`${inputCls} w-full`}
                value={form.password}
                onChange={(e) => set('password', e.target.value)}
                required={isCreate}
                minLength={isCreate ? 8 : undefined}
                placeholder={isCreate ? 'min 8 characters' : '••••••••'}
              />
            </div>

            <div>
              <label className={labelCls}>Role</label>
              <select
                className={`${inputCls} w-full ${isSelf ? 'opacity-60 cursor-not-allowed' : ''}`}
                value={form.role}
                onChange={(e) => set('role', e.target.value)}
                disabled={isSelf}
                title={isSelf ? 'You cannot change your own role' : undefined}
              >
                {ROLES.map((r) => <option key={r} value={r}>{r}</option>)}
              </select>
            </div>

            {!isCreate && (
              <div>
                <label className={labelCls}>Status</label>
                <select
                  className={`${inputCls} w-full ${isSelf ? 'opacity-60 cursor-not-allowed' : ''}`}
                  value={form.isActive ? 'true' : 'false'}
                  onChange={(e) => set('isActive', e.target.value === 'true')}
                  disabled={isSelf}
                  title={isSelf ? 'You cannot disable your own account' : undefined}
                >
                  <option value="true">Active</option>
                  <option value="false">Disabled</option>
                </select>
              </div>
            )}

            <div>
              <label className={labelCls}>Student/Staff ID</label>
              <input className={`${inputCls} w-full`} value={form.studentId} onChange={(e) => set('studentId', e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Department</label>
              <input className={`${inputCls} w-full`} value={form.department} onChange={(e) => set('department', e.target.value)} />
            </div>

            <div>
              <label className={labelCls}>Phone</label>
              <input className={`${inputCls} w-full`} value={form.phone} onChange={(e) => set('phone', e.target.value)} />
            </div>

            {!isCreate && (
              <div>
                <label className={labelCls}>Date of birth</label>
                <input type="date" className={`${inputCls} w-full`} value={form.dateOfBirth || ''} onChange={(e) => set('dateOfBirth', e.target.value)} />
              </div>
            )}

            {!isCreate && (
              <div className="col-span-2">
                <label className={labelCls}>Chronic conditions <span className="normal-case font-normal opacity-70">(comma-separated)</span></label>
                <input className={`${inputCls} w-full`} value={form.chronicConditions || ''} onChange={(e) => set('chronicConditions', e.target.value)} />
              </div>
            )}
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
            >Cancel</button>
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-gradient-to-r from-brand-500 to-brand-700 px-5 py-2.5 text-sm font-semibold text-white shadow shadow-brand-500/30 hover:opacity-90 disabled:opacity-60 transition-opacity"
            >
              {saving ? 'Saving…' : (isCreate ? 'Create user' : 'Save changes')}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
