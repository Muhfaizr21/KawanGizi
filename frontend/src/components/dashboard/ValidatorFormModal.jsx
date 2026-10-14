import { useEffect, useState } from 'react'
import {
  X,
  Loader2,
  CheckCircle2,
  AlertCircle,
  UserPlus,
  UserCog,
  KeyRound,
  Eye,
  EyeOff,
  School,
  Mail,
  ShieldCheck,
  Building2,
} from 'lucide-react'
import { createValidator, updateValidator, updateValidatorCredentials, fetchSchools, fetchSppgList } from '../../lib/api'

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-xs font-medium text-slate-800 placeholder-slate-400 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/15'
const labelClass = 'text-[11px] font-bold text-slate-600'

const DEFAULT_ROLE = 'Penanggung Jawab MBG Sekolah'

const CERT_OPTIONS = [
  'Sertifikasi Higienitas Dasar (BNSP)',
  'Sertifikasi HACCP Lanjutan',
  'Dispensasi',
]

/**
 * Modal pusat akun validator untuk superadmin (/admin/validators).
 * `validator` kosong = mode tambah; terisi = mode edit (identitas + kredensial).
 */
export function ValidatorFormModal({ validator = null, onClose, onSaved }) {
  const isEdit = Boolean(validator)

  const [schools, setSchools] = useState([])
  const [schoolsLoading, setSchoolsLoading] = useState(true)
  const [sppgs, setSppgs] = useState([])
  const [sppgsLoading, setSppgsLoading] = useState(true)

  const [fullName, setFullName] = useState(validator?.name || '')
  const [email, setEmail] = useState(validator?.email || '')
  const [sppgId, setSppgId] = useState(validator?.sppgId || '')
  const [npsn, setNpsn] = useState(validator?.npsn || '')
  const [satgasId, setSatgasId] = useState(validator?.satgasId || '')
  const [nip, setNip] = useState(validator?.nip || '')
  const [role, setRole] = useState(validator?.role || DEFAULT_ROLE)
  const [certification, setCertification] = useState(validator?.certification || '')

  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPw, setShowPw] = useState(false)

  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    let cancelled = false
    fetchSchools()
      .then((list) => {
        if (!cancelled) setSchools(Array.isArray(list) ? list : [])
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSchoolsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    let cancelled = false
    fetchSppgList()
      .then((list) => {
        if (!cancelled) setSppgs(Array.isArray(list) ? list : [])
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setSppgsLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Dapur induk efektif: pilihan pengguna, atau (mode edit) dapur dari sekolah
  // yang sudah tertaut lewat NPSN. Hanya sekolah di dapur ini yang boleh dipilih.
  const effectiveSppgId =
    sppgId ||
    (validator?.npsn ? schools.find((s) => s.npsn === validator.npsn)?.sppgId || '' : '')
  const sppgSchools = effectiveSppgId
    ? schools.filter((s) => s.sppgId === effectiveSppgId)
    : []

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape' && !saving) onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose, saving])

  const handleSubmit = async (e) => {
    e.preventDefault()
    setError('')

    if (fullName.trim().length < 3) {
      setError('Nama validator minimal 3 karakter.')
      return
    }
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError('Email tidak valid.')
      return
    }
    if (!effectiveSppgId) {
      setError('Pilih dapur SPPG induk.')
      return
    }
    if (!npsn) {
      setError('Pilih sekolah induk (NPSN) pada dapur terpilih.')
      return
    }

    if (!isEdit) {
      if (password.length < 8) {
        setError('Kata sandi minimal 8 karakter.')
        return
      }
      if (password !== confirmPassword) {
        setError('Konfirmasi kata sandi tidak cocok.')
        return
      }
    } else if (password || confirmPassword) {
      if (password.length < 8) {
        setError('Kata sandi baru minimal 8 karakter.')
        return
      }
      if (password !== confirmPassword) {
        setError('Konfirmasi kata sandi tidak cocok.')
        return
      }
    }

    setSaving(true)
    try {
      const identity = {
        name: fullName.trim(),
        npsn,
        sppgId: effectiveSppgId,
        satgasId: satgasId.trim(),
        nip: nip.trim(),
        role: role.trim() || DEFAULT_ROLE,
        certification: certification.trim(),
      }

      if (!isEdit) {
        const created = await createValidator({
          fullName: fullName.trim(),
          email,
          password,
          npsn,
          sppgId: effectiveSppgId,
          satgasId: satgasId.trim(),
          nip: nip.trim(),
          role: identity.role,
          certification: certification.trim(),
        })
        onSaved?.(created)
        onClose?.()
        return
      }

      await updateValidator(validator.id, {
        ...identity,
        reason: 'Perubahan identitas validator oleh superadmin.',
      })

      const emailChanged = email.trim().toLowerCase() !== (validator.email || '').toLowerCase()
      if (emailChanged || password) {
        await updateValidatorCredentials(validator.id, {
          email,
          newPassword: password,
          reason: 'Pembaruan kredensial login oleh superadmin.',
        })
      }
      onSaved?.(null)
      onClose?.()
    } catch (err) {
      setError(err?.message || 'Gagal menyimpan data validator.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={isEdit ? 'Edit akun validator' : 'Tambah akun validator'}
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[92vh] w-full max-w-xl overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-100 flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-slate-100 bg-gradient-to-r from-slate-900 to-slate-800 text-white flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-10 w-10 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center shrink-0">
              {isEdit ? <UserCog className="h-5 w-5" /> : <UserPlus className="h-5 w-5" />}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/60">
                Pusat Akun Validator
              </p>
              <h3 className="text-sm font-extrabold truncate">
                {isEdit ? `Edit: ${validator?.name || 'Validator'}` : 'Tambah Akun Validator'}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="p-2 rounded-lg text-white/80 hover:text-white hover:bg-white/15 transition cursor-pointer shrink-0"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto p-5 sm:p-6 space-y-5">
          {/* Identitas */}
          <section className="space-y-3">
            <p className="flex items-center gap-2 text-xs font-extrabold text-slate-900">
              <School className="h-4 w-4 text-blue-600" />
              Identitas Validator
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <label htmlFor="vf-name" className={labelClass}>Nama Lengkap &amp; Gelar</label>
                <input
                  id="vf-name"
                  type="text"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Contoh: Ibu Siti Aminah, S.Pd."
                  className={inputClass}
                  maxLength={120}
                  disabled={saving}
                />
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label htmlFor="vf-sppg" className={labelClass}>Dapur SPPG Induk</label>
                <div className="relative">
                  <Building2 className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <select
                    id="vf-sppg"
                    value={effectiveSppgId}
                    onChange={(e) => {
                      setSppgId(e.target.value)
                      setNpsn('')
                    }}
                    className={`${inputClass} pl-9 cursor-pointer`}
                    disabled={saving || sppgsLoading}
                  >
                    <option value="">{sppgsLoading ? 'Memuat dapur…' : 'Pilih dapur SPPG…'}</option>
                    {sppgs.map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name} — {k.code || k.id}{k.city ? ` (${k.city})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5 sm:col-span-2">
                <label htmlFor="vf-school" className={labelClass}>Sekolah Induk (NPSN)</label>
                <div className="relative">
                  <School className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                  <select
                    id="vf-school"
                    value={npsn}
                    onChange={(e) => setNpsn(e.target.value)}
                    className={`${inputClass} pl-9 cursor-pointer`}
                    disabled={saving || schoolsLoading || !effectiveSppgId}
                  >
                    <option value="">
                      {schoolsLoading
                        ? 'Memuat sekolah…'
                        : !effectiveSppgId
                          ? 'Pilih dapur SPPG terlebih dahulu…'
                          : sppgSchools.length === 0
                            ? 'Tidak ada sekolah pada dapur ini'
                            : 'Pilih sekolah…'}
                    </option>
                    {sppgSchools.map((s) => (
                      <option key={s.npsn} value={s.npsn}>
                        {s.name} — {s.npsn}{s.city ? ` (${s.city})` : ''}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="vf-satgas" className={labelClass}>Satgas ID</label>
                <input
                  id="vf-satgas"
                  type="text"
                  value={satgasId}
                  onChange={(e) => setSatgasId(e.target.value)}
                  placeholder="Contoh: BGN-VLD-0042"
                  className={inputClass}
                  maxLength={100}
                  disabled={saving}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="vf-nip" className={labelClass}>NIP / NUPTK</label>
                <input
                  id="vf-nip"
                  type="text"
                  value={nip}
                  onChange={(e) => setNip(e.target.value)}
                  placeholder="Opsional"
                  className={inputClass}
                  maxLength={50}
                  disabled={saving}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="vf-role" className={labelClass}>Peran / Jabatan</label>
                <input
                  id="vf-role"
                  type="text"
                  value={role}
                  onChange={(e) => setRole(e.target.value)}
                  placeholder={DEFAULT_ROLE}
                  className={inputClass}
                  maxLength={100}
                  disabled={saving}
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="vf-cert" className={labelClass}>Sertifikasi Higienitas</label>
                <input
                  id="vf-cert"
                  type="text"
                  list="vf-cert-options"
                  value={certification}
                  onChange={(e) => setCertification(e.target.value)}
                  placeholder="Opsional"
                  className={inputClass}
                  maxLength={255}
                  disabled={saving}
                />
                <datalist id="vf-cert-options">
                  {CERT_OPTIONS.map((c) => (
                    <option key={c} value={c} />
                  ))}
                </datalist>
              </div>
            </div>
          </section>

          <div className="h-px bg-slate-100" />

          {/* Kredensial */}
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-blue-600" />
              <p className="text-xs font-extrabold text-slate-900">Akses Login</p>
            </div>

            <div className="space-y-1.5">
              <label htmlFor="vf-email" className={labelClass}>Email Akun</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400 pointer-events-none" />
                <input
                  id="vf-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="validator@sekolah.id"
                  className={`${inputClass} pl-9`}
                  autoComplete="off"
                  disabled={saving}
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label htmlFor="vf-pw" className={labelClass}>
                  {isEdit ? 'Kata Sandi Baru (opsional)' : 'Kata Sandi'}
                </label>
                <div className="relative">
                  <input
                    id="vf-pw"
                    type={showPw ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder={isEdit ? 'Biarkan kosong bila tidak diubah' : 'Minimal 8 karakter'}
                    className={`${inputClass} pr-10`}
                    autoComplete="new-password"
                    disabled={saving}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPw((v) => !v)}
                    aria-label={showPw ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
                  >
                    {showPw ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="vf-pw2" className={labelClass}>Konfirmasi Kata Sandi</label>
                <input
                  id="vf-pw2"
                  type={showPw ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Ulangi kata sandi"
                  className={inputClass}
                  autoComplete="new-password"
                  disabled={saving}
                />
              </div>
            </div>

            <p className="flex items-start gap-1.5 text-[10px] text-slate-400">
              <ShieldCheck className="h-3.5 w-3.5 mt-px shrink-0" />
              <span>
                {isEdit
                  ? 'Isi kata sandi hanya bila ingin menggantinya. Email dapat diubah kapan saja.'
                  : 'Kata sandi minimal 8 karakter. Akun langsung aktif dan dapat dipakai login.'}
              </span>
            </p>
          </div>

          {error && (
            <div className="flex items-start gap-2 rounded-xl px-3 py-2.5 text-[11px] font-semibold bg-rose-50 text-rose-700 border border-rose-100">
              <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </form>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-4 py-2 rounded-xl border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 transition cursor-pointer disabled:opacity-60"
          >
            Batal
          </button>
          <button
            type="submit"
            onClick={handleSubmit}
            disabled={saving}
            className="flex items-center justify-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-extrabold text-white transition hover:bg-blue-700 disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            {saving ? 'Menyimpan…' : isEdit ? 'Simpan Perubahan' : 'Buat Akun'}
          </button>
        </div>
      </div>
    </div>
  )
}

export default ValidatorFormModal
