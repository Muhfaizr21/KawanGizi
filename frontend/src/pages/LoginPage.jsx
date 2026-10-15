import React, { useState } from 'react'
import { navigate } from '../App'
import { useAuth } from '../context/AuthContext'
import { homeForRole } from '../lib/api'

const DEMO_ACCOUNTS = [
  {
    role: 'Validator Lapangan',
    desc: 'SDN 01 Menteng Pagi',
    email: 'validator@sdn01menteng.sch.id',
    password: 'Validator123!',
    badgeColor: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  },
  {
    role: 'Dapur Sentral SPPG',
    desc: 'Dapur SPPG-01 Menteng',
    email: 'dapur@sppg01.id',
    password: 'Sppg123!',
    badgeColor: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  {
    role: 'Super Administrator',
    desc: 'Pusat Kontrol & Audit',
    email: 'superadmin@kawangizi.id',
    password: 'SuperAdmin123!',
    badgeColor: 'bg-purple-50 text-purple-800 border-purple-200',
  },
]

export function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e, customEmail, customPassword) => {
    if (e) e.preventDefault()
    const targetEmail = (customEmail ?? email).trim()
    const targetPassword = customPassword ?? password

    if (!targetEmail || !targetPassword) {
      setError('Isi email dan kata sandi terlebih dahulu.')
      return
    }

    setError(null)
    setSubmitted(true)
    try {
      const user = await login(targetEmail, targetPassword)
      navigate(homeForRole(user.role))
    } catch (err) {
      setSubmitted(false)
      if (err.status === 401 || err.status === 404) {
        setError('Akun tidak ditemukan atau kata sandi salah. Periksa kembali email dan kata sandi.')
      } else if (err.status === 403) {
        setError(err.message || 'Role akun ini sudah tidak tersedia. Hubungi Super Admin.')
      } else if (err.status) {
        setError(err.message || 'Login belum bisa diproses. Periksa data akun Anda.')
      } else {
        setError('Tidak bisa terhubung ke server. Periksa koneksi lalu coba lagi.')
      }
    }
  }

  const handleQuickLogin = (acc) => {
    setEmail(acc.email)
    setPassword(acc.password)
    handleSubmit(null, acc.email, acc.password)
  }

  return (
<<<<<<< Updated upstream
    <div className="min-h-screen w-full flex flex-col justify-between bg-slate-50 selection:bg-slate-900 selection:text-white px-4 py-6 sm:py-10">
      {/* Top Bar: Back to Home */}
      <div className="w-full max-w-md mx-auto flex items-center justify-between mb-4">
        <a
          href="/"
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-semibold text-slate-600 hover:text-slate-900 bg-white hover:bg-slate-100 border border-slate-200 shadow-xs transition"
        >
          <span>←</span> Kembali ke Beranda
        </a>
      </div>

      {/* Main Centered Login Card */}
      <div className="w-full max-w-md mx-auto bg-white rounded-2xl border border-slate-200/80 shadow-xl p-6 sm:p-8">
        {/* Brand Header */}
        <div className="flex flex-col items-center text-center mb-6">
          <div className="relative flex items-center justify-center mb-3">
            <div className="h-12 w-12 rounded-full border-[3.5px] border-[#185338] flex items-center justify-center bg-white shadow-xs">
              <div className="h-4 w-4 rounded-full bg-[#185338]" />
            </div>
            <div className="absolute -bottom-0.5 -right-0.5 h-4 w-4 rounded-full bg-emerald-400 border-2 border-white" />
=======
    <div className="relative min-h-[100dvh] w-full bg-white selection:bg-black selection:text-white">
      {/* Artwork Anchored at Top-Right Corner (Pojok Kanan Atas, Pure White Seamless) */}
      <div className="hidden lg:block absolute top-0 right-0 z-0 pointer-events-none select-none overflow-hidden">
        <img
          src={loginArt}
          alt="Halftone Dither Art"
          className="w-[300px] lg:w-[360px] xl:w-[420px] max-h-[62vh] object-contain object-top object-right"
        />
      </div>

      {/* Main Content (Full Height, Pure White, No Scroll) */}
      <div className="relative z-10 flex min-h-[100dvh] w-full flex-col p-6 sm:p-8 lg:p-10 xl:p-12 bg-transparent">
        
        {/* Top Header: Back Button */}
        <div className="flex items-center justify-between w-full shrink-0">
          <a
            href="/"
            className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-mono text-gray-500 hover:text-black hover:bg-gray-100 border border-gray-200 transition duration-150"
          >
            <span>←</span> Kembali ke Beranda
          </a>
        </div>

        {/* Scroll Area: form tetap terjangkau di layar pendek, header & footer tidak terpotong */}
        <div className="flex w-full flex-1 flex-col overflow-y-auto lg:ml-12 xl:ml-24">
          <div className="my-auto w-full max-w-[440px] sm:max-w-[460px] lg:max-w-[480px] py-4 sm:py-6">
          {/* Minimalist Geometric Logo Mark */}
          <div className="w-9 h-9 text-black flex items-center justify-start mb-3.5">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 3L2 14L9 11L14 3H7Z" />
              <path d="M15 11L10 22L17 19L22 11H15Z" />
            </svg>
>>>>>>> Stashed changes
          </div>

          <h1 className="text-2xl font-bold tracking-tight text-slate-900">
            Masuk ke KawanGizi
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mt-1">
            Portal Pemantauan & Validasi Porsi MBG
          </p>
<<<<<<< Updated upstream
        </div>

        {/* Error Alert */}
        {error && (
          <div
            role="alert"
            className="mb-4 text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-xl px-3.5 py-2.5 flex items-start gap-2"
          >
            <span className="text-rose-500 font-bold shrink-0">✕</span>
            <span>{error}</span>
          </div>
        )}

        {/* Form Inputs */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700 mb-1.5">
              Alamat Email
            </label>
            <input
              type="email"
              required
              placeholder="nama@instansi.sch.id"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full px-4 py-2.5 sm:py-3 text-sm rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#185338] focus:border-transparent transition shadow-xs"
            />
          </div>

          <div>
            <div className="flex justify-between items-center mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-slate-700">
                Kata Sandi
              </label>
            </div>
            <div className="relative">
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full pl-4 pr-11 py-2.5 sm:py-3 text-sm rounded-xl border border-slate-200 bg-white text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[#185338] focus:border-transparent transition shadow-xs"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-700 transition"
                aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
              >
                {showPassword ? (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                    />
                  </svg>
                ) : (
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                    />
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth="2"
                      d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                    />
                  </svg>
                )}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={submitted}
            className="w-full mt-2 py-3 bg-[#185338] hover:bg-[#12422c] text-white text-sm font-bold rounded-xl transition duration-150 shadow-md hover:shadow-lg active:scale-[0.99] disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {submitted ? (
              <>
                <svg className="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                </svg>
                <span>Memverifikasi akun…</span>
              </>
            ) : (
              'Masuk ke Akun'
            )}
          </button>
        </form>

        {/* Demo Accounts Quick-Login Card */}
        <div className="mt-6 pt-5 border-t border-slate-100">
          <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-3 text-center">
            Akun Demo / Quick Login
          </p>
          <div className="space-y-2">
            {DEMO_ACCOUNTS.map((acc) => (
              <button
                key={acc.email}
                type="button"
                onClick={() => handleQuickLogin(acc)}
                className="w-full text-left p-2.5 rounded-xl border border-slate-200/80 bg-slate-50/70 hover:bg-slate-100/80 transition flex items-center justify-between group"
              >
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs font-semibold text-slate-900 group-hover:text-emerald-700 transition">
                      {acc.role}
                    </span>
                    <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${acc.badgeColor}`}>
                      Demo
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-500">{acc.desc}</p>
                </div>
                <span className="text-xs font-bold text-emerald-600 group-hover:translate-x-0.5 transition">
                  Pilih →
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Register Hint */}
        <p className="mt-5 text-center text-xs text-slate-500">
          Belum punya akses instansi?{' '}
          <a
            href="/register"
            className="text-slate-900 font-bold hover:underline"
=======


          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs sm:text-sm font-mono font-medium text-gray-800 mb-1.5">
                Email
              </label>
              <input
                type="email"
                required
                placeholder="nama@instansi.go.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2.5 sm:py-3 text-xs sm:text-sm font-sans rounded-xl border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-900 transition shadow-xs"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-1.5">
                <label className="text-xs sm:text-sm font-mono font-medium text-gray-800">
                  Kata sandi
                </label>
                <span
                  className="text-xs font-mono text-gray-500"
                  title="Belum ada layanan pemulihan sandi"
                >
                  Lupa sandi? (belum tersedia)
                </span>
              </div>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Kata sandi"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-4 pr-11 py-2.5 sm:py-3 text-xs sm:text-sm font-sans rounded-xl border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-900 transition shadow-xs"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 transition"
                  aria-label={showPassword ? 'Sembunyikan kata sandi' : 'Tampilkan kata sandi'}
                >
                  {showPassword ? (
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                        d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18"
                      />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4 sm:w-5 sm:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="1.8"
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                  )}
                </button>
              </div>
            </div>

            {error && (
              <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
                {error}
              </p>
            )}

            <button
              type="submit"
              disabled={submitted}
              className="w-full mt-4 py-3 sm:py-3.5 bg-black text-white text-xs sm:text-sm font-mono font-medium rounded-full hover:bg-gray-800 active:scale-[0.99] transition duration-150 shadow-md disabled:opacity-70 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-black"
            >
              {submitted ? 'Membuka dasbor...' : 'Masuk ke Dasbor'}
            </button>

            </form>
          </div>
        </div>

        {/* Bottom Footer */}
        <p className="shrink-0 pt-2 text-xs sm:text-sm font-mono text-gray-600 lg:ml-12 xl:ml-24">
          Belum punya akun?
          <a
            href="/register"
            className="ml-1.5 inline-block py-1 font-semibold text-gray-900 underline underline-offset-2 hover:text-black"
>>>>>>> Stashed changes
          >
            Daftar Akun Baru
          </a>
        </p>
      </div>

      {/* Footer Branding */}
      <div className="text-center text-xs text-slate-400 py-2">
        © 2026 KawanGizi · Program Makan Bergizi Gratis (MBG)
      </div>
    </div>
  )
}
