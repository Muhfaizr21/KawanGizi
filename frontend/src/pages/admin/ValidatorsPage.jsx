import { useCallback, useEffect, useState } from 'react'
import { AdminLayout } from '../../components/layout/AdminLayout'
import { useAuth } from '../../context/AuthContext'
import { guardAdminAction } from '../../lib/adminActions'
import { ValidatorPanel } from '../../components/dashboard/ValidatorPanel'
import { ValidatorFormModal } from '../../components/dashboard/ValidatorFormModal'
import {
  assignBackupValidator,
  deleteValidator,
  fetchValidators,
  resetValidatorDevice,
  setValidatorStatus,
  warnValidator,
} from '../../lib/api'

/**
 * ==============================================================================
 * HALAMAN SUPERADMIN: PROFIL & AUDIT INTEGRITAS VALIDATOR LAPANGAN
 * URL: /admin/validators
 *
 * Seluruh angka pada halaman ini berasal dari API Go (tabel scan_logs &
 * attendances), bukan data simulasi. Aksi tulis memerlukan izin
 * `validators.manage` dan tercatat pada audit_logs di backend.
 * ==============================================================================
 */

// Peta action pada panel ke endpoint + permission yang mengharuskannya.
const VALIDATOR_ACTIONS = {
  activate: { permission: 'validators.manage', run: (v) => setValidatorStatus(v.id, 'active', defaultReason(v, 'Aktivasi hak akses validasi')) },
  deactivate: {
    permission: 'validators.manage',
    run: (v) => setValidatorStatus(v.id, 'inactive', defaultReason(v, 'Pembekuan sementara hak validasi')),
  },
  resetDevice: { permission: 'validators.manage', run: (v) => resetValidatorDevice(v.id, defaultReason(v, 'Reset device binding')) },
  warn: { permission: 'validators.manage', run: (v, note) => warnValidator(v.id, note) },
  assignBackup: {
    permission: 'validators.manage',
    run: (v, backupId) => assignBackupValidator(v.id, backupId, defaultReason(v, 'Penugasan guru piket cadangan')),
  },
}

function defaultReason(validator, action) {
  return `${action} atas nama ${validator.name} (${validator.satgasId}) oleh superadmin.`
}

