import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  KeyRound,
  Loader2,
  Mail,
  Pencil,
  Plus,
  ShieldCheck,
  Trash2,
  UserRound,
  X,
} from 'lucide-react'
import {
  createSppgAccount,
  deleteSppgAccount,
  fetchSppgAccounts,
  updateSppgAccount,
  updateSppgAccountCredentials,
} from '../../lib/api'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-800 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15'
const labelClass = 'text-[11px] font-bold text-slate-600'

const STATUS_OPTIONS = [
  { value: 'active', label: 'Aktif' },
  { value: 'pending', label: 'Menunggu Verifikasi' },
  { value: 'blacklisted', label: 'Diblokir' },
]

const STATUS_TONE = {
  active: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  pending: 'bg-amber-50 text-amber-700 border-amber-200',
  blacklisted: 'bg-rose-50 text-rose-700 border-rose-200',
}

const emptyForm = { fullName: '', email: '', password: '', status: 'active' }

/**
 * Manajemen akun login dapur SPPG untuk superadmin.
 * `sppg` adalah dapur (view) yang akunnya sedang dikelola; daftar akun difilter
 * dari seluruh akun pada dapurnya. Mode form berada di dalam modal yang sama.
 */
export function SppgAccountManagerModal({ sppg, onClose, showToast }) {
  const sppgId = sppg?.id || ''

  const [accounts, setAccounts] = useState([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  const [mode, setMode] = useState('list') // 'list' | 'create' | 'edit'
  const [editing, setEditing] = useState(null) // akun yang sedang diedit
  const [form, setForm] = useState(emptyForm)
  const [saving, setSaving] = useState(false)
  const [formError, setFormError] = useState('')
  const [confirmId, setConfirmId] = useState(null)

  const reload = useCallback(async () => {
    try {
      const all = await fetchSppgAccounts()
      setAccounts(all.filter((a) => a.sppgId === sppgId))
      setError(null)
    } catch (err) {
      setError(err?.message || 'Gagal memuat akun SPPG.')
    }
  }, [sppgId])

  useEffect(() => {
    let active = true
    fetchSppgAccounts()
      .then((all) => {
        if (!active) return
        setAccounts(all.filter((a) => a.sppgId === sppgId))
        setError(null)
      })
      .catch((err) => {
        if (active) setError(err?.message || 'Gagal memuat akun SPPG.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [sppgId])

  const startCreate = () => {
    setEditing(null)
    setForm(emptyForm)
    setFormError('')
    setMode('create')
  }

  const startEdit = (account) => {
    setEditing(account)
    setForm({
      fullName: account.fullName || '',
      email: account.email || '',
      password: '',
      status: account.status || 'active',
    })
    setFormError('')
    setMode('edit')
  }

  const cancelForm = () => {
    setMode('list')
    setEditing(null)
    setFormError('')
  }

  const validate = () => {
    if (form.fullName.trim().length < 3) return 'Nama akun minimal 3 karakter.'
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim())) return 'Email tidak valid.'
    if (mode === 'create') {
      if (form.password.length < 8) return 'Kata sandi minimal 8 karakter.'
    } else if (form.password && form.password.length < 8) {
      return 'Kata sandi baru minimal 8 karakter.'
    }
    return ''
  }

  const submit = async (e) => {
    e?.preventDefault()
    const invalid = validate()
    if (invalid) {
      setFormError(invalid)
      return
    }

    setSaving(true)
    setFormError('')
    try {
      if (mode === 'create') {
        await createSppgAccount({
          fullName: form.fullName.trim(),
          email: form.email.trim(),
          password: form.password,
          sppgId,
          status: form.status,
        })
        showToast?.(`[SUKSES] Akun SPPG ${form.fullName.trim()} berhasil dibuat.`, 'success')
      } else {
        await updateSppgAccount(editing.id, {
          fullName: form.fullName.trim(),
          sppgId,
          status: form.status,
          reason: 'Perubahan identitas akun SPPG oleh superadmin.',
        })
        const emailChanged =
          form.email.trim().toLowerCase() !== (editing.email || '').toLowerCase()
        if (emailChanged || form.password) {
          await updateSppgAccountCredentials(editing.id, {
            email: form.email.trim(),
            newPassword: form.password,
            reason: 'Pembaruan kredensial login oleh superadmin.',
          })
        }
        showToast?.(`[SUKSES] Akun ${form.fullName.trim()} berhasil diperbarui.`, 'success')
      }
      setMode('list')
      setEditing(null)
      await reload()
    } catch (err) {
      setFormError(err?.message || 'Gagal menyimpan akun SPPG.')
    } finally {
      setSaving(false)
    }
  }

  const executeDelete = async (account) => {
    try {
      await deleteSppgAccount(account.id)
      setConfirmId(null)
      showToast?.(`[SUKSES] Akun ${account.fullName} berhasil dihapus.`, 'success')
      await reload()
    } catch (err) {
      showToast?.(`[GAGAL] ${err?.message || 'Gagal menghapus akun SPPG.'}`, 'error')
    }
  }

  const sortedAccounts = useMemo(
    () => [...accounts].sort((a, b) => (a.fullName || '').localeCompare(b.fullName || '')),
    [accounts]
  )

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={`Kelola akun SPPG ${sppg?.name || ''}`}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="w-full max-w-2xl max-h-[92vh] flex flex-col rounded-2xl bg-white shadow-2xl border border-slate-200 overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 px-5 py-4 border-b border-slate-100 bg-slate-50/70">
          <div className="min-w-0">
            <p className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-500">
              Pusat Akun Dapur
            </p>
            <h3 className="text-sm font-black text-slate-900 truncate">
              {sppg?.name || 'Dapur SPPG'}
            </h3>
            <p className="text-[11px] text-slate-500 font-mono">
              {sppg?.code || sppgId}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="p-2 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer shrink-0"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto p-5">
          {mode === 'list' ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <p className="text-xs font-bold text-slate-700">
                  {loading ? 'Memuat akun…' : `${sortedAccounts.length} akun login`}
                </p>
                <button
                  type="button"
                  onClick={startCreate}
                  className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-3 py-1.5 text-xs font-bold text-white transition hover:bg-blue-700 cursor-pointer"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Tambah Akun
                </button>
              </div>

              {error && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5 text-[11px] font-semibold text-rose-700">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              {!loading && !error && sortedAccounts.length === 0 && (
                <div className="rounded-xl border border-dashed border-slate-200 px-4 py-8 text-center">
                  <UserRound className="mx-auto h-6 w-6 text-slate-300" />
                  <p className="mt-2 text-xs font-semibold text-slate-600">
                    Belum ada akun login untuk dapur ini.
                  </p>
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    Tekan “Tambah Akun” untuk membuat akses login bagi operator dapur.
                  </p>
                </div>
              )}

              <ul className="space-y-2">
                {sortedAccounts.map((account) => (
                  <li
                    key={account.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="text-xs font-semibold text-slate-900 truncate">
                          {account.fullName}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${
                            STATUS_TONE[account.status] || STATUS_TONE.pending
                          }`}
                        >
                          {STATUS_OPTIONS.find((s) => s.value === account.status)?.label ||
                            account.status}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate">{account.email}</p>
                    </div>

                    {confirmId === account.id ? (
                      <div className="flex items-center gap-1.5 shrink-0">
                        <button
                          type="button"
                          onClick={() => executeDelete(account)}
                          className="rounded-lg bg-rose-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-rose-700 cursor-pointer"
                        >
                          Hapus
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(null)}
                          className="rounded-lg border border-slate-200 px-2.5 py-1.5 text-[11px] font-bold text-slate-600 hover:bg-slate-100 cursor-pointer"
                        >
                          Batal
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          onClick={() => startEdit(account)}
                          aria-label={`Edit akun ${account.fullName}`}
                          className="p-2 rounded-lg text-slate-500 hover:text-blue-700 hover:bg-blue-50 transition cursor-pointer"
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setConfirmId(account.id)}
                          aria-label={`Hapus akun ${account.fullName}`}
                          className="p-2 rounded-lg text-slate-500 hover:text-rose-700 hover:bg-rose-50 transition cursor-pointer"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-4">
              <p className="text-xs font-extrabold text-slate-900">
                {mode === 'create' ? 'Tambah Akun Login Dapur' : `Edit: ${editing?.fullName}`}
              </p>

              <div className="space-y-1.5">
                <label htmlFor="sa-name" className={labelClass}>
                  Nama Penanggung Jawab
                </label>
                <input
                  id="sa-name"
                  type="text"
                  value={form.fullName}
                  onChange={(e) => setForm((f) => ({ ...f, fullName: e.target.value }))}
                  placeholder="Contoh: SPPG 01 Menteng Jaya Mandiri"
                  className={inputClass}
                  maxLength={150}
                  disabled={saving}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="sa-email" className={labelClass}>
                  Email Akun
                </label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <input
                    id="sa-email"
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm((f) => ({ ...f, email: e.target.value }))}
                    placeholder="dapur@sppg01.id"
                    className={`${inputClass} pl-9`}
                    autoComplete="off"
                    disabled={saving}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1.5">
                  <label htmlFor="sa-pw" className={labelClass}>
                    {mode === 'edit' ? 'Kata Sandi Baru (opsional)' : 'Kata Sandi'}
                  </label>
                  <div className="relative">
                    <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                    <input
                      id="sa-pw"
                      type="password"
                      value={form.password}
                      onChange={(e) => setForm((f) => ({ ...f, password: e.target.value }))}
                      placeholder={mode === 'edit' ? 'Kosongkan bila tidak diubah' : 'Minimal 8 karakter'}
                      className={`${inputClass} pl-9`}
                      autoComplete="new-password"
                      disabled={saving}
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="sa-status" className={labelClass}>
                    Status Akun
                  </label>
                  <select
                    id="sa-status"
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value }))}
                    className={`${inputClass} cursor-pointer`}
                    disabled={saving}
                  >
                    {STATUS_OPTIONS.map((s) => (
                      <option key={s.value} value={s.value}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <p className="flex items-start gap-1.5 text-[10px] text-slate-400">
                <ShieldCheck className="h-3.5 w-3.5 mt-px shrink-0" />
                <span>
                  Akun terikat pada dapur <strong>{sppg?.name}</strong>. Perubahan tercatat pada
                  audit log.
                </span>
              </p>

              {formError && (
                <div className="flex items-start gap-2 rounded-xl border border-rose-100 bg-rose-50 px-3 py-2.5 text-[11px] font-semibold text-rose-700">
                  <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
                  <span>{formError}</span>
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-1">
                <button
                  type="button"
                  onClick={cancelForm}
                  disabled={saving}
                  className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-bold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60 cursor-pointer"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {saving ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  {saving ? 'Menyimpan…' : mode === 'create' ? 'Buat Akun' : 'Simpan Perubahan'}
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}

export default SppgAccountManagerModal
