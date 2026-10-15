import { useState, useEffect, useRef } from 'react'
import {
  LayoutDashboard,
  ScanLine,
  ClipboardCheck,
  AlertTriangle,
  History,
  LogOut,
  Menu,
  X,
  Bell,
  CheckCircle2,
  Info,
  Search,
  Mail,
  Settings,
  HelpCircle,
  Smartphone,
  ChevronRight,
  ExternalLink,
  Building2,
  ChevronDown,
} from 'lucide-react'

import { navigate } from '../../App'
import { useAuth } from '../../context/AuthContext'
import { getSelectedSchool, setSelectedSchool } from '../../lib/validatorSchool'
import { SchoolSwitcherModal } from '../validator/SchoolSwitcherModal'
import { ValidatorAccountModal } from './ValidatorAccountModal'
import { MobileBottomNav } from './MobileBottomNav'

export const VALIDATOR_SIDEBAR_MENU = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/validator' },
  { id: 'foodscan', label: 'Scan Hidangan', icon: ScanLine, href: '/validator/foodscan', badge: 'AI' },
  { id: 'handover', label: 'Serah Terima', icon: ClipboardCheck, href: '/validator/handover' },
  { id: 'history', label: 'Riwayat & Presensi', icon: History, href: '/validator/history' },
  { id: 'incidents', label: 'Lapor Insiden', icon: AlertTriangle, href: '/validator/incidents', badge: 'Siaga' },
]

export const VALIDATOR_GENERAL_MENU = [
  { id: 'settings', label: 'Pengaturan Akun', icon: Settings, href: '/dashboard/pengaturan' },
  { id: 'help', label: 'Panduan & SOP', icon: HelpCircle, href: '/fitur' },
]

const VALIDATOR_NOTIFICATIONS = [
  {
    id: 'v-notif-1',
    title: 'Armada B-9102 PQA Menuju Sekolah',
    desc: 'Estimasi tiba 07:10 WIB di gerbang SDN 01 Menteng Pagi. Siapkan ruang serah terima.',
    time: '5 menit lalu',
    urgency: 'info',
    href: '/validator',
    read: false,
  },
  {
    id: 'v-notif-2',
    title: 'BOK-01-4419 Ditolak Sistem (Skor 72.5%)',
    desc: 'Indikasi titik jamur & benda asing. Boks dikunci, sampel diamankan, tiket INS/JKT terbuka.',
    time: '12 menit lalu',
    urgency: 'warning',
    href: '/validator/incidents',
    read: false,
  },
  {
    id: 'v-notif-3',
    title: 'BAST Resmi BAST-JKT/005 Terbit',
    desc: 'Salinan BAST berhasil ditandatangani dan disinkronkan ke Dapur SPPG & Satgas KawanGizi.',
    time: '1 jam lalu',
    urgency: 'success',
    href: '/validator/handover',
    read: true,
  },
]

/**
 * Donezo Design System: Validator Portal Layout
 * Canvas putih melayang dengan sudut membulat 32px, sidebar bersih terstruktur
 * (Menu + General + Promo Card), pill search bar dengan keyboard chip (⌘F),
 * avatar profil elegan, dan tombol aksi Donezo hijau botol (#185338).
 */
