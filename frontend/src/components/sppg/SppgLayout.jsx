import { useState, useEffect, useRef } from 'react'
import {
  LayoutDashboard,
  UtensilsCrossed,
  QrCode,
  Thermometer,
  Truck,
  School,
  ClipboardCheck,
  AlertTriangle,
  ShieldCheck,
  Menu,
  Search,
  Bell,
  LogOut,
  CookingPot,
  Sparkles,
  ChevronRight,
  Calendar,
  Settings,
} from 'lucide-react'

import { navigate } from '../../App'
import { SPPG_PROFILE } from '../../data/sppgPortalData'
import { useAuth } from '../../context/AuthContext'
import { SppgAccountModal } from './SppgAccountModal'

export const SPPG_SIDEBAR_MENU = [
  { id: 'dashboard', label: 'Dashboard Dapur', icon: LayoutDashboard, href: '/sppg' },
  { id: 'recipes', label: 'Rencana Menu', icon: UtensilsCrossed, href: '/sppg/recipes' },
  { id: 'batches', label: 'Batch & Label QR', icon: QrCode, href: '/sppg/batches' },
  { id: 'quality', label: 'Kontrol Mutu HACCP', icon: Thermometer, href: '/sppg/quality' },
  { id: 'logistics', label: 'Armada & Logistik', icon: Truck, href: '/sppg/logistics' },
  { id: 'schools', label: 'Sekolah Binaan', icon: School, href: '/sppg/schools' },
  { id: 'handover', label: 'Serah Terima BAST', icon: ClipboardCheck, href: '/sppg/handover' },
  { id: 'incidents', label: 'Insiden & Aduan', icon: AlertTriangle, href: '/sppg/incidents' },
  { id: 'compliance', label: 'Sertifikasi Sanitasi', icon: ShieldCheck, href: '/sppg/compliance' },
]

