import { useState } from 'react'
import {
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
  LogOut,
  ArrowLeft,
} from 'lucide-react'
import { ValidatorLayout } from '../../components/layout/ValidatorLayout'
import { useAuth } from '../../context/AuthContext'
import { updateProfile, changePassword } from '../../lib/api'
import { getSelectedSchool } from '../../lib/validatorSchool'
import { navigate } from '../../App'

const ROLE_LABEL = {
  superadmin: 'Super Admin',
  sppg: 'Petugas Dapur SPPG',
  validator: 'Validator Sekolah',
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50/80 px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-medium text-slate-800 placeholder-slate-400 outline-none transition focus:border-[#185338] focus:bg-white focus:ring-2 focus:ring-[#185338]/15'

function initialsOf(name) {
  const parts = String(name || '')
    .trim()
    .split(/\s+/)
    .filter(Boolean)
  if (!parts.length) return 'IS'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}

export function ValidatorSettingsPage() {
  const { user, updateUser, logout } = useAuth()
  const activeSchool = getSelectedSchool(user)

  const [tab, setTab] = useState('account') // 'account' | 'password'

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

  const [loggingOut, setLoggingOut] = useState(false)

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
      setPwError('Kata sandi baru harus berbeda dari kata sandi saat ini.')
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

  const handleLogout = async () => {
    if (loggingOut) return
    setLoggingOut(true)
    try {
      await logout()
      navigate('/login')
    } catch {
      navigate('/login')
    }
  }

  const displayName = profileName || user?.fullName || 'Ibu Siti Aminah, S.Pd.'
  const displayEmail = user?.email || 'validator@sdn01menteng.sch.id'
  const displayRole = ROLE_LABEL[user?.role] || user?.role || 'Validator Sekolah'
  const displayNpsn = user?.npsn || activeSchool?.npsn || '33.210.130'
  const displaySchool = user?.schoolName || activeSchool?.name || 'SDN Menteng 01 Pagi'

  return (
    <ValidatorLayout
      activeMenu="settings"
      title="Pengaturan Akun"
      subtitle="Kelola profil akun petugas validator, keamanan kata sandi & sesi login."
      primaryAction={
        <button
          type="button"
          onClick={() => navigate('/dashboard')}
          className="inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 transition shadow-xs cursor-pointer"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          <span>Kembali ke Dasbor</span>
        </button>
      }
    >
      <div className="w-full max-w-xl mx-auto space-y-4 sm:space-y-5 pb-24 md:pb-12">
        {/* ========================================================================= */}
        {/* HEADER CARD (Identik Desain Referensi: Dark Green Card bg-[#123624]) */}
        {/* ========================================================================= */}
        <div className="rounded-[22px] sm:rounded-[26px] bg-[#123624] text-white p-5 sm:p-6 shadow-md border border-emerald-950/20 relative overflow-hidden">
          <div className="flex items-center gap-3.5 sm:gap-4 relative z-10">
            {/* Avatar Pill / Initial Badge */}
            <div className="h-12 w-12 sm:h-14 sm:w-14 rounded-2xl bg-white/15 border border-white/20 flex items-center justify-center font-black text-base sm:text-lg text-white shrink-0 shadow-inner">
              {initialsOf(displayName)}
            </div>

            {/* User Meta Information */}
            <div className="min-w-0 flex-1">
              <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-emerald-200/80">
                INFORMASI AKUN
              </p>
              <h1 className="text-base sm:text-lg font-extrabold text-white truncate mt-0.5">
                {displayName}
              </h1>
            </div>
          </div>

          {/* Decorative Subtle Ambient Glow */}
          <div className="absolute -top-12 -right-12 w-36 h-36 bg-emerald-500/10 rounded-full blur-2xl pointer-events-none" />
        </div>

        {/* ========================================================================= */}
        {/* TOGGLE TABS (Data Akun vs Ganti Sandi) */}
        {/* ========================================================================= */}
        <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl border border-slate-200/60">
          <button
            type="button"
            onClick={() => setTab('account')}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 sm:py-3 text-xs sm:text-sm font-extrabold transition cursor-pointer select-none ${
              tab === 'account'
                ? 'bg-[#185338] text-white shadow-xs'
                : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <User className="h-4 w-4" />
            <span>Data Akun</span>
          </button>
          <button
            type="button"
            onClick={() => setTab('password')}
            className={`flex items-center justify-center gap-2 rounded-xl py-2.5 sm:py-3 text-xs sm:text-sm font-extrabold transition cursor-pointer select-none ${
              tab === 'password'
                ? 'bg-[#185338] text-white shadow-xs'
                : 'bg-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-200/50'
            }`}
          >
            <KeyRound className="h-4 w-4" />
            <span>Ganti Sandi</span>
          </button>
        </div>

        {/* ========================================================================= */}
        {/* TAB 1: DATA AKUN */}
        {/* ========================================================================= */}
        {tab === 'account' && (
          <div className="space-y-4 sm:space-y-5 animate-in fade-in duration-200">
            {/* Read-Only Account Facts Cards */}
            <div className="space-y-2.5 sm:space-y-3">
              <InfoCard icon={User} label="NAMA AKUN" value={displayName} />
              <InfoCard icon={Mail} label="EMAIL" value={displayEmail} />
              <InfoCard icon={BadgeCheck} label="PERAN" value={displayRole} />
              <InfoCard icon={ShieldCheck} label="NPSN" value={displayNpsn} mono />
              <InfoCard icon={School} label="SEKOLAH INDUK" value={displaySchool} />
            </div>

            {/* Ubah Nama Akun Section */}
            <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-4">
              <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm sm:text-base">
                <UserRoundPen className="h-4.5 w-4.5 text-[#185338]" />
                <span>Ubah Nama Akun</span>
              </div>

              <form onSubmit={handleNameSubmit} className="space-y-3">
                <div className="space-y-1.5">
                  <label htmlFor="settings-name-input" className="text-xs font-bold text-slate-700">
                    Nama Lengkap
                  </label>
                  <input
                    id="settings-name-input"
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contoh: Ibu Siti Aminah, S.Pd."
                    disabled={nameLoading}
                    maxLength={120}
                    className={inputClass}
                  />
                  <p className="text-[11px] text-slate-400">
                    3–120 karakter. Nama ini tampil pada dasbor, riwayat pindai, dan berita acara.
                  </p>
                </div>

                {nameError && <Feedback tone="error" message={nameError} />}
                {nameSuccess && <Feedback tone="success" message={nameSuccess} />}

                <button
                  type="submit"
                  disabled={nameLoading}
                  className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#185338] hover:bg-[#12422c] px-4 py-3 text-xs sm:text-sm font-extrabold text-white transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-xs active:scale-[0.99]"
                >
                  {nameLoading ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <CheckCircle2 className="h-4 w-4" />
                  )}
                  <span>{nameLoading ? 'Menyimpan…' : 'Simpan Nama'}</span>
                </button>
              </form>
            </div>
          </div>
        )}

        {/* ========================================================================= */}
        {/* TAB 2: GANTI SANDI */}
        {/* ========================================================================= */}
        {tab === 'password' && (
          <div className="rounded-2xl border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs space-y-4 animate-in fade-in duration-200">
            <div className="flex items-center gap-2 text-slate-900 font-extrabold text-sm sm:text-base">
              <KeyRound className="h-4.5 w-4.5 text-[#185338]" />
              <span>Keamanan Kata Sandi</span>
            </div>

            <form onSubmit={handlePasswordSubmit} className="space-y-3.5">
              <PasswordField
                id="settings-current-pw"
                label="Kata Sandi Saat Ini"
                value={currentPw}
                onChange={setCurrentPw}
                show={showPw}
                onToggle={() => setShowPw((v) => !v)}
              />
              <PasswordField
                id="settings-new-pw"
                label="Kata Sandi Baru"
                value={newPw}
                onChange={setNewPw}
                show={showPw}
                onToggle={() => setShowPw((v) => !v)}
              />
              <PasswordField
                id="settings-confirm-pw"
                label="Konfirmasi Kata Sandi Baru"
                value={confirmPw}
                onChange={setConfirmPw}
                show={showPw}
                onToggle={() => setShowPw((v) => !v)}
              />

              <p className="text-[11px] text-slate-400">
                Minimal 8 karakter dan berbeda dari kata sandi lama.
              </p>

              {pwError && <Feedback tone="error" message={pwError} />}
              {pwSuccess && <Feedback tone="success" message={pwSuccess} />}

              <button
                type="submit"
                disabled={pwLoading}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-[#185338] hover:bg-[#12422c] px-4 py-3 text-xs sm:text-sm font-extrabold text-white transition disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer shadow-xs active:scale-[0.99]"
              >
                {pwLoading ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <KeyRound className="h-4 w-4" />
                )}
                <span>{pwLoading ? 'Memperbarui…' : 'Perbarui Kata Sandi'}</span>
              </button>
            </form>
          </div>
        )}

        {/* ========================================================================= */}
        {/* LOGOUT BUTTON (Prominent Red Button with functional handleLogout) */}
        {/* ========================================================================= */}
        <div className="pt-2">
          <button
            type="button"
            onClick={handleLogout}
            disabled={loggingOut}
            className="w-full flex items-center justify-center gap-2.5 rounded-2xl border-2 border-rose-500 bg-white hover:bg-rose-50 text-rose-600 font-extrabold text-xs sm:text-sm py-3 sm:py-3.5 transition shadow-xs cursor-pointer active:scale-[0.99] disabled:opacity-60"
          >
            {loggingOut ? (
              <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
            ) : (
              <LogOut className="h-4 w-4 text-rose-600" />
            )}
            <span>{loggingOut ? 'Mengeluarkan akun…' : 'Keluar dari Akun'}</span>
          </button>
        </div>
      </div>
    </ValidatorLayout>
  )
}

function InfoCard({ icon: Icon, label, value, mono = false }) {
  return (
    <div className="flex items-center gap-3.5 rounded-2xl border border-slate-200/80 bg-white p-3.5 sm:p-4 shadow-xs">
      <div className="h-10 w-10 rounded-xl bg-slate-50 border border-slate-200 flex items-center justify-center shrink-0">
        <Icon className="h-5 w-5 text-[#185338]" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[10px] sm:text-[11px] font-bold uppercase tracking-wider text-slate-400">
          {label}
        </p>
        <p className={`text-xs sm:text-sm font-bold text-slate-800 truncate mt-0.5 ${mono ? 'font-mono' : ''}`}>
          {value}
        </p>
      </div>
    </div>
  )
}

function PasswordField({ id, label, value, onChange, show, onToggle }) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={id} className="text-xs font-bold text-slate-700">
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
          className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-400 hover:text-slate-600 cursor-pointer"
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
      className={`flex items-start gap-2 rounded-xl px-3.5 py-2.5 text-xs font-semibold ${
        isError
          ? 'bg-rose-50 text-rose-700 border border-rose-200'
          : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
      }`}
    >
      {isError ? (
        <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />
      ) : (
        <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0" />
      )}
      <span>{message}</span>
    </div>
  )
}

export { ValidatorSettingsPage as PengaturanPage }
export default ValidatorSettingsPage
