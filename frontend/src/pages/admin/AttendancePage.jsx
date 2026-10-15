import { useState, useEffect, useCallback } from 'react'
import { AdminLayout } from '../../components/layout/AdminLayout'
import { useAuth } from '../../context/AuthContext'
import { guardAdminAction } from '../../lib/adminActions'
import { AttendancePanel } from '../../components/dashboard/AttendancePanel'
import { INITIAL_ATTENDANCE_LIST } from '../../data/attendanceData'
import { fetchAttendances } from '../../lib/api'
import { toAttendanceView } from '../../components/dashboard/attendanceView'

/**
 * ==============================================================================
 * HALAMAN SUPERADMIN: PENERIMAAN SISWA & REKONSILIASI PORSI MBG
 * URL: /admin/attendance
 * Arsitektur: Clean Code (AdminLayout + AttendancePanel)
 * Sumber Data: Database PostgreSQL via REST API Gateway Golang
 * ==============================================================================
 */

export function AttendancePage() {
  const { user } = useAuth()
  const [toast, setToast] = useState(null)
  const [attendanceList, setAttendanceList] = useState(INITIAL_ATTENDANCE_LIST)
  const [loading, setLoading] = useState(true)

  const loadAttendances = useCallback(async () => {
    try {
      setLoading(true)
      const data = await fetchAttendances()
      if (Array.isArray(data) && data.length > 0) {
        const mapped = data.map(toAttendanceView)
        setAttendanceList(mapped)
      }
    } catch (err) {
      console.warn('Gagal memuat data presensi dari PostgreSQL:', err)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    loadAttendances()
  }, [loadAttendances])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 4000)
    return () => clearTimeout(timer)
  }, [toast])

  const handleSuperadminAction = (action, payload) => {
    const res = guardAdminAction(user, 'Attendance', action, payload)
    if (!res.allowed) setToast(res.message)
    return res
  }

  return (
    <AdminLayout
      activeMenu="attendance"
      title="Penerimaan Siswa"
      badge={loading ? 'MEMUAT...' : 'POSTGRESQL LIVE'}
      showSearch={false}
    >
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="mb-4 flex items-start gap-3 rounded-xl border border-indigo-200 bg-indigo-50 px-4 py-3 text-xs text-indigo-900 animate-in fade-in"
        >
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
          <p className="leading-relaxed font-medium">{toast}</p>
        </div>
      )}

      <AttendancePanel
        attendanceList={attendanceList}
        onSuperadminAction={handleSuperadminAction}
        showToast={setToast}
        onReload={loadAttendances}
      />
    </AdminLayout>
  )
}

export default AttendancePage
