import { useState, useEffect } from 'react'
import Image from 'next/image'
import KawangiziLogo from '@/assets/kawangizi-logo.webp'
import { usePWA } from '../../context/PWAContext'
import { Download, X, Smartphone, CheckCircle2, Share, PlusSquare } from 'lucide-react'

export function InstallPWAPopup({ path = '' }) {
  const { isInstalled, deferredPrompt, setDeferredPrompt, isMobile, isIOS, promptInstall } = usePWA()
  const [isDismissed, setIsDismissed] = useState(false)
  const [isInstalling, setIsInstalling] = useState(false)

  // Check if dismissed in this session
  useEffect(() => {
    try {
      const dismissed = sessionStorage.getItem('kawangi_pwa_prompt_dismissed')
      if (dismissed === 'true') {
        setIsDismissed(true)
      }
    } catch {
      // ignore
    }
  }, [])

  // If already installed, hide completely
  if (isInstalled) {
    return null
  }

  // If user dismissed this session, hide
  if (isDismissed) {
    return null
  }

  // Route filtering: Show on landing page ('/', '/home') or dashboard routes ('/dashboard/*', '/validator/*', '/sppg/*', '/admin/*')
  const currentPath = path || (typeof window !== 'undefined' ? window.location.pathname : '')
  const isLandingPage = currentPath === '/' || currentPath === '/home' || currentPath === ''
  const isDashboardPage =
    currentPath.startsWith('/dashboard') ||
    currentPath.startsWith('/validator') ||
    currentPath.startsWith('/sppg') ||
    currentPath.startsWith('/admin')

  // Only display on target pages (landing page and dashboard)
  if (!isLandingPage && !isDashboardPage) {
    return null
  }

  // Show if deferredPrompt exists OR if mobile/iOS device
  if (!deferredPrompt && !isMobile && !isIOS) {
    return null
  }

  const handleDismiss = () => {
    setIsDismissed(true)
    try {
      sessionStorage.setItem('kawangi_pwa_prompt_dismissed', 'true')
    } catch {
      // ignore
    }
  }

  const handleInstallClick = async () => {
    const promptEvent = deferredPrompt || (typeof window !== 'undefined' ? window.__deferredInstallPrompt : null)
    if (!promptEvent) {
      console.error('Install prompt is not available. Either the browser blocked it, it already fired, or PWA criteria (Service Worker/Manifest) are not fully met.')
      alert('Sistem instalasi instan belum siap. Silakan gunakan menu browser (titik tiga) -> Instal Aplikasi.')
      return
    }

    setIsInstalling(true)
    try {
      promptEvent.prompt()
      const { outcome } = await promptEvent.userChoice
      console.log(`User interaction outcome: ${outcome}`)
    } catch (err) {
      console.error('[PWA] Prompt error:', err)
    } finally {
      setIsInstalling(false)
      setDeferredPrompt?.(null)
      if (typeof window !== 'undefined') {
        window.__deferredInstallPrompt = null
      }
      handleDismiss()
    }
  }

  return (
    <div className="fixed inset-0 z-50 pointer-events-none flex flex-col justify-end p-0 sm:p-5 sm:items-center">
      {/* Dim backdrop on mobile */}
      <div
        onClick={handleDismiss}
        className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs pointer-events-auto transition-opacity"
        aria-hidden="true"
      />

      {/* Bottom Sheet Card */}
      <div
        role="dialog"
        aria-label="Pasang Aplikasi KawanGizi"
        className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl border border-slate-100 p-5 sm:p-6 pointer-events-auto animate-in slide-in-from-bottom duration-300 overflow-hidden"
      >
        {/* Top Handle / Grab Bar for Mobile Sheet Feel */}
        <div className="flex justify-center -mt-2 mb-3 sm:hidden">
          <div className="h-1 w-10 bg-slate-200 rounded-full" />
        </div>

        {/* Decorative Top Accent */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-[#123624] via-emerald-600 to-[#1d6b47]" />

        {/* Close Button */}
        <button
          onClick={handleDismiss}
          type="button"
          aria-label="Tutup popup pemasangan"
          className="absolute top-4 right-4 p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-full transition cursor-pointer"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Brand Logo & Mode Badge Header */}
        <div className="flex items-center justify-between mb-3.5 pr-8">
          <div className="flex items-center gap-2.5">
            <Image
              src={KawangiziLogo}
              alt="Logo KawanGizi"
              width={36}
              height={36}
              className="object-contain w-auto h-8 sm:h-9"
              priority
            />
            <span className="text-lg font-black tracking-tight text-slate-900">KawanGizi</span>
          </div>
          <div className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-emerald-50 text-emerald-800 text-[10px] font-bold uppercase tracking-wider">
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-600 animate-pulse" />
            Mode Siaga PWA
          </div>
        </div>

        {/* Feature Title & Smartphone Icon */}
        <div className="flex items-start gap-3.5 pr-2">
          <div className="h-11 w-11 rounded-2xl bg-gradient-to-br from-[#123624] to-[#1d6b47] flex items-center justify-center shadow-md border border-emerald-500/20 shrink-0">
            <Smartphone className="h-5.5 w-5.5 text-emerald-300" />
          </div>
          <div>
            <h3 className="text-base font-bold text-slate-900 leading-snug">
              Pasang KawanGizi di Layar Utama
            </h3>
            <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">
              Dapatkan pengalaman lebih cepat, ringan, dan akses instan langsung dari ponsel Anda.
            </p>
          </div>
        </div>

        {/* Feature Highlights */}
        <div className="mt-4 pt-3.5 border-t border-slate-100 space-y-2 text-xs text-slate-700">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Skrining makanan & scan QR lebih responsif</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Bisa diakses langsung tanpa membuka bilah browser</span>
          </div>
          <div className="flex items-center gap-2">
            <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0" />
            <span>Hemat kuota & sinkronisasi data lapangan aman</span>
          </div>
        </div>

        {/* Fallback Instructions: Rendered IF AND ONLY IF deferredPrompt is null */}
        {!deferredPrompt && (
          <div className="mt-4 p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200/80 text-xs text-emerald-950 animate-in fade-in duration-150">
            {isIOS ? (
              <div className="space-y-1.5">
                <p className="font-semibold flex items-center gap-1.5 text-emerald-950">
                  <Share className="h-3.5 w-3.5 text-emerald-700" />
                  Petunjuk Safari di iPhone / iPad:
                </p>
                <ol className="list-decimal list-inside space-y-1 text-[11px] text-emerald-800 pl-1">
                  <li>
                    Ketuk tombol <strong>Bagikan (Share)</strong>{' '}
                    <Share className="h-3 w-3 inline text-emerald-700 mx-0.5" /> di menu bawah Safari
                  </li>
                  <li>
                    Gulir ke bawah dan pilih <strong>Tambahkan ke Layar Utama</strong>{' '}
                    <PlusSquare className="h-3 w-3 inline text-emerald-700 mx-0.5" />
                  </li>
                </ol>
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
            onClick={handleDismiss}
            type="button"
            className="flex-1 py-2.5 px-3 rounded-xl border border-slate-200 text-slate-600 hover:text-slate-900 hover:bg-slate-50 font-bold text-xs transition cursor-pointer text-center"
          >
            Batal
          </button>
          <button
            onClick={handleInstallClick}
            disabled={isInstalling}
            type="button"
            className="flex-2 py-2.5 px-4 rounded-xl bg-[#123624] hover:bg-[#1a4a32] active:scale-[0.98] text-white font-bold text-xs shadow-md shadow-emerald-950/15 flex items-center justify-center gap-2 transition cursor-pointer disabled:opacity-60"
          >
            <Download className="h-4 w-4 text-emerald-300" />
            <span>{isInstalling ? 'Memproses…' : 'Pasang Sekarang'}</span>
          </button>
        </div>
      </div>
    </div>
  )
}
