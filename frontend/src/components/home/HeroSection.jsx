import { useState } from 'react'
import Image from 'next/image'
import heroAuraImg from '../../assets/hero-aura.png'
import KawangiziLogo from '@/assets/kawangizi-logo.webp'
import { useAuth } from '../../context/AuthContext'
import { homeForRole } from '../../lib/api'
import { usePWA } from '../../context/PWAContext'
import { ArrowRight, Smartphone, Download, CheckCircle2, X, Share, ShieldCheck, Zap } from 'lucide-react'

export function HeroSection() {
  const { user } = useAuth()
  const { isInstalled, deferredPrompt, setDeferredPrompt, isIOS } = usePWA()
  const [installing, setInstalling] = useState(false)
  const [showInstallModal, setShowInstallModal] = useState(false)

  const primaryTarget = user ? homeForRole(user.role) : '/login'
  const primaryLabel = user ? 'Buka Dasbor' : 'Mulai Sekarang'

  const handleInstallClick = () => {
    setShowInstallModal(true)
  }

  const handleConfirmInstall = async () => {
    const promptEvent = deferredPrompt || (typeof window !== 'undefined' ? window.__deferredInstallPrompt : null)
    if (!promptEvent) {
      console.error('Install prompt is not available. Either the browser blocked it, it already fired, or PWA criteria (Service Worker/Manifest) are not fully met.')
      alert('Sistem instalasi instan belum siap. Silakan gunakan menu browser (titik tiga) -> Instal Aplikasi.')
      setShowInstallModal(false)
      return
    }

    setInstalling(true)
    try {
      promptEvent.prompt()
      const { outcome } = await promptEvent.userChoice
      console.log(`User interaction outcome: ${outcome}`)
    } catch (err) {
      console.error('[PWA] Install prompt error:', err)
    } finally {
      setInstalling(false)
      setDeferredPrompt?.(null)
      if (typeof window !== 'undefined') {
        window.__deferredInstallPrompt = null
      }
      setShowInstallModal(false)
    }
  }

  return (
    <section id="home" className="relative overflow-hidden bg-white pt-10 pb-4 sm:pt-16 md:pt-20 scroll-mt-24">
      <div className="mx-auto max-w-5xl px-4 sm:px-6 text-center">
        <p className="font-serif text-sm italic text-gray-500 sm:text-lg md:text-xl tracking-wide">
          Sistem Skrining Kelayakan Konsumsi &middot; KawanGizi.
        </p>
        <h1 className="mx-auto mt-3 sm:mt-4 max-w-4xl text-4xl sm:text-7xl md:text-8xl font-black tracking-tight text-gray-900 leading-[1.08] sm:leading-[1.06]">
          Pangan Aman.
          <br />
          Gizi Terjamin.
        </h1>
        <p className="mx-auto mt-4 sm:mt-5 max-w-xl text-xs sm:text-base md:text-lg leading-relaxed text-gray-500 font-normal">
          KawanGizi memadukan Computer Vision YOLOv8 dan arsitektur terdesentralisasi untuk menskrining kelayakan fisik makanan serta mengestimasi kandungan makronutrien secara instan untuk mencegah risiko keracunan pangan dan menjaga mutu nutrisi anak.
        </p>

        {/* CTA Actions: Mulai Sekarang + Functional Instant Install Shortcut */}
        <div className="mt-7 sm:mt-8 flex flex-col sm:flex-row items-stretch sm:items-center justify-center gap-3 sm:gap-4 max-w-sm sm:max-w-md mx-auto">
          <a
            href={primaryTarget}
            className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full bg-gray-900 px-7 py-3.5 text-xs font-bold uppercase tracking-widest text-white shadow-md transition-all hover:bg-black hover:scale-[1.02] active:scale-[0.98]"
          >
            <span>{primaryLabel}</span>
            <ArrowRight className="h-4 w-4" />
          </a>

          {!isInstalled ? (
            <button
              type="button"
              onClick={handleInstallClick}
              disabled={installing}
              className="inline-flex w-full sm:w-auto items-center justify-center gap-2 rounded-full border border-emerald-300 bg-emerald-50 px-6 py-3.5 text-xs font-bold uppercase tracking-widest text-emerald-950 shadow-xs transition-all hover:bg-emerald-100 hover:border-emerald-400 hover:scale-[1.02] active:scale-[0.98] cursor-pointer"
            >
              <Smartphone className="h-4 w-4 text-emerald-700" />
              <span>{installing ? 'Memproses…' : 'Instal Aplikasi'}</span>
              <Download className="h-3.5 w-3.5 text-emerald-700" />
            </button>
          ) : (
            <div className="inline-flex items-center justify-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50/60 px-5 py-3 text-xs font-semibold text-emerald-800">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>Aplikasi Terpasang</span>
            </div>
          )}
        </div>

        {/* Modal Konfirmasi Pemasangan Instan (Modal Pop-up Konfirmasi Install Langsung) */}
        {showInstallModal && (
          <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in duration-200">
            <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 sm:p-7 shadow-2xl border border-slate-100 text-left animate-in slide-in-from-bottom sm:zoom-in-95 duration-200">
              {/* Top Grab Handle on mobile */}
              <div className="flex justify-center -mt-2 mb-3 sm:hidden">
                <div className="h-1 w-10 bg-slate-200 rounded-full" />
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => setShowInstallModal(false)}
                className="absolute top-4 right-4 rounded-full p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                aria-label="Tutup"
              >
                <X className="h-5 w-5" />
              </button>

              {/* App Identity Banner */}
              <div className="flex items-center gap-3.5 pr-8">
                <div className="relative h-14 w-14 rounded-2xl bg-slate-50 border border-slate-200/80 p-2 shrink-0 shadow-sm flex items-center justify-center">
                  <Image
                    src={KawangiziLogo}
                    alt="Logo KawanGizi"
                    width={44}
                    height={44}
                    className="object-contain"
                    priority
                  />
                </div>
                <div>
                  <h3 className="text-base font-bold text-slate-900 leading-snug">
                    Instal Aplikasi KawanGizi?
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">kawangizi.rentgoindonesia.com</p>
                  <div className="mt-1 flex items-center gap-1.5 text-[11px] font-semibold text-emerald-700">
                    <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" />
                    <span>Resmi &bull; Aman &bull; 4.6 MB</span>
                  </div>
                </div>
              </div>

              {/* Feature Preview Badges */}
              <div className="mt-4 pt-3.5 border-t border-slate-100 grid grid-cols-2 gap-2 text-xs text-slate-700">
                <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <Zap className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="text-[11px] font-medium leading-tight">Buka Instan Tanpa URL</span>
                </div>
                <div className="flex items-center gap-2 p-2 rounded-xl bg-slate-50 border border-slate-100">
                  <Smartphone className="h-4 w-4 text-emerald-600 shrink-0" />
                  <span className="text-[11px] font-medium leading-tight">Hemat Memori HP</span>
                </div>
              </div>

              {/* Fallback Instructions: Rendered IF AND ONLY IF deferredPrompt is null */}
              {!deferredPrompt && (
                <div className="mt-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-xs text-emerald-950 animate-in fade-in duration-150">
                  {isIOS ? (
                    <div>
                      <p className="font-bold flex items-center gap-1.5 text-emerald-900">
                        <Share className="h-4 w-4 text-emerald-700" />
                        Langkah Pasang di iPhone/iPad (Safari):
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-emerald-800">
                        1. Ketuk tombol <strong>Bagikan (Share)</strong> di menu bawah Safari.<br />
                        2. Pilih <strong>Tambahkan ke Layar Utama (Add to Home Screen)</strong>.
                      </p>
                    </div>
                  ) : (
                    <div>
                      <p className="font-bold flex items-center gap-1.5 text-emerald-900">
                        <Download className="h-4 w-4 text-emerald-700" />
                        Langkah Pasang di Chrome/Android:
                      </p>
                      <p className="mt-1 text-[11px] leading-relaxed text-emerald-800">
                        1. Ketuk menu titik tiga (<strong>⋮</strong>) di pojok kanan atas.<br />
                        2. Pilih <strong>"Instal aplikasi"</strong> atau <strong>"Tambahkan ke Layar Utama"</strong>.
                      </p>
                    </div>
                  )}
                </div>
              )}

              {/* Action Buttons: Batal & Pasang Sekarang */}
              <div className="mt-5 flex items-center gap-2.5">
                <button
                  type="button"
                  onClick={() => setShowInstallModal(false)}
                  className="flex-1 py-3 px-4 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 font-bold text-xs transition cursor-pointer text-center"
                >
                  Batal
                </button>
                <button
                  type="button"
                  onClick={handleConfirmInstall}
                  disabled={installing}
                  className="flex-2 py-3 px-5 rounded-xl bg-[#123624] hover:bg-[#1a4a32] active:scale-98 text-white font-bold text-xs shadow-md shadow-emerald-950/20 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
                >
                  <Download className="h-4 w-4 text-emerald-300" />
                  <span>{installing ? 'Memproses…' : 'Pasang Sekarang'}</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Hero Visual: Centered Hand + Phone with Ambient Glowing Aura */}
      <div className="relative mx-auto mt-2 sm:mt-4 w-full max-w-5xl px-4 select-none">
        <img
          src={heroAuraImg}
          alt="Tangan memegang iPhone menampilkan antarmuka pemindaian visual kelayakan makanan KawanGizi"
          className="w-full object-contain mx-auto"
          loading="eager"
        />
      </div>
    </section>
  )
}
