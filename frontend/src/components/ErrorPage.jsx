import { useState } from 'react'
import { ArrowIcon } from './ui/Icons'
import { navigate } from '../App'

const ERROR_META = {
  400: {
    label: 'Permintaan tidak valid',
    title: 'Permintaan tidak dapat diproses',
    description:
      'Data yang dikirim tidak lengkap atau formatnya tidak sesuai. Periksa kembali isian Anda, lalu coba lagi.',
    channel: 'Permintaan ditolak',
    log: 'payload tidak sesuai skema',
    badge: '400 · DITOLAK',
    right: 'validasi masukan',
  },
  401: {
    label: 'Belum terautentikasi',
    title: 'Sesi Anda telah berakhir',
    description:
      'Halaman ini memerlukan login. Silakan masuk kembali untuk melanjutkan, atau kembali ke beranda.',
    channel: 'Sesi tidak ditemukan',
    log: 'token tidak ada atau kedaluwarsa',
    badge: '401 · UNAUTHORIZED',
    right: 'autentikasi',
  },
  403: {
    label: 'Akses dibatasi',
    title: 'Anda tidak memiliki akses ke halaman ini',
    description:
      'Peran akun Anda tidak diizinkan membuka halaman ini. Bila menurut Anda ini keliru, hubungi admin sekolah atau pengelola dapur.',
    channel: 'Akses ditolak',
    log: 'peran akun tidak mencukupi',
    badge: '403 · FORBIDDEN',
    right: 'kendali akses',
  },
  404: {
    label: 'Tidak ditemukan',
    title: 'Halaman yang Anda cari tidak ada',
    description:
      'Alamat yang dibuka mungkin salah ketik atau halaman sudah dipindahkan. Periksa kembali tautannya.',
    channel: 'Rute tidak ditemukan',
    log: 'rute tidak terdaftar pada tabel navigasi',
    badge: '404 · NOT FOUND',
    right: 'navigasi',
  },
  500: {
    label: 'Kesalahan server',
    title: 'Terjadi gangguan di sisi server',
    description:
      'Permintaan Anda belum dapat diselesaikan. Kejadian ini tercatat otomatis pada log sistem — silakan muat ulang beberapa saat lagi.',
    channel: 'Kesalahan internal',
    log: 'penanganan permintaan gagal',
    badge: '500 · SERVER ERROR',
    right: 'log sistem',
  },
  503: {
    label: 'Layanan tidak tersedia',
    title: 'Layanan sedang dalam pemeliharaan',
    description:
      'Kami tengah melakukan perawatan singkat. Coba kembali beberapa saat lagi — data Anda tetap aman.',
    channel: 'Layanan nonaktif',
    log: 'layanan sementara dimatikan',
    badge: '503 · UNAVAILABLE',
    right: 'pemeliharaan',
  },
}

function metaFor(code) {
  const n = Number(code) || 404
  if (ERROR_META[n]) return ERROR_META[n]
  if (n >= 500) return ERROR_META[500]
  if (n >= 400) return ERROR_META[400]
  return ERROR_META[404]
}

function accentFor(code) {
  return Number(code) >= 500
    ? { dot: 'bg-amber-500', scan: 'bg-amber-400/70', text: 'text-amber-400', eyebrow: 'text-amber-700' }
    : { dot: 'bg-emerald-500', scan: 'bg-emerald-400/80', text: 'text-emerald-400', eyebrow: 'text-emerald-700' }
}

