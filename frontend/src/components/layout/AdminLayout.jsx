import { useState, useEffect, useRef } from 'react'
import {
  LayoutDashboard,
  Users,
  BookOpen,
  BarChart3,
  CalendarDays,
  ClipboardList,
  Clock,
  Megaphone,
  Download,
  MessageSquare,
  LogOut,
  Search,
  Bell,
  Menu,
  GraduationCap,
  ShieldCheck,
  AlertTriangle,
  CheckCircle2,
  Thermometer,
  ExternalLink,
  X,
  Check,
  CookingPot,
  ChevronRight,
  Settings,
} from 'lucide-react'

import { navigate } from '../../App'
import { useAuth } from '../../context/AuthContext'

const ROLE_LABELS = {
  superadmin: 'Superadmin Satgas MBG',
  sppg: 'Petugas SPPG',
}

// Unified SVG Icons for Admin Layout



































export const ADMIN_SIDEBAR_MENU = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard, href: '/admin' },
  { id: 'validator', label: 'Profil Validator', icon: Users, href: '/admin/validators' },
  { id: 'sppg', label: 'Dapur SPPG', icon: BookOpen, href: '/admin/sppg' },
  { id: 'results', label: 'Hasil Pengiriman', icon: BarChart3, href: '/admin/deliveries' },
  { id: 'attendance', label: 'Penerimaan Siswa', icon: CalendarDays, href: '/admin/attendance' },
  { id: 'schools', label: 'Sekolah Binaan', icon: ClipboardList, href: '/admin/schools' },
  { id: 'schedule', label: 'Jadwal Distribusi', icon: Clock, href: '/admin/schedule' },
  { id: 'notices', label: 'Papan Pengumuman', icon: Megaphone, href: '/admin/notices' },
  { id: 'calendar', label: 'Kalender MBG', icon: CalendarDays, href: '/admin/calendar' },
  { id: 'downloads', label: 'Unduh Laporan', icon: Download, href: '/admin/reports' },
  { id: 'feedback', label: 'Aduan & Feedback', icon: MessageSquare, href: '/admin/feedback' },
]

export const INITIAL_NOTIFICATIONS = [
  {
    id: 'notif-1',
    title: 'Panggilan Darurat: Penarikan Olahan Kerang & Puyuh',
    desc: 'Surat edaran BGN/SE/084/IX/2026 mewajibkan penolakan batch kerang air tawar di klaster Jawa Timur.',
    time: '10 mnt lalu',
    urgency: 'critical',
    category: 'darurat',
    href: '/admin/notices',
    read: false,
  },
  {
    id: 'notif-2',
    title: 'Peringatan Suhu Dingin (Cold-Chain Anomaly)',
    desc: 'Armada B-9281-KBA rute SDN Sukajadi 1 tercatat 54°C (batas aman >60°C). Tim teknis diterjunkan.',
    time: '25 mnt lalu',
    urgency: 'warning',
    category: 'darurat',
    href: '/admin/schedule',
    read: false,
  },
  {
    id: 'notif-3',
    title: 'Tiket Aduan Baru Masuk: SDN 01 Pagi Surabaya',
    desc: 'Validator sekolah melaporkan indikasi sayur sup beraroma masam. Sampel dikirim ke Labkesda.',
    time: '45 mnt lalu',
    urgency: 'warning',
    category: 'aduan',
    href: '/admin/feedback',
    read: false,
  },
  {
    id: 'notif-4',
    title: 'Redistribusi Surplus 45 Porsi Terverifikasi',
    desc: 'Alokasi sisa porsi dari SMPN 4 Surabaya sukses disalurkan ke Panti Asuhan Kasih Bunda.',
    time: '2 jam lalu',
    urgency: 'info',
    category: 'presensi',
    href: '/admin/attendance',
    read: true,
  },
  {
    id: 'notif-5',
    title: 'BAST Digital Diterbitkan & Sah BPKP',
    desc: 'SP2D clearance untuk SPPG Berkah Gizi Mandiri sebesar Rp 18.000.000 telah diotorisasi.',
    time: '3 jam lalu',
    urgency: 'success',
    category: 'laporan',
    href: '/admin/reports',
    read: true,
  },
]

