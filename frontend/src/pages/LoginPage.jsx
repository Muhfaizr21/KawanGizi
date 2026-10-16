import React, { useState } from 'react'
import Image from 'next/image'
import KawangiziLogo from '@/assets/kawangizi-logo.webp'
import { navigate } from '../App'
import { useAuth } from '../context/AuthContext'
import { homeForRole } from '../lib/api'
import loginArt from '../assets/login-art.png'

export function LoginPage() {
  const { login } = useAuth()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [error, setError] = useState(null)

  const handleSubmit = async (e) => {
    e.preventDefault()
    const targetEmail = email.trim()
    const targetPassword = password

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
            {/* Official KawanGizi Brand Logo */}
            <div className="flex items-center gap-3 mb-4">
              <Image
                src={KawangiziLogo}
                alt="Logo KawanGizi"
                width={48}
                height={48}
                className="object-contain w-auto h-11 sm:h-12"
                priority
              />
              <span className="text-2xl font-black tracking-tight text-gray-900">KawanGizi</span>
            </div>

            {/* Title & Subtitle */}
            <h1 className="text-3xl sm:text-4xl font-bold tracking-tight text-gray-900">
              Masuk
            </h1>
            <p className="text-xs sm:text-sm text-gray-400 font-mono mt-1.5 mb-5">
              Masuk sebagai Super Admin, petugas SPPG, atau Validator.
            </p>

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
          >
            Buat Akun
          </a>
        </p>
      </div>
    </div>
  )
}
