import { useState, useEffect } from 'react'
import { AdminLayout } from '../../components/layout/AdminLayout'
import { useAuth } from '../../context/AuthContext'
import { guardAdminAction } from '../../lib/adminActions'
import { CalendarPanel } from '../../components/dashboard/CalendarPanel'

/**
 * ==============================================================================
 * HALAMAN SUPERADMIN: KALENDER OPERASIONAL & SIKLUS MENU NASIONAL MBG
 * URL: /admin/calendar
 * Arsitektur: Clean Code (AdminLayout + CalendarPanel)
 * Regulasi: Bab 4.2 & Bab 9 SUPERADMIN.md - Siklus Menu 10-20 Hari Kerja
 * ==============================================================================
 */

export function CalendarPage() {
  const { user } = useAuth()
  const [toast, setToast] = useState(null)

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  const handleSuperadminAction = (action, payload) => {
    const res = guardAdminAction(user, 'Calendar', action, payload)
    if (!res.allowed) setToast(res.message)
    return res
  }

  return (
    <AdminLayout
      activeMenu="calendar"
      title="Kalender Distribusi Nutrisi"
      badge="SIKLUS MENU STANDAR"
      showSearch={false}
    >
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-xs text-blue-900 animate-in fade-in"
        >
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
          <p className="leading-relaxed font-medium">{toast}</p>
        </div>
      )}

      <CalendarPanel
        onSuperadminAction={handleSuperadminAction}
        showToast={setToast}
      />
    </AdminLayout>
  )
}

export default CalendarPage