export function ErrorPage({ code = 404, title, description, path, onHome, onRetry, onLogin, homeLabel }) {
  const numeric = Number(code) || 404
  const meta = metaFor(numeric)
  const accent = accentFor(numeric)
  const isServer = numeric >= 500

  const [reference] = useState(
    () => `REF-${numeric}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
  )

  const secondary =
    numeric === 401
      ? { label: 'Masuk kembali', onClick: onLogin || (() => navigate('/login')) }
      : numeric >= 500
        ? { label: 'Muat ulang', onClick: onRetry || (() => window.location.reload()) }
        : numeric === 403
          ? { label: 'Hubungi dukungan', href: 'mailto:kemitraan@kawangizi.id' }
          : null

  return (
    <div className="flex min-h-screen flex-col bg-[#F7F8F6] text-slate-900 selection:bg-slate-900 selection:text-white">
      <header className="border-b border-slate-200/80">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-6 py-5">
          <a
            href="/"
            onClick={(e) => {
              e.preventDefault()
              if (onHome) onHome()
              else navigate('/')
            }}
            className="flex items-center gap-1.5 text-base font-black tracking-tight text-slate-900"
          >
            <span className="text-emerald-600">●</span> KawanGizi
          </a>
          <span className="hidden font-mono text-[11px] uppercase tracking-[0.25em] text-slate-400 sm:block">
            Pusat Kendali Mutu
          </span>
        </div>
      </header>

      <main className="flex flex-1 items-center px-6 py-16 sm:py-20">
        <div className="mx-auto w-full max-w-5xl">
          <div className="grid items-center gap-12 md:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] md:gap-16">
            <div className="relative overflow-hidden rounded-2xl bg-[#0C1210] text-white shadow-xl">
              <div className="flex items-center justify-between border-b border-white/10 px-5 py-3">
                <p className="flex items-center gap-2 font-mono text-[11px] uppercase tracking-widest text-white/70">
                  <span className={`inline-block h-2 w-2 rounded-full ${accent.dot}`} />
                  {meta.channel}
                </p>
                <p className="font-mono text-[11px] text-white/50">http/{numeric}</p>
              </div>

              <div className="relative aspect-[4/3]">
                <div
                  className="pointer-events-none absolute inset-0 opacity-[0.08]"
                  style={{
                    backgroundImage:
                      'linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)',
                    backgroundSize: '26px 26px',
                  }}
                />
                <span className="viewfinder-corner left-4 top-4 border-l-2 border-t-2 border-b-0 border-r-0" />
                <span className="viewfinder-corner right-4 top-4 border-r-2 border-t-2 border-b-0 border-l-0" />
                <span className="viewfinder-corner bottom-4 left-4 border-b-2 border-l-2 border-r-0 border-t-0" />
                <span className="viewfinder-corner bottom-4 right-4 border-b-2 border-r-2 border-l-0 border-t-0" />
                <span
                  className={`scanline pointer-events-none absolute left-4 right-4 h-0.5 ${accent.scan}`}
                  aria-hidden="true"
                />
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="font-mono text-6xl font-black tracking-tight text-white sm:text-7xl">
                    {numeric}
                  </span>
                </div>
              </div>

              <div className="space-y-2 px-5 py-4 font-mono text-xs">
                <p className="text-white/60">&gt; {meta.log}</p>
                <p className="flex items-center justify-between border-t border-white/10 pt-2.5">
                  <span className={`font-bold ${accent.text}`}>{meta.badge}</span>
                  <span className="text-white/70">{meta.right}</span>
                </p>
              </div>
            </div>

            <div className="max-w-md">
              <p className={`font-mono text-[11px] font-semibold uppercase tracking-[0.28em] ${accent.eyebrow}`}>
                {meta.label}
              </p>
              <h1 className="mt-3 text-3xl font-extrabold tracking-tight text-slate-900 sm:text-4xl">
                {title || meta.title}
              </h1>
              <p className="mt-4 text-sm leading-relaxed text-slate-600">{description || meta.description}</p>

              {path && (
                <p className="mt-6 rounded-lg border border-slate-200 bg-white px-3.5 py-2.5 font-mono text-[11px] break-all text-slate-500">
                  <span className="text-slate-400">permintaan</span>{' '}
                  <span className="text-slate-700">{path}</span>
                </p>
              )}

              {isServer && (
                <p className="mt-3 font-mono text-[10px] uppercase tracking-widest text-slate-400">
                  Referensi · {reference}
                </p>
              )}

              <div className="mt-8 flex flex-wrap items-center gap-3">
                <a
                  href="/"
                  onClick={(e) => {
                    e.preventDefault()
                    if (onHome) onHome()
                    else navigate('/')
                  }}
                  className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-6 py-3 text-[11px] font-semibold uppercase tracking-widest text-white transition-all hover:bg-slate-700 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900"
                >
                  {homeLabel || 'Kembali ke beranda'} <ArrowIcon />
                </a>
                {secondary &&
                  (secondary.href ? (
                    <a
                      href={secondary.href}
                      className="inline-flex items-center rounded-full border border-slate-300 bg-white px-6 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-800 transition-all hover:border-slate-900 hover:bg-slate-900 hover:text-white"
                    >
                      {secondary.label}
                    </a>
                  ) : (
                    <button
                      type="button"
                      onClick={secondary.onClick}
                      className="inline-flex items-center rounded-full border border-slate-300 bg-white px-6 py-3 text-[11px] font-semibold uppercase tracking-widest text-slate-800 transition-all hover:border-slate-900 hover:bg-slate-900 hover:text-white"
                    >
                      {secondary.label}
                    </button>
                  ))}
              </div>
            </div>
          </div>
        </div>
      </main>

      <footer className="border-t border-slate-200/80">
        <div className="mx-auto flex max-w-5xl flex-col items-center justify-between gap-2 px-6 py-5 font-mono text-[11px] text-slate-400 sm:flex-row">
          <span>KawanGizi &bull; Skrining Mutu Porsi Nutrisi</span>
          <span className="flex items-center gap-2">
            <span className={`h-1.5 w-1.5 rounded-full ${accent.dot} animate-pulse`} />
            {isServer ? 'Pemantauan status aktif' : 'Sistem berjalan normal'}
          </span>
        </div>
      </footer>
    </div>
  )
}
