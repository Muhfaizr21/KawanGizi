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
    href: '/validator/komunitas',
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
    if (activeMenu === 'community') return 3

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
      path.startsWith('/validator/komunitas') ||
      path.startsWith('/validator/community') ||
      path.startsWith('/dashboard/komunitas') ||
      path.startsWith('/dashboard/community')
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