export function ValidatorsPage() {
  const { user } = useAuth()
  const [validators, setValidators] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(null)
  const [toast, setToast] = useState(null)
  const [toastTone, setToastTone] = useState('info')
  // undefined = modal tertutup; null = mode tambah; objek = mode edit.
  const [formValidator, setFormValidator] = useState(undefined)

  const notify = useCallback((message, tone = 'info') => {
    setToast(message)
    setToastTone(tone)
  }, [])

  const reload = useCallback(async () => {
    const data = await fetchValidators()
    setValidators(Array.isArray(data) ? data : [])
  }, [])

  useEffect(() => {
    let active = true
    fetchValidators()
      .then((data) => {
        if (active) setValidators(Array.isArray(data) ? data : [])
      })
      .catch((err) => {
        if (active) setLoadError(err.message || 'Gagal memuat roster validator.')
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
   * Menjalankan aksi superadmin terhadap satu validator.
   *
   * Urutannya: cek izin di UI dulu (untuk pesan yang jelas tanpa round-trip),
   * baru panggil API. Backend tetap menjadi penentu — guard di sini hanya
   * menjaga tampilan agar read-only tidak melihat tombol yang pasti ditolak.
   *
   * @returns {Promise<{ok: boolean, profile?: object, message?: string}>}
   */
  const runAction = useCallback(
    async (action, validator, payload) => {
      const config = VALIDATOR_ACTIONS[action]
      if (!config) return { ok: false, message: `Aksi "${action}" tidak dikenal.` }

      const guard = guardAdminAction(user, 'Validators', action, validator, [config.permission])
      if (!guard.allowed) {
        notify(guard.message, 'error')
        return { ok: false, message: guard.message }
      }

      try {
        const profile = await config.run(validator, payload)
        if (profile) {
          setValidators((prev) => prev.map((v) => (v.id === profile.id ? profile : v)))
        }
        notify(`[SUKSES] ${validator.name}: ${action} berhasil dieksekusi dan tercatat pada audit log.`, 'success')
        return { ok: true, profile }
      } catch (err) {
        const message = err.message || `Aksi "${action}" gagal.`
        notify(`[GAGAL] ${validator.name}: ${message}`, 'error')
        return { ok: false, message }
      }
    },
    [user, notify]
  )

  // Pemeriksaan izin sinkron terpisah dari eksekusi async supaya tombol di
  // panel bisa dinonaktifkan tanpa menunggu jaringan.
  const checkPermission = useCallback(
    (action) => {
      const config = VALIDATOR_ACTIONS[action]
      const permissions = config ? [config.permission] : []
      return guardAdminAction(user, 'Validators', action, null, permissions)
    },
    [user]
  )

  const canManage = checkPermission('activate').allowed

  const handleCreate = useCallback(() => {
    if (!canManage) {
      notify('Role Anda hanya memiliki izin baca untuk roster validator.', 'error')
      return
    }
    setFormValidator(null)
  }, [canManage, notify])

  const handleEdit = useCallback(
    (validator) => {
      if (!canManage) {
        notify('Role Anda hanya memiliki izin baca untuk roster validator.', 'error')
        return
      }
      setFormValidator(validator)
    },
    [canManage, notify]
  )

  const handleSaved = useCallback(
    async (created) => {
      if (created) {
        setValidators((prev) => [created, ...prev])
        notify(`[SUKSES] Akun validator ${created.name} berhasil dibuat.`, 'success')
        return
      }
      try {
        await reload()
        notify('[SUKSES] Perubahan akun validator tersimpan dan tercatat pada audit log.', 'success')
      } catch (err) {
        notify(err.message || 'Gagal memuat ulang roster.', 'error')
      }
    },
    [notify, reload]
  )

  const handleDelete = useCallback(
    async (validator) => {
      const guard = guardAdminAction(user, 'Validators', 'delete', validator, ['validators.manage'])
      if (!guard.allowed) {
        notify(guard.message, 'error')
        return { ok: false, message: guard.message }
      }
      try {
        await deleteValidator(validator.id)
        setValidators((prev) => prev.filter((v) => v.id !== validator.id))
        notify(`[SUKSES] Akun validator ${validator.name} dihapus.`, 'success')
        return { ok: true }
      } catch (err) {
        const message = err.message || 'Gagal menghapus akun validator.'
        notify(`[GAGAL] ${validator.name}: ${message}`, 'error')
        return { ok: false, message }
      }
    },
    [user, notify]
  )

  return (
    <AdminLayout activeMenu="validator" title="Profil Validator" badge="POSTGRESQL LIVE" showSearch={false}>
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`mb-4 flex items-start gap-3 rounded-xl border px-4 py-3 text-xs ${
            toastTone === 'error'
              ? 'border-rose-200 bg-rose-50 text-rose-900'
              : toastTone === 'success'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-900'
                : 'border-amber-200 bg-amber-50 text-amber-900'
          }`}
        >
          <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-current opacity-60" />
          <p className="leading-relaxed">{toast}</p>
        </div>
      )}

      {loadError && (
        <div role="alert" className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs text-rose-900">
          <p className="font-semibold">Roster validator tidak dapat dimuat.</p>
          <p className="mt-1 leading-relaxed">{loadError}</p>
        </div>
      )}

      <ValidatorPanel
        validators={validators}
        loading={loading}
        onAction={runAction}
        canManage={checkPermission('activate').allowed}
        showToast={notify}
        onCreate={handleCreate}
        onEdit={handleEdit}
        onDelete={handleDelete}
      />

      {formValidator !== undefined && (
        <ValidatorFormModal
          validator={formValidator}
          onClose={() => setFormValidator(undefined)}
          onSaved={handleSaved}
        />
      )}
    </AdminLayout>
  )
}

export default ValidatorsPage