export function ValidatorLayout({
  activeMenu = 'dashboard',
  title = 'Dashboard Validator',
  subtitle = 'Pemantauan distribusi pangan, hitung mundur HACCP 4 jam & kepatuhan mutu sekolah.',
  children,
  primaryAction,
  secondaryAction,
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [isSearchFocused, setIsSearchFocused] = useState(false)
  const [searchQuery, setSearchQuery] = useState('')
  const [notifications, setNotifications] = useState(VALIDATOR_NOTIFICATIONS)
  const [toastMessage, setToastMessage] = useState(null)
  const notifRef = useRef(null)
  const profileMenuRef = useRef(null)
  const searchInputRef = useRef(null)

  const { user, logout } = useAuth()
  const [activeSchool, setActiveSchool] = useState(() => getSelectedSchool(user))
  const [isSchoolModalOpen, setIsSchoolModalOpen] = useState(false)
  const [isAccountModalOpen, setIsAccountModalOpen] = useState(false)

  // Listen to global school changes from anywhere in the app
  useEffect(() => {
    const handleSchoolChanged = (e) => {
      if (e.detail) {
        setActiveSchool(e.detail)
      }
    }
    window.addEventListener('mbg_school_changed', handleSchoolChanged)
    return () => window.removeEventListener('mbg_school_changed', handleSchoolChanged)
  }, [])
  const initials = (user?.fullName || user?.email || 'VA')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join('')

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  useEffect(() => {
    if (!toastMessage) return
    const t = setTimeout(() => setToastMessage(null), 3200)
    return () => clearTimeout(t)
  }, [toastMessage])

  useEffect(() => {
    const handler = (e) => {
      if (notifRef.current && !notifRef.current.contains(e.target)) setIsNotifOpen(false)
      if (profileMenuRef.current && !profileMenuRef.current.contains(e.target)) {
        setIsProfileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  useEffect(() => {
    const onKey = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setIsSidebarOpen(false)
        setIsNotifOpen(false)
        setIsProfileMenuOpen(false)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  const handleNotifClick = (notif) => {
    setNotifications((prev) => prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n)))
    setIsNotifOpen(false)
    if (notif.href) navigate(notif.href)
  }

  return (
    <div className="min-h-screen bg-[#F0F2F4] text-slate-900 font-sans antialiased p-2 sm:p-4 lg:p-5 flex flex-col justify-between selection:bg-[#185338] selection:text-white">
      {toastMessage && (
        <div className="fixed bottom-20 sm:bottom-6 right-6 z-[90] flex items-center gap-3 rounded-full bg-[#185338] text-white px-5 py-3 text-xs font-semibold shadow-2xl animate-in fade-in slide-in-from-bottom-5">
          <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
          <p>{toastMessage}</p>
        </div>
      )}

      {/* Main Donezo Floating Canvas Container */}
      <div className="bg-white rounded-[24px] sm:rounded-[32px] shadow-[0_4px_25px_rgba(0,0,0,0.03)] border border-slate-200/70 overflow-hidden lg:overflow-visible flex flex-col lg:flex-row lg:items-start flex-1 min-h-[92vh]">
        {/* Sidebar */}
        <aside
          className={`fixed inset-y-0 left-0 z-[70] w-64 bg-white border-r border-slate-100 flex flex-col justify-between transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:self-start lg:z-10 lg:translate-x-0 shrink-0 lg:rounded-tl-[32px] lg:rounded-bl-[32px] ${
            isSidebarOpen ? 'translate-x-0 shadow-2xl' : '-translate-x-full lg:translate-x-0'
          }`}
        >
          <div className="flex flex-col h-full overflow-y-auto p-5 sm:p-6 justify-between [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
            <div>
              {/* Donezo Style Logo Brand */}
              <div className="flex items-center gap-2.5 pb-7 pt-1">
                <div className="relative flex items-center justify-center">
                  <div className="h-9 w-9 rounded-full border-[3px] border-[#185338] flex items-center justify-center bg-white shadow-xs">
                    <div className="h-3.5 w-3.5 rounded-full bg-[#185338]" />
                  </div>
                  <div className="absolute -bottom-0.5 -right-0.5 h-3 w-3 rounded-full bg-emerald-400 border-2 border-white" />
                </div>
                <div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-xl font-black tracking-tight text-slate-900">KawanGizi</span>
                    <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800 bg-emerald-50 px-1.5 py-0.5 rounded-md border border-emerald-200">
                      VALIDATOR
                    </span>
                  </div>
                  <p className="text-[10px] font-semibold text-slate-400 tracking-tight">Sistem Skrining & Nutrisi</p>
                </div>
              </div>

              {/* MENU Section */}
              <div className="space-y-1">
                <p className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">MENU</p>
                {VALIDATOR_SIDEBAR_MENU.map((item) => {
                  const Icon = item.icon
                  const isActive = activeMenu === item.id
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setIsSidebarOpen(false)
                        navigate(item.href)
                      }}
                      className={`relative w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl text-xs font-bold transition-all text-left group cursor-pointer ${
                        isActive
                          ? 'bg-slate-100 text-slate-900 font-extrabold'
                          : 'text-slate-500 hover:text-slate-900 hover:bg-slate-50/80'
                      }`}
                    >
                      {isActive && (
                        <span className="absolute left-0 top-2 bottom-2 w-1.5 rounded-r-full bg-[#185338]" />
                      )}
                      <div className="flex items-center gap-3 min-w-0">
                        <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-[#185338]' : 'text-slate-400 group-hover:text-slate-600'}`} />
                        <span className="truncate">{item.label}</span>
                      </div>
                      {item.badge && (
                        <span
                          className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                            isActive
                              ? 'bg-[#185338] text-white'
                              : 'bg-slate-100 text-slate-600 group-hover:bg-slate-200'
                          }`}
                        >
                          {item.badge}
                        </span>
                      )}
                    </button>
                  )
                })}
              </div>

              {/* GENERAL Section */}
              <div className="mt-7 space-y-1">
                <p className="px-3 text-[10px] font-extrabold uppercase tracking-wider text-slate-400 mb-2">GENERAL</p>
                {VALIDATOR_GENERAL_MENU.map((item) => {
                  const Icon = item.icon
                  const isActive = activeMenu === item.id || (item.id === 'settings' && (activeMenu === 'settings' || activeMenu === 'profile'))
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        setIsSidebarOpen(false)
                        navigate(item.href)
                      }}
                      className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs transition-all text-left cursor-pointer ${
                        isActive
                          ? 'bg-[#185338] text-white font-bold shadow-xs'
                          : 'font-semibold text-slate-500 hover:text-slate-900 hover:bg-slate-50/80'
                      }`}
                    >
                      <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-400'}`} />
                      <span>{item.label}</span>
                    </button>
                  )
                })}

                <button
                  type="button"
                  onClick={handleLogout}
                  className="w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-xs font-bold text-slate-500 hover:text-rose-600 hover:bg-rose-50/60 transition-colors cursor-pointer"
                >
                  <LogOut className="h-4.5 w-4.5 shrink-0 text-slate-400" />
                  <span>Logout</span>
                </button>
              </div>
            </div>

            {/* Bottom Dark App Promo Card (Signature Donezo Dark Green Widget) */}
            <div className="mt-8 relative overflow-hidden rounded-[20px] bg-gradient-to-br from-[#0e3b28] via-[#09261a] to-[#04120c] p-4 text-white shadow-lg">
              {/* Wavy Contour Lines Background */}
              <svg
                className="absolute inset-0 w-full h-full opacity-20 pointer-events-none"
                viewBox="0 0 200 200"
                preserveAspectRatio="none"
              >
                <path d="M-20,60 Q40,140 100,70 T220,110" fill="none" stroke="currentColor" strokeWidth="2.5" />
                <path d="M-20,90 Q40,170 100,100 T220,140" fill="none" stroke="currentColor" strokeWidth="2" />
                <path d="M-20,120 Q40,200 100,130 T220,170" fill="none" stroke="currentColor" strokeWidth="1.5" />
                <path d="M-20,150 Q40,230 100,160 T220,200" fill="none" stroke="currentColor" strokeWidth="1" />
              </svg>

              <div className="relative z-10 space-y-2.5">
                <div className="h-7 w-7 rounded-lg bg-white/15 backdrop-blur-md flex items-center justify-center border border-white/20">
                  <Smartphone className="h-4 w-4 text-emerald-300" />
                </div>
                <div>
                  <h4 className="text-xs font-bold tracking-tight text-white">Mode Cepat Validator</h4>
                  <p className="text-[10px] text-slate-300 leading-tight mt-0.5 opacity-80">
                    PWA kamera & verifikasi offline
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setToastMessage('PWA Mode Siaga Validator telah terpasang di perangkat Anda.')}
                  className="w-full mt-1.5 py-2 rounded-xl bg-[#1d6b47] hover:bg-[#238155] text-white text-[11px] font-bold transition shadow-xs flex items-center justify-center gap-1.5 cursor-pointer"
                >
                  <span>Pasang PWA Siaga</span>
                  <ChevronRight className="h-3 w-3" />
                </button>
              </div>
            </div>
          </div>
        </aside>

        {isSidebarOpen && (
          <div
            onClick={() => setIsSidebarOpen(false)}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-[60] lg:hidden"
          />
        )}

        {/* Main Content Pane */}
        <div className="flex-1 flex flex-col min-w-0 bg-white">
          {/* Topbar */}
          <header className="px-5 sm:px-8 py-4 sm:py-5 border-b border-slate-100 flex items-center justify-between gap-4">
            <div className="flex items-center gap-3 flex-1 max-w-md">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="lg:hidden p-2 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-xl transition"
                aria-label="Buka Menu"
              >
                <Menu className="h-5 w-5" />
              </button>

              {/* Donezo Pill Search Bar */}
              <div
                className={`relative flex items-center w-full rounded-full border transition-all ${
                  isSearchFocused
                    ? 'border-[#185338] bg-white ring-2 ring-[#185338]/10'
                    : 'border-slate-200/80 bg-slate-50/70 hover:bg-slate-50'
                } px-3.5 py-2`}
              >
                <Search className="h-4 w-4 text-slate-400 shrink-0 mr-2" />
                <input
                  ref={searchInputRef}
                  type="text"
                  placeholder="Cari boks nampan, batch SPPG, atau tiket insiden..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  onFocus={() => setIsSearchFocused(true)}
                  onBlur={() => setIsSearchFocused(false)}
                  className="w-full bg-transparent text-xs text-slate-800 placeholder-slate-400 outline-none"
                />
                <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[9px] font-semibold text-slate-400">
                  ⌘F
                </kbd>
              </div>
            </div>

            {/* Right Topbar Actions & User Avatar */}
            <div className="flex items-center gap-2 sm:gap-3 shrink-0">
              {/* Donezo School Switcher Pill Button */}
              <button
                type="button"
                onClick={() => setIsSchoolModalOpen(true)}
                className="group flex items-center gap-2 sm:gap-2.5 px-3 py-1.5 rounded-full border border-slate-200/90 bg-slate-50/90 hover:bg-emerald-50/60 hover:border-emerald-300 transition-all text-left cursor-pointer shadow-2xs"
                title="Klik untuk mengganti sekolah pemantauan nutrisi"
              >
                <div className="h-7 w-7 rounded-full bg-[#185338] text-white flex items-center justify-center shrink-0 shadow-2xs group-hover:scale-105 transition-transform">
                  <Building2 className="h-3.5 w-3.5" />
                </div>
                <div className="leading-tight hidden sm:block">
                  <div className="flex items-center gap-1">
                    <span className="text-[9px] font-extrabold uppercase tracking-wider text-emerald-800">
                      Sekolah Pantau
                    </span>
                    <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  </div>
                  <p className="text-xs font-black text-slate-800 max-w-[130px] md:max-w-[170px] truncate">
                    {activeSchool?.name || 'SDN 01 Menteng Pagi'}
                  </p>
                </div>
                <ChevronDown className="h-3.5 w-3.5 text-slate-400 group-hover:text-emerald-800 shrink-0 transition" />
              </button>

              {/* Mail / Help Button */}
              <button
                type="button"
                onClick={() => setToastMessage('Pusat Bantuan & Tiket WhatsApp KawanGizi siap dihubungi: 0812-9988-7766')}
                className="h-9 w-9 rounded-full border border-slate-200/90 flex items-center justify-center text-slate-600 hover:bg-slate-50 hover:text-slate-900 transition cursor-pointer"
                title="Pesan & Bantuan"
              >
                <Mail className="h-4 w-4" />
              </button>

              {/* Notification Bell */}
              <div className="relative" ref={notifRef}>
                <button
                  type="button"
                  onClick={() => setIsNotifOpen((p) => !p)}
                  className={`h-9 w-9 rounded-full border transition flex items-center justify-center cursor-pointer ${
                    isNotifOpen
                      ? 'border-[#185338] bg-[#185338]/5 text-[#185338]'
                      : 'border-slate-200/90 text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                  }`}
                  aria-label="Pusat Notifikasi"
                >
                  <Bell className="h-4 w-4" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 h-2 w-2 rounded-full bg-rose-500 ring-2 ring-white" />
                  )}
                </button>

                {isNotifOpen && (
                  <div className="absolute right-0 mt-3 w-[320px] sm:w-[360px] bg-white rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="p-4 border-b border-slate-100 bg-slate-50/70 flex items-center justify-between">
                      <div>
                        <h3 className="font-extrabold text-slate-900 text-xs">Pemberitahuan Sistem</h3>
                        <p className="text-[10px] text-slate-400">Armada, hasil pindai & status BAST</p>
                      </div>
                      <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                        {unreadCount} Baru
                      </span>
                    </div>
                    <div className="max-h-[300px] overflow-y-auto divide-y divide-slate-100">
                      {notifications.map((notif) => (
                        <div
                          key={notif.id}
                          onClick={() => handleNotifClick(notif)}
                          className={`p-3.5 flex items-start gap-3 hover:bg-slate-50 transition cursor-pointer ${
                            !notif.read ? 'bg-emerald-50/30' : ''
                          }`}
                        >
                          <div className="p-2 rounded-xl shrink-0 mt-0.5 bg-slate-100 text-slate-700">
                            {notif.urgency === 'success' ? (
                              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                            ) : notif.urgency === 'warning' ? (
                              <AlertTriangle className="h-4 w-4 text-amber-600" />
                            ) : (
                              <Info className="h-4 w-4 text-sky-600" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <p className="text-xs font-bold text-slate-800 leading-snug">{notif.title}</p>
                            <p className="text-[11px] text-slate-500 leading-relaxed mt-0.5 line-clamp-2">
                              {notif.desc}
                            </p>
                            <span className="text-[9px] text-slate-400 mt-1 inline-block font-medium">
                              {notif.time}
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Topbar User Avatar Dropdown */}
              <div className="relative" ref={profileMenuRef}>
                <button
                  type="button"
                  onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                  className="flex items-center gap-2.5 pl-1 sm:pl-2 cursor-pointer group rounded-full hover:bg-slate-50/80 transition-colors pr-1 focus:outline-none"
                  aria-expanded={isProfileMenuOpen}
                  aria-haspopup="true"
                  title="Menu Profil"
                >
                  <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-amber-200 via-emerald-200 to-teal-400 p-[2px] shadow-xs shrink-0 group-hover:scale-105 transition-transform">
                    <div className="h-full w-full rounded-full bg-white flex items-center justify-center text-slate-800 font-extrabold text-xs">
                      {initials}
                    </div>
                  </div>
                  <div className="hidden sm:block text-left leading-tight">
                    <p className="text-xs font-extrabold text-slate-900 tracking-tight group-hover:text-[#185338] transition-colors">
                      {user?.fullName || 'Ibu Siti Aminah, S.Pd.'}
                    </p>
                    <p className="text-[10px] text-slate-400 font-medium truncate max-w-[150px] group-hover:text-emerald-700 transition-colors">
                      Kelola akun & kata sandi
                    </p>
                  </div>
                </button>

                {/* Profile Floating Dropdown Menu */}
                {isProfileMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden py-1 divide-y divide-slate-100 animate-in fade-in slide-in-from-top-2 duration-150">
                    <div className="px-3 py-2 bg-slate-50/60 sm:hidden">
                      <p className="text-xs font-bold text-slate-800 truncate">
                        {user?.fullName || 'Ibu Siti Aminah, S.Pd.'}
                      </p>
                      <p className="text-[10px] text-slate-400 truncate">
                        {user?.email || 'validator@mbg.id'}
                      </p>
                    </div>

                    <div className="py-1">
                      <button
                        type="button"
                        onClick={() => {
                          setIsProfileMenuOpen(false)
                          navigate('/dashboard/pengaturan')
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

          {/* Subheader / Page Title & Actions */}
          <div className="px-5 sm:px-8 pt-5 sm:pt-6 pb-1 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">{title}</h1>
              <p className="text-xs text-slate-400 font-medium mt-1">
                {subtitle || 'Pemantauan distribusi pangan, hitung mundur HACCP 4 jam & kepatuhan mutu sekolah.'}
              </p>
            </div>

            {/* Donezo Top Right Pill Actions */}
            <div className="flex items-center gap-2.5 shrink-0">
              {secondaryAction}
              {primaryAction}
            </div>
          </div>

          {/* Page Body */}
          <main className="px-4 sm:px-6 md:px-8 pt-3 sm:pt-4 pb-6 md:pb-8 space-y-4 sm:space-y-5 flex-1">{children}</main>

          {/* Donezo Footer */}
          <footer className="border-t border-slate-100 px-6 sm:px-8 pt-4 pb-20 md:pb-4 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-400 gap-2 text-center sm:text-left">
            <p className="font-medium">
              &copy; 2026 KawanGizi &middot; Sistem Skrining Kelayakan Pangan & Estimasi Nutrisi AI
            </p>
            <div className="flex items-center gap-3 font-mono text-[10px]">
              <span className="text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
                Sistem Online
              </span>
              <span>v1.2-donezo</span>
            </div>
          </footer>
        </div>
      </div>

      {/* Global School Switcher Modal */}
      <SchoolSwitcherModal
        isOpen={isSchoolModalOpen}
        onClose={() => setIsSchoolModalOpen(false)}
        onSelect={(school) => {
          setActiveSchool(school)
          setSelectedSchool(school)
          setToastMessage(`Sekolah aktif diganti ke: ${school.name}`)
        }}
      />

      {/* Account Info Modal (nama + kata sandi) */}
      {isAccountModalOpen && (
        <ValidatorAccountModal onClose={() => setIsAccountModalOpen(false)} />
      )}

      {/* Fixed Mobile Bottom Navigation Bar (Hidden on md/desktop) */}
      <MobileBottomNav activeMenu={activeMenu} />
    </div>
  )
}
