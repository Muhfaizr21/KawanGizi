import { useState } from 'react'
import Image from 'next/image'
import KawangiziLogo from '@/assets/kawangizi-logo.webp'
import { ROUTES } from '../../data/mbgData'
import { ArrowIcon } from '../ui/Icons'
import { CtaButton } from '../ui/CtaButton'
import { useAuth } from '../../context/AuthContext'
import { homeForRole } from '../../lib/api'

function isActive(href, path) {
  if (href === '/') return path === '/' || path === '' || path === '/home'
  return path === href || path.startsWith(href + '/')
}

export function SiteHeader({ path }) {
  const [open, setOpen] = useState(false)
  const { user } = useAuth()
  const authTarget = user ? homeForRole(user.role) : '/login'
  const authLabel = user ? 'Dasbor' : 'Masuk'

  return (
    <header className="sticky top-0 z-50 border-b border-gray-100 bg-white/90 backdrop-blur-md">
      <nav aria-label="Utama" className="relative mx-auto flex max-w-6xl items-center justify-between px-6 py-4">
        {/* Left: Brand Logo */}
        <div className="flex items-center">
          <a href="/" className="flex items-center gap-2.5 text-xl font-black tracking-tight text-gray-900 group">
            <Image
              src={KawangiziLogo}
              alt="Logo KawanGizi"
              width={36}
              height={36}
              className="object-contain w-auto h-8 sm:h-9 transition-transform group-hover:scale-105"
              priority
            />
            <span>KawanGizi</span>
          </a>
        </div>

        {/* Center: Desktop Navigation Links */}
        <ul className="hidden md:flex absolute left-1/2 -translate-x-1/2 items-center gap-8">
          {ROUTES.map((r) => (
            <li key={r.href}>
              <a
                href={r.href}
                className={`text-sm transition-colors hover:text-gray-900 ${
                  isActive(r.href, path) ? 'font-semibold text-gray-900' : 'text-gray-500'
                }`}
              >
                {r.label}
              </a>
            </li>
          ))}
        </ul>

        {/* Right: Actions */}
        <div className="hidden md:flex items-center gap-3">
          <a
            href="/mulai"
            className="inline-flex items-center gap-2 rounded-full border border-gray-300 bg-white px-5 py-2 text-xs font-semibold uppercase tracking-widest text-gray-900 shadow-sm transition-all hover:bg-gray-900 hover:text-white hover:border-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900"
          >
            Mulai Sekarang <ArrowIcon />
          </a>
          <a
            href={authTarget}
            className="inline-flex items-center rounded-full bg-gray-900 px-4 py-2 text-xs font-semibold text-white shadow-sm transition-all hover:bg-black"
          >
            {authLabel}
          </a>
        </div>

        {/* Mobile Hamburger Toggle */}
        <button
          type="button"
          className="rounded p-2 text-gray-900 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-gray-900 md:hidden"
          aria-expanded={open}
          aria-controls="mobile-menu"
          aria-label={open ? 'Tutup menu' : 'Buka menu'}
          onClick={() => setOpen((v) => !v)}
        >
          <svg width="22" height="22" viewBox="0 0 20 20" fill="none" aria-hidden="true">
            <path d="M3 5h14M3 10h14M3 15h14" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </nav>

      {/* Mobile Menu Dropdown */}
      {open && (
        <div id="mobile-menu" className="border-t border-gray-100 bg-white px-6 py-4 md:hidden">
          <ul className="flex flex-col gap-4">
            {ROUTES.map((r) => (
              <li key={r.href}>
                <a
                  href={r.href}
                  onClick={() => setOpen(false)}
                  className={`text-sm hover:text-gray-900 ${
                    isActive(r.href, path) ? 'font-semibold text-gray-900' : 'text-gray-500'
                  }`}
                >
                  {r.label}
                </a>
              </li>
            ))}
          </ul>
          <div className="mt-4 flex flex-col gap-2" onClick={() => setOpen(false)}>
            <CtaButton href="/mulai">Mulai Sekarang</CtaButton>
            <a
              href={authTarget}
              className="w-full text-center py-2.5 rounded-full bg-gray-900 text-white text-xs font-semibold"
            >
              {authLabel}
            </a>
          </div>
        </div>
      )}
    </header>
  )
}
