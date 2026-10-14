import { useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { navigate } from '../App'
import { homeForRole } from '../lib/api'
import { ErrorPage } from './ErrorPage'

/**
 * RequireRole gates a portal subtree:
 * - masih memuat   → splash netral (hindari loop redirect saat hidrasi)
 * - belum login    → /login
 * - role salah     → halaman 403 (akses ditolak)
 */
export function RequireRole({ roles, children }) {
  const { user, loading } = useAuth()
  const redirectedTo = useRef(null)

  const target = !loading && !user ? '/login' : null
  const unauthorized =
    !loading && user && roles?.length > 0 && !roles.includes(user.role)

  useEffect(() => {
    if (!target) return
    if (redirectedTo.current === target) return
    if (window.location.pathname === target) return
    redirectedTo.current = target
    navigate(target)
  }, [target])

  if (loading || target) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="font-mono text-[11px] uppercase tracking-widest text-slate-400">
          {loading ? 'Memeriksa sesi…' : 'Mengalihkan ke halaman masuk…'}
        </p>
      </div>
    )
  }

  if (unauthorized) {
    return (
      <ErrorPage
        code={403}
        path={window.location.pathname}
        homeLabel="Buka dasbor saya"
        onHome={() => navigate(homeForRole(user.role))}
      />
    )
  }

  return children
}
