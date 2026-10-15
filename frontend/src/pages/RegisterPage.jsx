import React, { useState } from 'react'
import { navigate } from '../App'
import loginArt from '../assets/login-art.png'
import { registerRequest } from '../lib/api'

export function RegisterPage() {
  const [name, setName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [success, setSuccess] = useState('')
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!name.trim() || !email.trim()) {
      setError('Isi nama dan email terlebih dahulu.')
      return
    }
    if (password.length < 8) {
      setError('Kata sandi minimal 8 karakter.')
      return
    }
    if (password !== confirmPassword) {
      setError('Konfirmasi kata sandi tidak sama dengan kata sandi.')
      return
    }
    setError(null)
    setSuccess('')
    setSubmitted(true)
    try {
      await registerRequest({
        fullName: name.trim(),
        email: email.trim(),
        password,
        role: 'validator',
      })
      setSuccess('Akun berhasil dibuat! Anda sudah bisa masuk.')
      setTimeout(() => navigate('/login'), 1200)
    } catch (err) {
      setSubmitted(false)
      setError(err?.message || 'Gagal membuat akun, coba lagi.')
    }
  }

  return (
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
          <div className="w-9 h-9 text-black flex items-center justify-start mb-3">
            <svg width="28" height="28" viewBox="0 0 24 24" fill="currentColor">
              <path d="M7 3L2 14L9 11L14 3H7Z" />
              <path d="M15 11L10 22L17 19L22 11H15Z" />
            </svg>
          </div>

          {/* Title & Subtitle */}
          <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
            Buat Akun
          </h1>
          <p className="text-xs sm:text-sm text-gray-400 font-mono mt-1.5 mb-4">
            Buat akun untuk membuka dasbor contoh KawanGizi
          </p>


          {/* Divider */}
          <div className="relative my-3.5 flex items-center justify-center">
            <div className="w-full border-t border-gray-200"></div>
            <span className="absolute bg-white px-3 text-[11px] uppercase font-mono text-gray-400 tracking-wider">
              OR
            </span>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-3">
            <div>
              <label className="block text-xs sm:text-sm font-mono font-medium text-gray-800 mb-1">
                Nama lengkap
              </label>
              <input
                type="text"
                required
                placeholder="Nama lengkap dan gelar"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-sans rounded-xl border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-900 transition shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-mono font-medium text-gray-800 mb-1">
                Email
              </label>
              <input
                type="email"
                required
                placeholder="nama@instansi.go.id"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-sans rounded-xl border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-900 transition shadow-xs"
              />
            </div>

            <div>
              <label className="block text-xs sm:text-sm font-mono font-medium text-gray-800 mb-1">
                Kata sandi
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  placeholder="Minimal 8 karakter"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  className="w-full pl-4 pr-11 py-2 sm:py-2.5 text-xs sm:text-sm font-sans rounded-xl border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-900 transition shadow-xs"
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

            <div>
              <label className="block text-xs sm:text-sm font-mono font-medium text-gray-800 mb-1">
                Konfirmasi kata sandi
              </label>
              <input
                type={showPassword ? 'text' : 'password'}
                required
                placeholder="Ulangi kata sandi"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                className="w-full px-4 py-2 sm:py-2.5 text-xs sm:text-sm font-sans rounded-xl border border-gray-200 bg-white text-gray-900 placeholder:text-gray-400 focus:outline-none focus:border-gray-900 transition shadow-xs"
              />
              {confirmPassword && confirmPassword !== password && (
                <p className="mt-1.5 text-[11px] text-rose-600">
                  Konfirmasi kata sandi belum sama.
                </p>
              )}
            </div>

            <div className="border-t border-gray-100 pt-3 mt-3">
              <p className="text-[10px] uppercase font-mono text-gray-400 tracking-wider mb-2.5">
                Peran Akun
              </p>

              {/* Peran akun dikunci: pendaftaran publik hanya untuk Validator Sekolah */}
              <div className="flex items-center justify-between gap-3 rounded-xl border border-gray-200 bg-gray-50 px-4 py-3">
                <div className="min-w-0">
                  <p className="text-[10px] uppercase font-mono text-gray-400 tracking-wider">
                    Peran
                  </p>
                  <p className="text-xs sm:text-sm font-mono font-semibold text-gray-900 mt-0.5">
                    Validator Sekolah
                  </p>
                </div>
                <span className="shrink-0 rounded-full border border-gray-200 bg-white px-2.5 py-1 text-[10px] font-mono uppercase tracking-wider text-gray-500">
                  Terkunci
                </span>
              </div>

              <p className="text-[11px] text-gray-500 mt-2">
                Sekolah dipantau dipilih setelah masuk lewat pemilih sekolah.
              </p>
            </div>

            {success && (
              <p role="status" className="text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
                {success}
              </p>
            )}

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
              {submitted ? 'Membuka halaman masuk...' : 'Buat Akun'}
            </button>

            <p className="text-[11px] text-gray-500 text-center">
              Akun Anda menunggu verifikasi oleh pengelola sistem.
            </p>
          </form>
          </div>
        </div>

        {/* Bottom Footer */}
        <p className="shrink-0 pt-2 text-xs sm:text-sm font-mono text-gray-600 lg:ml-12 xl:ml-24">
          Sudah punya akun?
          <a
            href="/login"
            className="ml-1.5 inline-block py-1 font-semibold text-gray-900 underline underline-offset-2 hover:text-black"
          >
            Masuk
          </a>
        </p>
      </div>
    </div>
  )
}