export function SppgLayout({
  activeMenu = 'dashboard',
  title = 'Dashboard Dapur',
  // Kolom pencarian hanya dirender kalau ada setSearchQuery yang benar-benar
  // mengubah data. Tanpa itu, kotak search adalah kontrol mati.
  searchQuery = '',
  setSearchQuery,
  searchPlaceholder = 'Cari batch, menu, atau sekolah...',
  children,
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState(null)
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isAccountOpen, setIsAccountOpen] = useState(false)
  const notifRef = useRef(null)
  const profileMenuRef = useRef(null)
  const { user, logout } = useAuth()

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const showToast = (msg) => {
    setToastMessage(msg)
  }

  useEffect(() => {
    if (!toastMessage) return
    const timer = setTimeout(() => {
      setToastMessage(null)
    }, 3200)
    return () => clearTimeout(timer)
  }, [toastMessage])

  // Close notif and profile dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) {
        setIsNotifOpen(false)
      }
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setIsProfileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close on ESC
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setIsSidebarOpen(false)
        setIsNotifOpen(false)
        setIsProfileMenuOpen(false)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  return (
    <div className="min-h-screen w-full bg-white text-slate-800 font-sans antialiased flex flex-col lg:flex-row lg:items-start selection:bg-[#23259C] selection:text-white">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-slate-900 text-white px-4 py-3 text-xs shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-bottom-5">
          <span className="h-2 w-2 rounded-full bg-emerald-400" />
          <p className="font-semibold">{toastMessage}</p>
        </div>
      )}

      {/* ====================================================================
          SIDEBAR PORTAL SPPG (DEEP ROYAL INDIGO #23259C)
          Tepi disempitkan (w-52 = 208px) agar ramping, proporsional, dan elegan,
          namun teks tetap berukuran normal, jelas, dan terbaca dengan nyaman.
          ==================================================================== */}
      <aside
        className={`fixed inset-y-0 left-0 z-[70] w-52 bg-[#23259C] text-white flex flex-col justify-between transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:self-start lg:z-30 lg:translate-x-0 lg:transform-none shrink-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } shadow-xl lg:shadow-none overflow-hidden`}
      >
        <div className="flex flex-col h-full overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {/* Top Brand Container */}
          <div className="p-4 pb-3">
            <div className="flex items-center gap-2.5">
              <div className="h-10 w-10 rounded-xl bg-white/10 backdrop-blur-md flex items-center justify-center border border-white/20 shadow-inner shrink-0">
                <CookingPot className="h-5 w-5 text-white" />
              </div>
              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <h2 className="font-extrabold text-base tracking-tight text-white truncate">KawanGizi</h2>
                  <span className="px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-400 text-slate-900">
                    SPPG
                  </span>
                </div>
                <p className="text-white/70 text-xs truncate font-medium">Dapur Sentral</p>
              </div>
            </div>

            {/* Kitchen Profile Pill */}
            <div className="mt-3 p-2.5 rounded-xl bg-white/10 border border-white/10 text-xs">
              <div className="flex items-center justify-between text-white font-bold">
                <span className="truncate">{SPPG_PROFILE.code}</span>
                <span className="h-2 w-2 rounded-full bg-emerald-400" />
              </div>
              <p className="text-[11px] text-white/75 truncate mt-0.5">{SPPG_PROFILE.name}</p>
            </div>
          </div>

          {/* ================================================================
              NAVIGATION LINKS DENGAN LEKUKAN MENYATU (INVERTED FILLET CURVE)
              Tepi disempitkan, teks tetap ukuran normal (text-xs font-bold)
              ================================================================ */}
          <nav className="pl-3 pr-0 py-1.5 space-y-1 flex-1 relative">
            {SPPG_SIDEBAR_MENU.map((item) => {
              const Icon = item.icon
              const isActive = activeMenu === item.id

              if (isActive) {
                return (
                  <div key={item.id} className="relative z-20">
                    {/* Upper Concave Curved Fillet (Inverted Radius) */}
                    <svg
                      className="absolute -top-5 right-0 w-5 h-5 pointer-events-none z-20"
                      viewBox="0 0 20 20"
                      fill="none"
                    >
                      <path d="M20 0 C20 11.046 11.046 20 0 20 L20 20 Z" fill="#ffffff" />
                    </svg>

                    {/* Active Button: Flush with right edge, comfortable normal text */}
                    <button
                      onClick={() => {
                        setIsSidebarOpen(false)
                        if (item.href === '/sppg' || item.href === '/sppg/dashboard') {
                          navigate('/sppg')
                        } else if (item.href === '/sppg/recipes') {
                          navigate('/sppg/recipes')
                        } else if (item.href === '/sppg/batches') {
                          navigate('/sppg/batches')
                        } else if (item.href === '/sppg/quality') {
                          navigate('/sppg/quality')
                        } else if (item.href === '/sppg/logistics') {
                          navigate('/sppg/logistics')
                        } else if (item.href === '/sppg/schools') {
                          navigate('/sppg/schools')
                        } else if (item.href === '/sppg/handover') {
                          navigate('/sppg/handover')
                        } else if (item.href === '/sppg/incidents') {
                          navigate('/sppg/incidents')
                        } else if (item.href === '/sppg/compliance') {
                          navigate('/sppg/compliance')
                        } else {
                          showToast(`Modul ${item.label} sedang dalam tahap integrasi operasional.`)
                        }
                      }}
                      className="w-full flex items-center gap-3 pl-4 pr-3 py-2.5 bg-white text-[#23259C] rounded-l-[28px] rounded-r-none text-xs font-extrabold shadow-[-4px_0_12px_rgba(0,0,0,0.03)] transition-all text-left cursor-pointer relative z-10"
                    >
                      <div className="p-1 rounded-md bg-amber-500/15 text-amber-500 shrink-0">
                        <Icon className="h-4.5 w-4.5" />
                      </div>
                      <span className="truncate text-xs font-extrabold tracking-tight">
                        {item.label}
                      </span>
                    </button>

                    {/* Lower Concave Curved Fillet (Inverted Radius) */}
                    <svg
                      className="absolute -bottom-5 right-0 w-5 h-5 pointer-events-none z-20"
                      viewBox="0 0 20 20"
                      fill="none"
                    >
                      <path d="M0 0 C11.046 0 20 8.954 20 20 L20 0 Z" fill="#ffffff" />
                    </svg>
                  </div>
                )
              }

              return (
                <div key={item.id} className="pr-3">
                  <button
                    onClick={() => {
                      setIsSidebarOpen(false)
                      if (item.href === '/sppg' || item.href === '/sppg/dashboard') {
                        navigate('/sppg')
                      } else if (item.href === '/sppg/recipes') {
                        navigate('/sppg/recipes')
                      } else if (item.href === '/sppg/batches') {
                        navigate('/sppg/batches')
                      } else if (item.href === '/sppg/quality') {
                        navigate('/sppg/quality')
                      } else if (item.href === '/sppg/logistics') {
                        navigate('/sppg/logistics')
                      } else if (item.href === '/sppg/schools') {
                        navigate('/sppg/schools')
                      } else if (item.href === '/sppg/handover') {
                        navigate('/sppg/handover')
                      } else if (item.href === '/sppg/incidents') {
                        navigate('/sppg/incidents')
                      } else if (item.href === '/sppg/compliance') {
                        navigate('/sppg/compliance')
                      } else {
                        showToast(`Modul ${item.label} sedang dalam tahap integrasi operasional.`)
                      }
                    }}
                    className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-white/80 hover:text-white hover:bg-white/10 transition-all text-left cursor-pointer"
                  >
                    <Icon className="h-4.5 w-4.5 shrink-0 text-white/85" />
                    <span className="truncate">{item.label}</span>
                  </button>
                </div>
              )
            })}
          </nav>

          {/* Bottom Actions: Switch to Superadmin & Logout */}
          <div className="p-3.5 pr-4 border-t border-white/10 space-y-1 shrink-0">
            <button
              onClick={() => navigate('/admin')}
              className="w-full flex items-center justify-between px-3 py-2 text-xs font-bold text-white/90 hover:text-white hover:bg-white/10 rounded-xl transition cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-4 w-4 text-amber-300" />
                <span>Pusat Superadmin</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5 text-white/60" />
            </button>

            <button
              onClick={handleLogout}
              className="w-full flex items-center gap-2.5 px-3 py-2 text-xs font-bold text-rose-300 hover:text-rose-100 hover:bg-rose-500/20 rounded-xl transition cursor-pointer"
            >
              <LogOut className="h-4 w-4" />
              <span>Logout Dapur</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Mobile Drawer Backdrop */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/50 backdrop-blur-xs z-[60] lg:hidden"
        />
      )}

      {/* ====================================================================
          MAIN VIEWPORT (EXPANSIVE WHITE CANVAS)
          ==================================================================== */}
      <div className="flex-1 flex flex-col min-w-0 bg-white min-h-screen">
        {/* TOPBAR HEADER: Search on left, Date & Controls on right */}
        <header className="px-6 sm:px-8 py-3.5 sm:py-4 border-b border-slate-100 flex items-center justify-between gap-4 sticky top-0 bg-white/95 backdrop-blur-md z-20">
          {/* Left: Mobile Toggle & Search Bar */}
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-1.5 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition cursor-pointer"
              aria-label="Buka Menu Sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Kolom pencarian hanya tampil kalau memang tersambung ke data */}
            {setSearchQuery && (
              <div className="relative">
                <Search className="absolute left-3.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="search"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label={searchPlaceholder}
                  className="w-56 sm:w-72 lg:w-80 pl-10 pr-4 py-1.5 text-xs rounded-lg bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#23259C] focus:bg-white transition-all"
                />
              </div>
            )}
          </div>

          {/* Right: Date, Status, Notif, and Avatar */}
          <div className="flex items-center gap-3 sm:gap-4">
            {/* Date String */}
            <div className="hidden md:flex items-center gap-1.5 text-xs font-bold text-slate-500">
              <Calendar className="h-4 w-4 text-[#23259C]" />
              <span>Selasa, 29 September 2026</span>
            </div>


            {/* Notification Bell */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setIsNotifOpen((prev) => !prev)}
                className="relative p-2 text-slate-600 hover:text-slate-900 transition rounded-xl hover:bg-slate-100 cursor-pointer"
                aria-label="Notifikasi Dapur"
              >
                <Bell className="h-5 w-5" />
                <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-600 ring-2 ring-white" />
              </button>

              {isNotifOpen && (
                <div className="absolute right-0 mt-2.5 w-80 bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 p-4 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                    <p className="font-extrabold text-xs text-slate-900">Notifikasi Dapur SPPG</p>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      Sistem Normal
                    </span>
                  </div>
                  <div className="py-2.5 space-y-2 text-xs text-slate-600">
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="font-bold text-slate-900 text-xs">Suhu Masak Inti Memenuhi Syarat</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Suhu kuali ayam terukur 78.5°C (&gt;75°C).</p>
                    </div>
                    <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-100">
                      <p className="font-bold text-slate-900 text-xs">4 Armada Bersiap di Loading Dock</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">Jadwal keberangkatan 06:45 WIB.</p>
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsNotifOpen(false)}
                    className="w-full text-center text-xs font-bold text-[#23259C] pt-2 border-t border-slate-100 hover:underline cursor-pointer"
                  >
                    Tutup
                  </button>
                </div>
              )}
            </div>

            {/* Chef / Account Avatar Dropdown */}
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                aria-label="Informasi akun dapur"
                aria-expanded={isProfileMenuOpen}
                aria-haspopup="true"
                className="flex items-center gap-2.5 pl-2 sm:border-l sm:border-slate-200 rounded-xl hover:bg-slate-100/70 transition cursor-pointer p-1 text-left focus:outline-none"
              >
                <div className="h-9 w-9 rounded-2xl bg-[#23259C] text-white flex items-center justify-center font-semibold text-xs shrink-0">
                  {accountInitials(user?.fullName)}
                </div>
                <div className="hidden sm:block text-left leading-tight max-w-[180px]">
                  <p className="text-xs font-extrabold text-slate-900 truncate">
                    {user?.fullName || SPPG_PROFILE.headChef}
                  </p>
                  <p className="text-[11px] text-slate-500 font-medium truncate">
                    Akun SPPG &bull; {user?.sppgId || SPPG_PROFILE.code}
                  </p>
                </div>
              </button>

              {/* Profile Floating Dropdown Menu */}
              {isProfileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden py-1 divide-y divide-slate-100 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3.5 py-2.5 bg-slate-50/70 sm:hidden">
                    <p className="text-xs font-bold text-slate-900 truncate">
                      {user?.fullName || SPPG_PROFILE.headChef}
                    </p>
                    <p className="text-[10px] text-slate-400 truncate">
                      {user?.email || SPPG_PROFILE.code}
                    </p>
                  </div>
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false)
                        setIsAccountOpen(true)
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer text-left"
                    >
                      <Settings className="h-4 w-4 text-slate-400" />
                      <span>Pengaturan Akun</span>
                    </button>
                  </div>
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false)
                        handleLogout()
                      }}
                      className="w-full flex items-center gap-2.5 px-4 py-2.5 text-xs font-semibold text-rose-600 hover:bg-slate-50 transition cursor-pointer text-left"
                    >
                      <LogOut className="h-4 w-4 text-rose-500" />
                      <span>Keluar</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* MAIN BODY DASHBOARD */}
        <main className="p-6 sm:p-7 space-y-5 flex-1">
          {children}
        </main>

        {/* FOOTER */}
        <footer className="bg-white border-t border-slate-100 px-6 sm:px-8 py-3.5 flex flex-col md:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
          <div className="flex items-center gap-2">
            <span className="font-bold text-slate-600">SPPG KAWANGIZI</span>
            <span>&bull;</span>
            <span>KawanGizi Enterprise System &bull; BGN RI</span>
          </div>
          <div className="flex items-center gap-3">
            <span>Standar Higienitas SLHS & Halal</span>
            <span>&bull;</span>
            <span className="text-emerald-700 font-semibold">Cold-Chain Active</span>
          </div>
        </footer>
      </div>

      {isAccountOpen && (
        <SppgAccountModal
          onClose={() => setIsAccountOpen(false)}
          onProfileUpdated={() => showToast('Nama dapur berhasil diperbarui.')}
        />
      )}
    </div>
  )
}

function accountInitials(name) {
  const parts = String(name || 'SPPG').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return 'SP'
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[1][0]).toUpperCase()
}
