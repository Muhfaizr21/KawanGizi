import { useCallback, useEffect, useMemo, useState } from 'react'
import { AdminLayout } from '../../components/layout/AdminLayout'
import { useAuth } from '../../context/AuthContext'
import { guardAdminAction } from '../../lib/adminActions'
import { SppgPanel } from '../../components/dashboard/SppgPanel'
import { toSppgViews } from '../../components/dashboard/sppgView'
import {
  fetchSppgList,
  issueSppgWarning,
  recordSppgRecipeAudit,
  reinstateSppgKitchen,
  suspendSppgKitchen,
  updateSppgQuota,
} from '../../lib/api'

/**
 * ==============================================================================
 * HALAMAN SUPERADMIN: DAPUR SPPG (SENTRAL & REKANAN PRODUKSI)
 * URL: /admin/sppg
 *
 * Data berasal dari API Go: profil dapur, sekolahrecipient (schools.sppg_id),
 * tren kepatuhan 7 hari (dihitung dari deliveries), dan riwayat surat
 * teguran. Tidak ada angka fallback karangan — kalau backend tidak punya data,
 * panel menampilkannya sebagai belum tercatat.
 * ==============================================================================
 */

// Aksi pada panel → endpoint + permission. Surat teguran & pembekuan hanya
// superadmin; kuota & audit resep memakai sppg.manage.
const SPPG_ACTIONS = {
  issue_warning: { permission: 'sppg.manage', superadminOnly: true, run: (k, p) => issueSppgWarning(k.id, p) },
  suspend_kitchen: { permission: 'sppg.manage', superadminOnly: true, run: (k, p) => suspendSppgKitchen(k.id, p) },
  reinstate_kitchen: { permission: 'sppg.manage', superadminOnly: true, run: (k, p) => reinstateSppgKitchen(k.id, p) },
  update_quota: { permission: 'sppg.manage', run: (k, p) => updateSppgQuota(k.id, p.quota, p.reason) },
  audit_recipe: { permission: 'sppg.manage', run: (k, p) => recordSppgRecipeAudit(k.id, p) },
}

export function SppgPage() {
  const { user } = useAuth()
  const [kitchens, setKitchens] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [toast, setToast] = useState(null)
  const [toastTone, setToastTone] = useState('info')

  const notify = useCallback((message, tone = 'info') => {
    setToast(message)
    setToastTone(tone)
  }, [])

  useEffect(() => {
    let active = true
    fetchSppgList()
      .then((data) => {
        if (active) setKitchens(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        if (active) setLoadError(err.message || 'Gagal memuat direktori dapur.')
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [])

  useEffect(() => {
    if (!toast) return
    const timer = setTimeout(() => setToast(null), 5000)
    return () => clearTimeout(timer)
  }, [toast])

  /**
   * Menjalankan aksi terhadap satu dapur.
   *
   * Cek izin dulu supaya role read-only mendapat pesan jelas tanpa round-trip;
   * backend tetap penentu dan mengembalikan profil terbaru yang dipakai UI.
   *
   * @returns {Promise<{ok: boolean, profile?: object, message?: string}>}
   */
  const runAction = useCallback(
    async (action, kitchen, payload) => {
      const config = SPPG_ACTIONS[action]
      if (!config) return { ok: false, message: `Aksi "${action}" tidak dikenal.` }

      // Tindakan disipliner hanya boleh oleh superadmin, meski role itu punya
      // izin sppg.manage untuk mengisi data dapurnya sendiri.
      const guard = guardAdminAction(
        user,
        'SPPG',
        action,
        kitchen,
        config.superadminOnly ? [] : [config.permission]
      )
      if (!guard.allowed) {
        notify(guard.message, 'error')
        return { ok: false, message: guard.message }
      }

      try {
        const profile = await config.run(kitchen, payload)
        if (profile) {
          setKitchens((prev) => prev.map((k) => (k.id === profile.id ? profile : k)))
        }
        notify(`[SUKSES] ${kitchen.name}: ${action} berhasil dieksekusi dan tercatat pada audit log.`, 'success')
        return { ok: true, profile }
      } catch (err) {
        const message = err.message || `Aksi "${action}" gagal.`
        notify(`[GAGAL] ${kitchen.name}: ${message}`, 'error')
        return { ok: false, message }
      }
    },
    [user, notify]
  )

  // Pemeriksaan izin sinkron untuk menonaktifkan tombol tanpa menunggu jaringan.
  const canAct = useCallback(
    (action) => {
      const config = SPPG_ACTIONS[action]
      if (!config) return false
      if (config.superadminOnly) return user?.role === 'superadmin'
      return guardAdminAction(user, 'SPPG', action, null, [config.permission]).allowed
    },
    [user]
  )

  const sppgList = useMemo(() => toSppgViews(kitchens), [kitchens])

  return (
    <AdminLayout
      activeMenu="sppg"
      title="Dapur SPPG"
      badge={loading ? 'MEMUAT...' : 'POSTGRESQL LIVE'}
      showSearch={false}
    >
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-xs ${
            toastTone === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-900'
              : toastTone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-orange-200 bg-orange-50 text-orange-900'
          }`}
        >
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />
          <p className="leading-relaxed font-medium">{toast}</p>
        </div>
      )}

      {loadError && (
        <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900">
          <p className="font-semibold">Direktori dapur tidak dapat dimuat.</p>
          <p className="mt-1 leading-relaxed">{loadError}</p>
        </div>
      )}

      <SppgPanel
        sppgList={sppgList}
        loading={loading}
        onAction={runAction}
        canManage={canAct('update_quota')}
        canDiscipline={canAct('issue_warning')}
        canManageAccounts={user?.role === 'superadmin'}
        showToast={notify}
      />
    </AdminLayout>
  )
}

export default SppgPage