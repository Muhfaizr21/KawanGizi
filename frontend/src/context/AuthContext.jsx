import { createContext, useContext, useEffect, useState, useCallback } from 'react'
import {
  loginRequest,
  meRequest,
  logoutRequest,
} from '../lib/api'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [user, setUser] = useState(() => {
    try {
      const stored = localStorage.getItem('mbg_user')
      return stored ? JSON.parse(stored) : null
    } catch {
      return null
    }
  })
  const [permissions, setPermissions] = useState(() => {
    try {
      const stored = localStorage.getItem('mbg_permissions')
      return stored ? JSON.parse(stored) : []
    } catch {
      return []
    }
  })
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      try {
        const data = await meRequest()
        if (!cancelled) {
          const userData = { ...data.user, permissions: data.permissions || [] }
          setUser(userData)
          setPermissions(data.permissions || [])
          localStorage.setItem('mbg_user', JSON.stringify(userData))
          localStorage.setItem('mbg_permissions', JSON.stringify(data.permissions || []))
        }
      } catch {
        if (!cancelled) {
          // If meRequest fails (e.g. token expired and couldn't refresh), clear local storage
          setUser(null)
          setPermissions([])
          localStorage.removeItem('mbg_user')
          localStorage.removeItem('mbg_permissions')
        }
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [])

  const login = useCallback(async (email, password) => {
    const data = await loginRequest(email, password)
    const userData = { ...data.user, permissions: data.permissions || [] }
    setUser(userData)
    setPermissions(data.permissions || [])
    localStorage.setItem('mbg_user', JSON.stringify(userData))
    localStorage.setItem('mbg_permissions', JSON.stringify(data.permissions || []))
    return data.user
  }, [])

  const logout = useCallback(async () => {
    await logoutRequest().catch(() => {})
    setUser(null)
    setPermissions([])
    localStorage.removeItem('mbg_user')
    localStorage.removeItem('mbg_permissions')
  }, [])

  const updateUser = useCallback((patch) => {
    setUser((prev) => {
      if (!prev) return prev
      const next = { ...prev, ...patch }
      localStorage.setItem('mbg_user', JSON.stringify(next))
      return next
    })
  }, [])

  const can = useCallback(
    (permission) => permissions.includes(permission),
    [permissions],
  )

  const isSuperadmin = user?.role === 'superadmin'
  const isSppg = user?.role === 'sppg'
  const isValidator = user?.role === 'validator'

  const value = {
    user,
    role: user?.role || null,
    isSuperadmin,
    isSppg,
    isValidator,
    permissions,
    loading,
    login,
    logout,
    can,
    updateUser,
    isAuthenticated: !!user,
  }

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth harus dipakai di dalam <AuthProvider>')
  return ctx
}