/**
 * Enterprise Admin Layout
 * Clean Code Architecture: Single Responsibility, Centralized Navigation & Responsive Drawer
 */
export function AdminLayout({
  activeMenu = 'dashboard',
  title = 'Dashboard',
  badge = 'LIVE',
  searchQuery = '',
  setSearchQuery,
  searchPlaceholder = 'Cari data...',
  showSearch = true,
  actions = null,
  children,
}) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [toastMessage, setToastMessage] = useState(null)
  const [isNotifOpen, setIsNotifOpen] = useState(false)
  const [isProfileMenuOpen, setIsProfileMenuOpen] = useState(false)
  const [notifFilter, setNotifFilter] = useState('all')
  const [notifications, setNotifications] = useState(INITIAL_NOTIFICATIONS)
  const notifRef = useRef(null)
  const profileMenuRef = useRef(null)

  const { user, logout } = useAuth()
  const initials = (user?.fullName || user?.email || '?')
    .split(/[\s@.]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('')

  const handleLogout = async () => {
    await logout()
    navigate('/login')
  }

  const unreadCount = notifications.filter((n) => !n.read).length

  const filteredNotifications = notifications.filter((n) => {
    if (notifFilter === 'unread') return !n.read
    if (notifFilter === 'darurat') return n.urgency === 'critical' || n.urgency === 'warning'
    return true
  })

  const handleMarkAllAsRead = () => {
    setNotifications((prev) => prev.map((n) => ({ ...n, read: true })))
    showToast('Semua notifikasi telah ditandai sebagai dibaca.')
  }

  const handleNotificationClick = (notif) => {
    setNotifications((prev) =>
      prev.map((n) => (n.id === notif.id ? { ...n, read: true } : n))
    )
    setIsNotifOpen(false)
    if (notif.href) {
      navigate(notif.href)
    }
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

  // Close notif dropdown & profile menu on click outside
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

  // Close sidebar, notif popover, and profile menu on ESC key
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
    <div className="min-h-screen bg-[#F4F7FC] text-slate-800 font-sans antialiased flex flex-col lg:flex-row">
      {/* Toast Notification Container */}
      {toastMessage && (
        <div className="fixed bottom-6 right-6 z-50 flex items-center gap-3 rounded-2xl bg-slate-900 text-white px-4 py-3 text-xs shadow-2xl border border-slate-700 animate-in fade-in slide-in-from-bottom-5">
          <span className="h-2 w-2 rounded-full bg-blue-400" />
          <p className="font-semibold">{toastMessage}</p>
        </div>
      )}

      {/* ====================================================================
          SIDEBAR NAVIGATION
          ==================================================================== */}
      <aside
        className={`fixed inset-y-0 left-0 z-40 w-64 bg-white border-r border-slate-200/80 flex flex-col justify-between transition-transform duration-300 ease-in-out lg:sticky lg:top-0 lg:h-screen lg:z-30 lg:translate-x-0 lg:transform-none shrink-0 ${
          isSidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        } shadow-sm overflow-hidden`}
      >
        <div className="flex flex-col h-full overflow-y-auto [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden">
          {/* Top Blue Hero Card */}
          <div className="bg-gradient-to-b from-[#1E56A0] via-[#2563EB] to-[#1D4ED8] text-white px-5 py-6 rounded-b-[28px] text-center shadow-md relative overflow-hidden shrink-0">
            {/* Subtle glow decorative background accents */}
            <div className="absolute -top-10 -right-10 w-24 h-24 bg-white/10 rounded-full blur-xl pointer-events-none" />
            <div className="absolute -bottom-8 -left-8 w-20 h-20 bg-blue-400/20 rounded-full blur-lg pointer-events-none" />

            <div className="relative z-10">
              <div className="mx-auto h-12 w-12 rounded-2xl bg-white/15 backdrop-blur-md flex items-center justify-center mb-2.5 shadow-inner border border-white/20">
                <GraduationCap className="h-6 w-6 text-white" />
              </div>
              <h2 className="font-extrabold text-lg tracking-tight text-white">KawanGizi</h2>
              <p className="text-blue-100 text-[11px] leading-snug mt-1 font-medium opacity-90">
                Sistem Pengawasan Terpadu<br />Makan Bergizi Gratis
              </p>
            </div>
          </div>

          {/* Navigation Links */}
          <nav className="p-4 space-y-1 flex-1">
            {ADMIN_SIDEBAR_MENU.map((item) => {
              const Icon = item.icon
              const isActive = activeMenu === item.id

              return (
                <button
                  key={item.id}
                  onClick={() => {
                    setIsSidebarOpen(false)
                    if (item.href) {
                      navigate(item.href)
                    } else {
                      showToast(`Menu ${item.label} sedang dalam tahap integrasi`)
                    }
                  }}
                  className={`w-full flex items-center gap-3.5 px-4 py-2.5 rounded-xl text-xs font-semibold transition-all text-left ${
                    isActive
                      ? 'bg-[#2563EB] text-white shadow-md shadow-blue-500/20'
                      : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100/70'
                  }`}
                >
                  <Icon className={`h-4.5 w-4.5 shrink-0 ${isActive ? 'text-white' : 'text-slate-500'}`} />
                  <span className="truncate">{item.label}</span>
                </button>
              )
            })}
          </nav>

          {/* Sidebar Footer Link */}
          <div className="p-4 border-t border-slate-100 shrink-0 space-y-1">
            <button
              onClick={() => navigate('/sppg')}
              className="w-full flex items-center justify-between px-3.5 py-2 text-xs font-bold text-[#23259C] bg-[#23259C]/10 hover:bg-[#23259C]/15 rounded-xl transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2">
                <CookingPot className="h-4 w-4 text-[#23259C]" />
                <span>Portal Dapur SPPG</span>
              </div>
              <ChevronRight className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={handleLogout}
              className="w-full flex items-center gap-3 px-3.5 py-2 text-xs font-bold text-rose-500 hover:text-rose-700 hover:bg-rose-50 rounded-xl transition-colors cursor-pointer"
            >
              <LogOut className="h-4.5 w-4.5 text-rose-500" />
              <span>Keluar</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Backdrop for Mobile Drawer */}
      {isSidebarOpen && (
        <div
          onClick={() => setIsSidebarOpen(false)}
          className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-30 lg:hidden"
        />
      )}

      {/* ====================================================================
          MAIN VIEWPORT
          ==================================================================== */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* UNIFIED TOPBAR HEADER */}
        <header className="bg-white px-4 sm:px-6 py-3 sm:py-3.5 border-b border-slate-200/70 flex items-center justify-between sticky top-0 z-20 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="lg:hidden p-1.5 -ml-1 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition"
              aria-label="Buka Menu Sidebar"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="flex items-center gap-2">
              <h1 className="text-base sm:text-lg font-bold text-slate-900 tracking-tight">
                {title}
              </h1>
              {badge && (
                <span className="hidden sm:inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-blue-50 text-blue-700 font-mono">
                  {badge}
                </span>
              )}
            </div>
          </div>

          {/* Right Header items */}
          <div className="flex items-center gap-3 sm:gap-5">
            {/* Search Pill */}
            {showSearch && setSearchQuery && (
              <div className="relative hidden md:block">
                <Search className="absolute left-3.5 top-2.5 h-3.5 w-3.5 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  className="w-56 lg:w-64 pl-9 pr-4 py-1.5 text-xs rounded-full bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
                />
              </div>
            )}

            {/* Live PostgreSQL status label */}
            <span className="hidden xl:inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-emerald-50 border border-emerald-200 text-[10px] font-mono font-semibold text-emerald-700 shadow-2xs">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
              POSTGRESQL LIVE
            </span>

            {/* Custom Header Actions */}
            {actions}

            {/* Web Link */}
            <a
              href="/"
              className="hidden sm:inline-flex text-[11px] font-semibold text-slate-600 hover:text-blue-600 bg-slate-100 hover:bg-blue-50 px-2.5 py-1 rounded-full transition"
            >
              Web Publik ↗
            </a>

            {/* Notification Bell Dropdown */}
            <div className="relative" ref={notifRef}>
              <button
                type="button"
                onClick={() => setIsNotifOpen((prev) => !prev)}
                className={`relative p-2 text-slate-500 hover:text-slate-800 transition rounded-xl hover:bg-slate-100 cursor-pointer focus-visible:outline-2 focus-visible:outline-blue-600 ${
                  isNotifOpen ? 'bg-blue-50 text-blue-700 ring-2 ring-blue-500/20' : ''
                }`}
                aria-label="Pusat Notifikasi"
                aria-expanded={isNotifOpen}
              >
                <Bell className="h-5 w-5" />
                {unreadCount > 0 && (
                  <span className="absolute top-1.5 right-1.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-rose-600 text-[10px] font-extrabold text-white ring-2 ring-white">
                    {unreadCount}
                  </span>
                )}
              </button>

              {/* Notification Popover Card */}
              {isNotifOpen && (
                <div className="absolute right-0 mt-2.5 w-[330px] sm:w-[380px] bg-white rounded-2xl shadow-2xl border border-slate-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  {/* Header */}
                  <div className="p-3.5 sm:p-4 border-b border-slate-100 bg-slate-50/80 flex items-center justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-extrabold text-slate-900 text-sm">Pusat Notifikasi</h3>
                        {unreadCount > 0 && (
                          <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-100 text-rose-700">
                            {unreadCount} baru
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-500">Telemetri &amp; Peringatan Sistem MBG RI</p>
                    </div>

                    <div className="flex items-center gap-1">
                      {unreadCount > 0 && (
                        <button
                          type="button"
                          onClick={handleMarkAllAsRead}
                          className="text-[11px] font-bold text-blue-600 hover:text-blue-800 hover:underline px-2 py-1 rounded transition cursor-pointer"
                        >
                          Tandai Dibaca
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => setIsNotifOpen(false)}
                        className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-200/50 transition cursor-pointer"
                        aria-label="Tutup"
                      >
                        <X className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Filter Tabs */}
                  <div className="flex items-center gap-1 p-2 bg-slate-100/60 border-b border-slate-100 text-[11px]">
                    <button
                      type="button"
                      onClick={() => setNotifFilter('all')}
                      className={`flex-1 py-1 px-2 rounded-lg font-bold transition text-center cursor-pointer ${
                        notifFilter === 'all'
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-500 hover:text-slate-800'
                      }`}
                    >
                      Semua ({notifications.length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotifFilter('darurat')}
                      className={`flex-1 py-1 px-2 rounded-lg font-bold transition text-center cursor-pointer ${
                        notifFilter === 'darurat'
                          ? 'bg-white text-rose-700 shadow-xs'
                          : 'text-slate-500 hover:text-rose-700'
                      }`}
                    >
                      Darurat ({notifications.filter((n) => n.urgency === 'critical' || n.urgency === 'warning').length})
                    </button>
                    <button
                      type="button"
                      onClick={() => setNotifFilter('unread')}
                      className={`flex-1 py-1 px-2 rounded-lg font-bold transition text-center cursor-pointer ${
                        notifFilter === 'unread'
                          ? 'bg-white text-blue-700 shadow-xs'
                          : 'text-slate-500 hover:text-blue-700'
                      }`}
                    >
                      Belum Dibaca ({unreadCount})
                    </button>
                  </div>

                  {/* Notification List */}
                  <div className="max-h-[340px] overflow-y-auto divide-y divide-slate-100">
                    {filteredNotifications.length === 0 ? (
                      <div className="py-8 text-center text-slate-400 text-xs">
                        <Bell className="h-7 w-7 mx-auto mb-1.5 opacity-30" />
                        <p className="font-semibold text-slate-600">Tidak ada notifikasi</p>
                        <p className="text-[11px] text-slate-400 mt-0.5">Semua peringatan telah ditindaklanjuti.</p>
                      </div>
                    ) : (
                      filteredNotifications.map((notif) => {
                        let iconBg = 'bg-blue-100 text-blue-700'
                        let IconComp = Bell
                        if (notif.urgency === 'critical') {
                          iconBg = 'bg-rose-100 text-rose-700'
                          IconComp = AlertTriangle
                        } else if (notif.urgency === 'warning') {
                          iconBg = 'bg-amber-100 text-amber-700'
                          IconComp = notif.category === 'darurat' ? Thermometer : MessageSquare
                        } else if (notif.urgency === 'success') {
                          iconBg = 'bg-emerald-100 text-emerald-700'
                          IconComp = CheckCircle2
                        } else if (notif.category === 'presensi') {
                          iconBg = 'bg-indigo-100 text-indigo-700'
                          IconComp = Users
                        }

                        return (
                          <div
                            key={notif.id}
                            onClick={() => handleNotificationClick(notif)}
                            className={`p-3 sm:p-3.5 flex items-start gap-3 hover:bg-slate-50 transition cursor-pointer relative ${
                              !notif.read ? 'bg-blue-50/40' : ''
                            }`}
                          >
                            <div className={`p-2 rounded-xl shrink-0 mt-0.5 ${iconBg}`}>
                              <IconComp className="h-4 w-4" />
                            </div>

                            <div className="flex-1 min-w-0">
                              <div className="flex items-center justify-between gap-1 mb-0.5">
                                <p
                                  className={`text-xs leading-snug line-clamp-1 ${
                                    !notif.read ? 'font-bold text-slate-900' : 'font-medium text-slate-700'
                                  }`}
                                >
                                  {notif.title}
                                </p>
                                {!notif.read && (
                                  <span className="h-2 w-2 rounded-full bg-blue-600 shrink-0" />
                                )}
                              </div>
                              <p className="text-[11px] text-slate-500 leading-relaxed line-clamp-2">
                                {notif.desc}
                              </p>
                              <div className="flex items-center justify-between mt-1 text-[10px] text-slate-400">
                                <span>{notif.time}</span>
                                <span className="font-semibold text-blue-600 flex items-center gap-0.5 hover:underline">
                                  Buka modul <ExternalLink className="h-2.5 w-2.5" />
                                </span>
                              </div>
                            </div>
                          </div>
                        )
                      })
                    )}
                  </div>

                  {/* Footer */}
                  <div className="p-2.5 bg-slate-50 border-t border-slate-100 text-xs">
                    <button
                      type="button"
                      onClick={() => {
                        setIsNotifOpen(false)
                        navigate('/admin/notices')
                      }}
                      className="w-full text-center font-bold text-blue-700 hover:text-blue-800 py-1.5 rounded-xl hover:bg-blue-100/50 transition cursor-pointer"
                    >
                      Buka Papan Pengumuman Lengkap &rarr;
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* User Profile Dropdown */}
            <div className="relative" ref={profileMenuRef}>
              <button
                type="button"
                onClick={() => setIsProfileMenuOpen((prev) => !prev)}
                className="flex items-center gap-2.5 pl-2 sm:border-l sm:border-slate-200 cursor-pointer group rounded-xl hover:bg-slate-50 transition p-1 text-left focus:outline-none"
                aria-expanded={isProfileMenuOpen}
                aria-haspopup="true"
                title="Menu Profil"
              >
                <div className="h-8 w-8 sm:h-9 sm:w-9 rounded-xl bg-gradient-to-tr from-blue-700 via-blue-600 to-indigo-600 text-white flex items-center justify-center font-bold text-xs shadow-xs shrink-0 border border-white/20 group-hover:scale-105 transition-transform">
                  {initials}
                </div>
                <div className="hidden sm:block text-left leading-tight">
                  <div className="flex items-center gap-1.5">
                    <p className="text-xs font-bold text-slate-900 group-hover:text-blue-700 transition-colors">
                      {user?.fullName || 'Pengguna'}
                    </p>
                    <span className="text-[9px] font-mono font-bold bg-blue-100 text-blue-800 px-1 py-0.2 rounded uppercase">
                      {user?.role || '-'}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 font-medium truncate max-w-[150px]">
                    {ROLE_LABELS[user?.role] || user?.email || ''}
                  </p>
                </div>
              </button>

              {/* Profile Floating Dropdown Menu */}
              {isProfileMenuOpen && (
                <div className="absolute right-0 top-full mt-2 w-48 bg-white rounded-xl shadow-lg border border-slate-200 z-50 overflow-hidden py-1 divide-y divide-slate-100 animate-in fade-in slide-in-from-top-2 duration-150">
                  <div className="px-3.5 py-2.5 bg-slate-50/70 sm:hidden">
                    <p className="text-xs font-bold text-slate-900 truncate">{user?.fullName || 'Pengguna'}</p>
                    <p className="text-[10px] text-slate-400 truncate">{user?.email || ''}</p>
                  </div>
                  <div className="py-1">
                    <button
                      type="button"
                      onClick={() => {
                        setIsProfileMenuOpen(false)
                        navigate('/admin/settings')
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
        <main className="p-4 sm:p-6 lg:p-7 space-y-6 flex-1">
          {children}
        </main>

        {/* BOTTOM FOOTER (ENTERPRISE GOVERNMENT TIER) */}
        <footer className="bg-white border-t border-slate-200/80 px-6 py-4 flex flex-col md:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
          <div className="flex flex-col sm:flex-row items-center gap-2 text-center sm:text-left">
            <span className="font-extrabold text-slate-700 tracking-tight">BADAN GIZI NASIONAL (BGN) REPUBLIK INDONESIA</span>
            <span className="hidden sm:inline text-slate-300">&bull;</span>
            <span className="text-slate-500">Sistem Pengawasan Terpadu Program Makan Bergizi Gratis (MBG RI)</span>
          </div>
          <div className="flex items-center gap-3 text-slate-500 font-mono text-[10px]">
            <span>Rancangan prototipe</span>
            <span aria-hidden="true">&bull;</span>
            <span>Terhubung ke API Gateway Golang</span>
          </div>
        </footer>
      </div>
    </div>
  )
}

// Legacy Icon Exports mapped to Lucide
export const IconDashboard = (props) => <LayoutDashboard {...props} />;
export const IconUser = (props) => <Users {...props} />;
export const IconBook = (props) => <BookOpen {...props} />;
export const IconChart = (props) => <BarChart3 {...props} />;
export const IconCalendar = (props) => <CalendarDays {...props} />;
export const IconClipboard = (props) => <ClipboardList {...props} />;
export const IconClock = (props) => <Clock {...props} />;
export const IconMegaphone = (props) => <Megaphone {...props} />;
export const IconDownload = (props) => <Download {...props} />;
export const IconMessage = (props) => <MessageSquare {...props} />;
export const IconLogout = (props) => <LogOut {...props} />;
export const IconSearch = (props) => <Search {...props} />;
export const IconBell = (props) => <Bell {...props} />;
export const IconMenu = (props) => <Menu {...props} />;
export const IconGraduation = (props) => <GraduationCap {...props} />;
export const IconCheckDoc = (props) => <ShieldCheck {...props} />;
export const IconTrophy = (props) => <ShieldCheck {...props} />; // Mapped to ShieldCheck for now
