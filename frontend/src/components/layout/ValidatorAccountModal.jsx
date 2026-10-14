import { useEffect, useState } from 'react'
import {
  X,
  User,
  KeyRound,
  Loader2,
  CheckCircle2,
  AlertCircle,
  Eye,
  EyeOff,
  ShieldCheck,
  Mail,
  BadgeCheck,
  School,
  UserRoundPen,
} from 'lucide-react'
import { useAuth } from '../../context/AuthContext'
import { updateProfile, changePassword } from '../../lib/api'

const ROLE_LABEL = {
  superadmin: 'Superadmin',
  sppg: 'Dapur SPPG',
  validator: 'Validator Sekolah',
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-xs font-medium text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#185338] focus:bg-white focus:ring-2 focus:ring-[#185338]/15'

function initialsOf(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return 'VA'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function ValidatorAccountModal({ onClose }) {
  const { user, updateUser } = useAuth()

  const [tab, setTab] = useState('account')

  const [profileName, setProfileName] = useState(user?.fullName || '')
  const [name, setName] = useState(user?.fullName || '')
  const [nameLoading, setNameLoading] = useState(false)
  const [nameError, setNameError] = useState('')
  const [nameSuccess, setNameSuccess] = useState('')

  const [currentPw, setCurrentPw] = useState('')
  const [newPw, setNewPw] = useState('')
  const [confirmPw, setConfirmPw] = useState('')
  const [showPw, setShowPw] = useState(false)
  const [pwLoading, setPwLoading] = useState(false)
  const [pwError, setPwError] = useState('')
  const [pwSuccess, setPwSuccess] = useState('')

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleNameSubmit = async (e) => {
    e.preventDefault()
    setNameError('')
    setNameSuccess('')

    const trimmed = name.trim()
    if (trimmed.length < 3) {
      setNameError('Nama minimal 3 karakter.')
      return
    }
    if (trimmed === profileName) {
      setNameError('Nama belum berubah.')
      return
    }

    setNameLoading(true)
    try {
      const data = await updateProfile(trimmed)
      const nextName = data?.user?.fullName || trimmed
      setProfileName(nextName)
      setName(nextName)
      updateUser({ fullName: nextName })
      setNameSuccess('Nama berhasil diperbarui.')
    } catch (err) {
      setNameError(err?.message || 'Gagal memperbarui nama.')
    } finally {
      setNameLoading(false)
    }
  }

  const handlePasswordSubmit = async (e) => {
    e.preventDefault()
    setPwError('')
    setPwSuccess('')

    if (!currentPw) {
      setPwError('Masukkan kata sandi saat ini.')
      return
    }
    if (newPw.length < 8) {
      setPwError('Kata sandi baru minimal 8 karakter.')
      return
    }
    if (newPw !== confirmPw) {
      setPwError('Konfirmasi kata sandi tidak cocok.')
      return
    }
    if (newPw === currentPw) {
      setPwError('Kata sandi baru harus berbeda dari yang lama.')
      return
    }

    setPwLoading(true)
    try {
      await changePassword(currentPw, newPw)
      setPwSuccess('Kata sandi berhasil diperbarui.')
      setCurrentPw('')
      setNewPw('')
      setConfirmPw('')
    } catch (err) {
      setPwError(err?.message || 'Gagal memperbarui kata sandi.')
    } finally {
      setPwLoading(false)
    }
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Informasi akun validator"
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-3 sm:p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-hidden rounded-[26px] bg-white shadow-2xl border border-slate-100 flex flex-col animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="px-6 py-5 border-b border-slate-100 bg-gradient-to-r from-[#0e3b28] to-[#185338] text-white flex items-center justify-between">
          <div className="flex items-center gap-3 min-w-0">
            <div className="h-11 w-11 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center font-black text-sm shrink-0">
              {initialsOf(profileName || user?.fullName)}
            </div>
            <div className="min-w-0">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-white/70">
                Informasi Akun
              </p>
              <h3 className="text-sm font-extrabold truncate">
                {profileName || user?.fullName || 'Validator Sekolah'}
              </h3>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Tutup"
            className="p-2 rounded-xl text-white/80 hover:text-white hover:bg-white/15 transition cursor-pointer shrink-0"
          >
            <X className="h-4.5 w-4.5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="px-4 pt-4 flex items-center gap-2">
          <button
            type="button"
            onClick={() => setTab('account')}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold transition cursor-pointer ${
              tab === 'account'
                ? 'bg-[#185338] text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <User className="h-4 w-4" />
            Data Akun
          </button>
          <button
            type="button"
            onClick={() => setTab('password')}
            className={`flex-1 flex items-center justify-center gap-2 rounded-xl px-3 py-2 text-xs font-extrabold transition cursor-pointer ${
              tab === 'password'
                ? 'bg-[#185338] text-white shadow-sm'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            <KeyRound className="h-4 w-4" />
            Ganti Sandi
          </button>
        </div>

        {/* Body */}
        <div className="max-h-[62vh] overflow-y-auto p-4 sm:p-5 space-y-4">
          {tab === 'account' ? (
            <>
              {/* Account facts */}
              <div className="space-y-2.5">
                <InfoRow icon={User} label="Nama Akun" value={user?.fullName || '—'} />
                <InfoRow icon={Mail} label="Email" value={user?.email || '—'} />
                <InfoRow icon={BadgeCheck} label="Peran" value={ROLE_LABEL[user?.role] || user?.role || '—'} />
                {user?.npsn && <InfoRow icon={ShieldCheck} label="NPSN" value={user.npsn} mono />}
                {user?.schoolName && <InfoRow icon={School} label="Sekolah Induk" value={user.schoolName} />}
              </div>

              <div className="h-px bg-slate-100" />

              {/* Profile name form */}
              <form onSubmit={handleNameSubmit} className="space-y-3">
                <div className="flex items-center gap-2">
                  <UserRoundPen className="h-4 w-4 text-[#185338]" />
                  <p className="text-xs font-extrabold text-slate-900">Ubah Nama Akun</p>
                </div>

                <div className="space-y-1.5">
                  <label htmlFor="validator-name" className="text-[11px] font-bold text-slate-600">
                    Nama Lengkap
                  </label>
                  <input
                    id="validator-name"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Ibu Siti Aminah, S.Pd."
                    disabled={nameLoading}
                    className={inputClass}
                    maxLength={120}
                  />
                  <p className="text-[10px] text-slate-400">
                    3–120 karakter. Nama ini tampil pada dasbor, riwayat pindai, dan berita acara.
                  </p>
                </div>

                {nameError && <Feedback tone="error" message={nameError} />}
                {nameSuccess && <Feedback tone="success" message={nameSuccess} />}

                <button
                  type="submit"
                  disabled={nameLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#185338] px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-[#123f2a] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
                >
                  {nameLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {nameLoading ? 'Menyimpan…' : 'Simpan Nama'}
                </button>
              </form>
            </>
          ) : (
            <form onSubmit={handlePasswordSubmit} className="space-y-3">
              <PasswordField
                id="validator-current-pw"
                label="Kata Sandi Saat Ini"
                value={currentPw}
                onChange={setCurrentPw}
                show={showPw}
                onToggle={() => setShowPw((v) => !v)}
              />
              <PasswordField
                id="validator-new-pw"
                label="Kata Sandi Baru"
                value={newPw}
                onChange={setNewPw}
                show={showPw}
                onToggle={() => setShowPw((v) => !v)}
              />
              <PasswordField
                id="validator-confirm-pw"
                label="Konfirmasi Kata Sandi Baru"
                value={confirmPw}
                onChange={setConfirmPw}
                show={showPw}
                onToggle={() => setShowPw((v) => !v)}
              />

              <p className="text-[10px] text-slate-400">
                Minimal 8 karakter dan berbeda dari kata sandi lama.
              </p>

              {pwError && <Feedback tone="error" message={pwError} />}
              {pwSuccess && <Feedback tone="success" message={pwSuccess} />}

              <button
                type="submit"
                disabled={pwLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#185338] px-4 py-2.5 text-xs font-extrabold text-white transition hover:bg-[#123f2a] disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer"
              >
                {pwLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <KeyRound className="h-4 w-4" />}
                {pwLoading ? 'Memperbarui…' : 'Perbarui Kata Sandi'}
              </button>
            </form>
          )}
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-slate-50/60 flex items-center justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded-full border border-slate-200 text-slate-700 text-xs font-bold hover:bg-slate-100 transition cursor-pointer"
          >
            Tutup
          </button>
        </div>
      </div>
    </div>
  )
}

function InfoRow({ icon: Icon, label, value, mono = false }) {
  return (
    <div className="flex items-center gap-3 rounded-xl border border-slate-100 bg-slate-50/60 px-3.5 py-2.5">
      <div className="h-8 w-8 rounded-lg bg-white border border-slate-200 flex items-center justify-center shrink-0">
        <Icon className="h-4 w-4 text-[#185338]" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wide text-slate-400">{label}</p>
        <p className={`text-xs font-bold text-slate-800 truncate ${mono ? 'font-mono' : ''}`}>{value}</p>
      </div>
    </div>
  )
}

function PasswordField({ id, label, value, onChange, show, onToggle }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-[11px] font-bold text-slate-600">
        {label}
      </label>
      <div className="relative">
        <input
          id={id}
          type={show ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className={`${inputClass} pr-10`}
          autoComplete="off"
        />
        <button
          type="button"
          onClick={onToggle}
          aria-label={show ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
          className="absolute right-2.5 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
        >
          {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
        </button>
      </div>
    </div>
  )
}

function Feedback({ tone, message }) {
  const isError = tone === 'error'
  return (
    <div
      className={`flex items-start gap-2 rounded-xl px-3 py-2.5 text-[11px] font-semibold ${
        isError
          ? 'bg-rose-50 text-rose-700 border border-rose-100'
          : 'bg-emerald-50 text-emerald-700 border border-emerald-100'
      }`}
    >
      {isError ? (
        <AlertCircle className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      ) : (
        <CheckCircle2 className="h-3.5 w-3.5 mt-0.5 shrink-0" />
      )}
      <span>{message}</span>
    </div>
  )
}

export default ValidatorAccountModal
