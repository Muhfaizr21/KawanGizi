import { useState, useEffect } from 'react'
import { Home, Camera, FileText, Users } from 'lucide-react'
import { navigate } from '../../App'

export const MOBILE_NAV_ITEMS = [
  {
    key: 'home',
    label: 'Beranda',
    href: '/dashboard',
    alternateHref: '/validator',
    icon: Home,
    match: (path, activeMenu) =>
      activeMenu === 'dashboard' ||
      path === '/dashboard' ||
      path === '/validator' ||
      path === '/',
  },
  {
    key: 'skrining',
    label: 'Skrining',
    href: '/dashboard/skrining',
    alternateHref: '/validator/foodscan',
    icon: Camera,
    match: (path, activeMenu) =>
      activeMenu === 'foodscan' ||
      path === '/dashboard/skrining' ||
      path.startsWith('/validator/foodscan') ||
      path.startsWith('/validator/scan'),
  },
  {
    key: 'riwayat',
    label: 'Riwayat',
    href: '/dashboard/riwayat',
    alternateHref: '/validator/history',
    icon: FileText,
    match: (path, activeMenu) =>
      activeMenu === 'history' ||
      path === '/dashboard/riwayat' ||
      path.startsWith('/validator/history') ||
      path.startsWith('/validator/handover'),
  },
  {
    key: 'komunitas',
    label: 'Komunitas',
    href: '/dashboard/komunitas',
    alternateHref: '/validator/incidents',
    icon: Users,
    match: (path, activeMenu) =>
      activeMenu === 'incidents' ||
      activeMenu === 'community' ||
      path === '/dashboard/komunitas' ||
      path.startsWith('/validator/incidents'),
  },
]

export function MobileBottomNav({ activeMenu }) {
  const [currentPath, setCurrentPath] = useState(() => {
    if (typeof window !== 'undefined') {
      return window.location.pathname
    }
    return '/dashboard'
  })

  useEffect(() => {
    const handlePopState = () => {
      setCurrentPath(window.location.pathname)
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  return (
    <nav
      aria-label="Navigasi Bawah Seluler"
      className="fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 flex justify-around items-center h-16 pb-safe md:hidden shadow-[0_-4px_20px_rgba(0,0,0,0.04)]"
    >
      {MOBILE_NAV_ITEMS.map((item) => {
        const Icon = item.icon
        const isActive = item.match(currentPath, activeMenu)

        return (
          <a
            key={item.key}
            href={item.href}
            onClick={(e) => {
              e.preventDefault()
              navigate(item.href)
            }}
            className={`relative flex flex-col items-center justify-center flex-1 h-full py-1 text-center transition-colors cursor-pointer select-none group focus:outline-none ${
              isActive ? 'text-[#185338]' : 'text-slate-400 hover:text-slate-600'
            }`}
            aria-current={isActive ? 'page' : undefined}
          >
            {/* Active Pill / Dot Top Accent */}
            {isActive && (
              <span
                aria-hidden="true"
                className="absolute top-0 w-8 h-0.5 rounded-full bg-[#185338] transition-all"
              />
            )}

            <div className="relative mt-0.5">
              <Icon
                className={`h-5 w-5 transition-transform duration-200 ${
                  isActive ? 'text-[#185338] scale-110 stroke-[2.4]' : 'text-slate-400 group-hover:scale-105 stroke-[1.8]'
                }`}
              />
            </div>

            <span
              className={`text-[11px] mt-1 tracking-tight transition-colors ${
                isActive ? 'font-bold text-[#185338]' : 'font-medium text-slate-400 group-hover:text-slate-600'
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
