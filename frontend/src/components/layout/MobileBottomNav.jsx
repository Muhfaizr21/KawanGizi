import { useState, useEffect } from 'react'
import { Home, Camera, FileText, Users } from 'lucide-react'
import { navigate } from '../../App'

export const MOBILE_NAV_ITEMS = [
  {
    key: 'home',
    label: 'Beranda',
    href: '/validator',
    alternateHref: '/dashboard',
    icon: Home,
  },
  {
    key: 'skrining',
    label: 'Skrining',
    href: '/validator/foodscan',
    alternateHref: '/dashboard/skrining',
    icon: Camera,
  },
  {
    key: 'riwayat',
    label: 'Riwayat',
    href: '/validator/history',
    alternateHref: '/dashboard/riwayat',
    icon: FileText,
  },
  {
    key: 'komunitas',
    label: 'Komunitas',
    href: '/validator/incidents',
    alternateHref: '/dashboard/komunitas',
    icon: Users,
  },
]

export function MobileBottomNav({ activeMenu }) {
  // Hitung indeks aktif dari activeMenu prop halaman atau URL pathname saat ini
  const resolveActiveIndex = () => {
    // 1. Prioritas utama: activeMenu prop dari halaman
    if (activeMenu === 'dashboard') return 0
    if (activeMenu === 'foodscan' || activeMenu === 'scan') return 1
    if (activeMenu === 'history' || activeMenu === 'handover') return 2
    if (activeMenu === 'incidents' || activeMenu === 'community') return 3

    // 2. Prioritas kedua: pathname URL
    const path = typeof window !== 'undefined' ? window.location.pathname : ''
    if (path === '/validator' || path === '/dashboard' || path === '/') return 0
    if (
      path.startsWith('/validator/foodscan') ||
      path.startsWith('/validator/scan') ||
      path.startsWith('/dashboard/skrining') ||
      path.startsWith('/dashboard/scan') ||
      path === '/scan'
    ) return 1
    if (
      path.startsWith('/validator/history') ||
      path.startsWith('/validator/handover') ||
      path.startsWith('/dashboard/riwayat') ||
      path.startsWith('/dashboard/history') ||
      path.startsWith('/dashboard/handover')
    ) return 2
    if (
      path.startsWith('/validator/incidents') ||
      path.startsWith('/dashboard/komunitas') ||
      path.startsWith('/dashboard/incidents')
    ) return 3

    return 0
  }

  const [activeIndexOverride, setActiveIndexOverride] = useState(null)
  const computedIndex = resolveActiveIndex()
  const activeIndex = activeIndexOverride !== null ? activeIndexOverride : computedIndex

  // Bersihkan override setelah komponen halaman merender activeMenu baru
  useEffect(() => {
    setActiveIndexOverride(null)
  }, [activeMenu])

  useEffect(() => {
    const handlePopState = () => {
      setActiveIndexOverride(null)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  const handleItemClick = (e, item, idx) => {
    e.preventDefault()
    // Langsung pindahkan status aktif dan garis hijau seketika tanpa jeda
    setActiveIndexOverride(idx)

    const isDashboardPrefix =
      typeof window !== 'undefined' &&
      window.location.pathname.startsWith('/dashboard') &&
      !window.location.pathname.startsWith('/validator')

    const targetHref = isDashboardPrefix ? (item.alternateHref || item.href) : item.href

    if (window.location.pathname === targetHref) return
    navigate(targetHref)
  }

  return (
    <nav
      aria-label="Navigasi Bawah Seluler"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200/90 flex justify-around items-center h-16 pb-safe md:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.06)] select-none"
    >
      {MOBILE_NAV_ITEMS.map((item, idx) => {
        const Icon = item.icon
        const isActive = activeIndex === idx

        // TAB TENGAH: SKRINING
        if (item.key === 'skrining') {
          return (
            <a
              key={item.key}
              href={item.href}
              onClick={(e) => handleItemClick(e, item, idx)}
              className="relative flex flex-col items-center justify-center flex-1 h-full -mt-4 text-center cursor-pointer select-none group focus:outline-none"
              aria-current={isActive ? 'page' : undefined}
            >
              {/* Garis hijau tebal di atas saat Skrining aktif (sejajar dengan top-0 navbar karena -mt-4) */}
              {isActive && (
                <span
                  aria-hidden="true"
                  className="absolute top-4 w-9 h-[3.5px] rounded-full bg-[#185338] transition-all"
                />
              )}

              {/* Tombol Kamera: HANYA HIJAU SAAT AKTIF. Saat tidak aktif: PUTIH BERSIH/NETRAL */}
              <div
                className={`relative flex items-center justify-center h-12 w-12 rounded-full transition-all duration-200 ${
                  isActive
                    ? 'bg-[#185338] text-white ring-4 ring-emerald-300/70 scale-110 shadow-lg shadow-emerald-950/25'
                    : 'bg-white text-slate-500 hover:text-slate-800 border-2 border-slate-200 hover:border-slate-300 shadow-xs'
                }`}
              >
                <Icon
                  className={`h-6 w-6 transition-colors ${
                    isActive ? 'text-white stroke-[2.2]' : 'text-slate-500 group-hover:text-slate-700 stroke-[1.9]'
                  }`}
                />

                {/* Titik hijau radar HANYA MUNCUL KETIKA SKRINING AKTIF */}
                {isActive && (
                  <span className="absolute -top-0.5 -right-0.5 flex h-2.5 w-2.5">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-300 opacity-75" />
                    <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-emerald-400 ring-2 ring-white" />
                  </span>
                )}
              </div>

              <span
                className={`text-[10px] mt-1 tracking-tight transition-colors ${
                  isActive
                    ? 'font-black text-[#185338] scale-105'
                    : 'font-medium text-slate-400 group-hover:text-slate-600'
                }`}
              >
                {item.label}
              </span>
            </a>
          )
        }

        // TAB STANDAR: BERANDA, RIWAYAT, KOMUNITAS
        return (
          <a
            key={item.key}
            href={item.href}
            onClick={(e) => handleItemClick(e, item, idx)}
            className={`relative flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-colors cursor-pointer select-none group focus:outline-none ${
              isActive ? 'text-[#185338]' : 'text-slate-400 hover:text-slate-600'
            }`}
            aria-current={isActive ? 'page' : undefined}
          >
            {/* Garis hijau tebal di atas tab saat aktif */}
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute top-0 w-9 h-[3.5px] rounded-full bg-[#185338] transition-all"
              />
            )}

            <div className="relative mt-0.5">
              <Icon
                className={`h-5 w-5 transition-transform duration-200 ${
                  isActive
                    ? 'text-[#185338] scale-110 stroke-[2.4]'
                    : 'text-slate-400 group-hover:scale-105 stroke-[1.8]'
                }`}
              />
            </div>

            <span
              className={`text-[11px] mt-1 tracking-tight transition-colors ${
                isActive
                  ? 'font-extrabold text-[#185338]'
                  : 'font-medium text-slate-400 group-hover:text-slate-700'
              }`}
            >
              {item.label}
            </span>
          </a>
        )
      })}
    </nav>
  )
}

export default MobileBottomNav
