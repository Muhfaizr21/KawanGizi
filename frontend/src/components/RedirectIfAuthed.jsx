import { useEffect, useRef } from 'react'
import { useAuth } from '../context/AuthContext'
import { navigate } from '../App'
import { homeForRole } from '../lib/api'

export function RedirectIfAuthed({ children }) {
  const { user } = useAuth()
  const redirected = useRef(false)

  useEffect(() => {
    if (!user || redirected.current) return
    redirected.current = true
    navigate(homeForRole(user.role))
  }, [user])

  if (user) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-white">
        <p className="font-mono text-[11px] uppercase tracking-widest text-slate-400">
          Mengalihkan ke dasbor…
        </p>
      </div>
    )
  }

  return children
}
