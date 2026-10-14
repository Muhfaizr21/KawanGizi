import { useState, useMemo, useEffect, useRef } from 'react'
import { AlertTriangle, CheckCircle2, X, ShieldCheck, Clock, Lock, Users, AlertOctagon, Smartphone, Download, Printer, UserPlus, UserCog, Trash2, Loader2 } from 'lucide-react'
import { ValidatorCharts } from './ValidatorCharts'
import { MIN_INSPECTION_SEC, toValidatorViews } from './validatorView'


/**
 * ==============================================================================
 * BADAN GIZI NASIONAL (BGN) REPUBLIK INDONESIA
 * KONSOL PENGAWASAN & AUDIT INTEGRITAS VALIDATOR LAPANGAN (SUPERADMIN)
 * Standar: Enterprise Government Telemetry Console • Zero-Glitch • Clean Code
 * Sesuai Regulasi: Perpres No. 83/2024 & Juknis Operasional MBG Pasal 14
 * ==============================================================================
 */

export function ValidatorPanel({
  validators = [],
  loading = false,
  // onAction(action, validator, payload) -> Promise<{ok, profile?, message?}>.
  // Panel hanya menunggu; panel tidak mengubah state sendiri karena
  // kebenaran data ada di server.
  onAction,
  canManage = true,
  showToast,
  // Pusat akun validator (superadmin): buka modal tambah/edit dan hapus akun.
  onCreate,
  onEdit,
  onDelete,
}) {
  // Roster adalah data turunan dari props, bukan state lokal: setiap aksi
  // menulis ke server lalu parent memperbarui props, jadi tidak perlu salinan
  // state lokal yang bisa basi.
  const validatorsList = useMemo(() => toValidatorViews(validators), [validators])

  // Anomali hanya sah bila ada buktinya: validator tanpa pindai hari ini
  // belum tentu tidak teliti, jadi tidak boleh dihitung sebagai "kilat".
  const isFastInspection = (v) => v.scansToday > 0 && v.avgDuration < MIN_INSPECTION_SEC

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'flagged' | 'active' | 'certified' | 'inactive'
  const [cityFilter, setCityFilter] = useState('all')
  const [hardwareFilter, setHardwareFilter] = useState('all')
  const [density, setDensity] = useState('normal') // 'normal' | 'compact'

  // Drawer & Dialog State
  const [selectedValidator, setSelectedValidator] = useState(null)
  const [drawerTab, setDrawerTab] = useState('credentials') // 'credentials' | 'telemetry' | 'scans' | 'actions'
  const [openMenuId, setOpenMenuId] = useState(null)
  const [confirmAction, setConfirmAction] = useState(null) // { type, validator, payload, title, desc, ... }
  const [warnNote, setWarnNote] = useState('')
  const [backupChoice, setBackupChoice] = useState('')
  const [confirmDelete, setConfirmDelete] = useState(null) // validator yang akan dihapus
  const [pendingDelete, setPendingDelete] = useState(false)

  // Guru piket cadangan hanya bisa milik sekolah yang sama dan harus aktif.
  const eligibleBackups = useMemo(() => {
    if (!confirmAction) return []
    return validatorsList.filter(
      (v) =>
        v.id !== confirmAction.validator.id &&
        v.status === 'active' &&
        v.school === confirmAction.validator.school
    )
  }, [validatorsList, confirmAction])

  const dropdownRef = useRef(null)

  // Close action dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close drawer on ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedValidator(null)
        setConfirmAction(null)
        setOpenMenuId(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Distinct cities for filter dropdown
  const cities = useMemo(() => {
    const set = new Set(validatorsList.map((v) => v.city).filter(Boolean))
    return Array.from(set)
  }, [validatorsList])

  // Advanced Filtering
  const filtered = useMemo(() => {
    return validatorsList.filter((v) => {
      const q = search.toLowerCase()
      const matchSearch =
        !search ||
        v.name.toLowerCase().includes(q) ||
        v.school.toLowerCase().includes(q) ||
        v.npsn.includes(q) ||
        v.role.toLowerCase().includes(q) ||
        (v.nip && v.nip.includes(q)) ||
        (v.satgasId && v.satgasId.toLowerCase().includes(q)) ||
        (v.city && v.city.toLowerCase().includes(q)) ||
        (v.device && v.device.toLowerCase().includes(q))

      let matchStatus = true
      if (statusFilter === 'flagged') matchStatus = v.status === 'flagged' || isFastInspection(v)
      else if (statusFilter === 'active') matchStatus = v.status === 'active'
      else if (statusFilter === 'certified') matchStatus = v.certification.includes('Lanjutan')
      else if (statusFilter === 'inactive') matchStatus = v.status === 'inactive'

      const matchCity = cityFilter === 'all' || v.city === cityFilter

      let matchHardware = true
      if (hardwareFilter !== 'all') matchHardware = v.hardware === hardwareFilter

      return matchSearch && matchStatus && matchCity && matchHardware
    })
  }, [search, statusFilter, cityFilter, hardwareFilter, validatorsList])

  // Executive KPI Calculations
  const stats = useMemo(() => {
    const total = validatorsList.length
    const active = validatorsList.filter((v) => v.status === 'active').length
    const flagged = validatorsList.filter((v) => v.status === 'flagged' || isFastInspection(v)).length
    const inactive = validatorsList.filter((v) => v.status === 'inactive').length
    const totalScans = validatorsList.reduce((acc, v) => acc + (v.scansToday || 0), 0)
    const targetScans = validatorsList.reduce((acc, v) => acc + (v.quotaToday || 45), 0)
    const avgDuration =
      validatorsList.length > 0
        ? (validatorsList.reduce((acc, v) => acc + (v.avgDuration || 0), 0) / validatorsList.length).toFixed(2)
        : '0.00'

    // Compliance Rate: % of scans meeting >= 0.5s requirement
    // Yang pernah memindai saja yang bisa dinilai patuh; tanpa pindai tidak dihitung.
  const scannable = validatorsList.filter((v) => v.scansToday > 0)
  const compliantCount = scannable.filter((v) => v.avgDuration >= 0.5).length
    const complianceRate = scannable.length > 0 ? Math.round((compliantCount / scannable.length) * 100) : 100

    const flaggedList = validatorsList
      .filter((v) => v.status === 'flagged' || isFastInspection(v))
      .sort((a, b) => a.avgDuration - b.avgDuration)

    return { total, active, flagged, inactive, totalScans, targetScans, avgDuration, complianceRate, flaggedList }
  }, [validatorsList])

  const resetFilters = () => {
    setSearch('')
    setStatusFilter('all')
    setCityFilter('all')
    setHardwareFilter('all')
  }

  // Export the currently filtered roster as CSV.
  // Why: the header offers export, so it must produce a real file, not a toast.
  const exportCsv = () => {
    const headers = [
      'satgas_id', 'nama', 'nip', 'npsn', 'sekolah', 'wilayah',
      'durasi_rata_detik', 'porsi_hari_ini', 'kuota', 'sertifikasi', 'status',
    ]
    const rows = filtered.map((v) => [
      v.satgasId, v.name, v.nip, v.npsn, v.school, v.city,
      v.avgDuration, v.scansToday, v.quotaToday, v.certification, v.status,
    ])

    const escape = (cell) => {
      const s = cell == null ? '' : String(cell)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const csv = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n')

    const url = URL.createObjectURL(new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url
    a.download = `roster-validator-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast?.(`${filtered.length} baris diekspor ke CSV.`)
  }

  // Handle Action Trigger with Confirmation Dialog
  const promptAction = (type, validator) => {
    setOpenMenuId(null)

    const actionConfigs = {
      activate: {
        title: 'Aktivasi Hak Akses Validasi',
        desc: `Otoritaskan kembali akun ${validator.name} (${validator.satgasId}) untuk memindai boks makanan di ${validator.school}. Log aktivitas akan ditandatangani secara digital.`,
        riskLevel: 'PROSEDUR STANDAR',
        btnText: 'Aktivasi Akun Sekarang',
        btnClass: 'bg-emerald-600 hover:bg-emerald-700',
      },
      deactivate: {
        title: 'Pembekuan Otoritas Validasi (Lockout)',
        desc: `Tindakan darurat: Cabut hak pemindaian ${validator.name}. Validator tidak dapat mengirimkan BAST atau menyetujui distribusi porsi makanan hingga audit fisik selesai.`,
        riskLevel: 'INTERVENSI KRITIS TINGKAT 2',
        btnText: 'Bekukan Akun Sementara',
        btnClass: 'bg-rose-600 hover:bg-rose-700',
      },
      resetDevice: {
        title: 'Reset Hardware Token & Device Binding',
        desc: `Putus tautan kriptografis token perangkat (${validator.device} • ${validator.deviceId}). Validator diwajibkan melakukan otentikasi ulang biometrik dan registrasi perangkat baru.`,
        riskLevel: 'RESET KEAMANAN HARDWARE',
        btnText: 'Putus Tautan Token',
        btnClass: 'bg-blue-600 hover:bg-blue-700',
      },
      warn: {
        title: 'Penerbitan Surat Peringatan SOP Digital',
        desc: `Kirim surat teguran pelanggaran Pasal 14 Juknis MBG RI ke ponsel ${validator.name} terkait anomali pemindaian kilat (${validator.avgDuration}s < ambang batas 0.50s). Tembusan otomatis terkirim ke Kepala Sekolah & Satgas Wilayah.`,
        riskLevel: 'TEGURAN RESMI PEMERINTAH',
        btnText: 'Kirim Surat Peringatan Digital',
        btnClass: 'bg-amber-600 hover:bg-amber-700',
      },
      assignBackup: {
        title: 'Alihkan Otoritas ke Guru Piket Cadangan',
        desc: `Limpahkan hak verifikasi porsi hari ini di ${validator.school} kepada Guru Piket Cadangan terakreditasi Dapodik untuk mencegah keterlambatan makan siang siswa.`,
        riskLevel: 'PENUGASAN DARURAT LAPANGAN',
        btnText: 'Tugaskan Petugas Cadangan',
        btnClass: 'bg-blue-600 hover:bg-blue-700',
      },
    }

    // Isi surat peringatan disusun dari angka yang benar-benar tercatat di
    // scan_logs, bukan kalimat generik. Anomali per-boks didahulukan karena
    // itu sebab sebenarnya — rata-rata bisa tetap di atas ambang.
    const noScans = validator.scansToday === 0
    const avgBelowThreshold = !noScans && validator.avgDuration < MIN_INSPECTION_SEC
    const finding = noScans
      ? 'Belum ada riwayat pindai hari ini, sehingga kepatuhan Pasal 14 belum dapat dinilai.'
      : validator.anomalies > 0
        ? `${validator.anomalies} dari ${validator.scansToday} pindai tercatat di bawah ambang 0,20 detik per porsi${avgBelowThreshold ? ` (rata-rata ${validator.avgDuration}s)` : ''}.`
        : `Rata-rata durasi inspeksi ${validator.avgDuration}s dari ${validator.scansToday} pindai hari ini.`

    setWarnNote(
      `Teguran resmi Pasal 14 Juknis MBG. ${finding} Temuan perlu verifikasi lapangan. Mohon validator menjalankan inspeksi visual penuh pada setiap porsi dan mencatat suhu holding boks.`
    )
    setBackupChoice('')
    setConfirmAction({ type, validator, ...actionConfigs[type] })
  }

  const [pendingAction, setPendingAction] = useState(null) // {type, validatorId}

  const executeConfirmedAction = async () => {
    if (!confirmAction) return
    const { type, validator } = confirmAction

    // Aksi yang butuh input pengguna refuses jalan bila inputnya kosong —
    // lebih baik gagal di depan daripada mengirim permintaan tidak lengkap.
    const payload = type === 'warn' ? warnNote.trim() : type === 'assignBackup' ? backupChoice : undefined
    if (type === 'warn' && !payload) {
      showToast?.('Isi isi surat peringatan sebelum dikirim.')
      return
    }
    if (type === 'assignBackup' && !payload) {
      showToast?.('Pilih guru piket cadangan terlebih dahulu.')
      return
    }

    setPendingAction({ type, validatorId: validator.id })
    await onAction?.(type, validator, payload)
    setPendingAction(null)
    setConfirmAction(null)
  }

  // Hapus akun validator memerlukan konfirmasi kedua; dialog tetap terbuka
  // bila server menolak agar pengguna melihat pesan dan bisa mencoba lagi.
  const executeDelete = async () => {
    if (!confirmDelete) return
    setPendingDelete(true)
    const res = await onDelete?.(confirmDelete)
    setPendingDelete(false)
    if (res?.ok !== false) setConfirmDelete(null)
  }

  return (
    <div className="space-y-6">
      {/* ====================================================================
          1. COMPACT TOP UTILITY & LIVE TELEMETRY BAR (NO HEAVY CARD)
          ==================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-xs text-slate-500 font-medium">
          Daftar Verifikator Makanan &amp; Kepatuhan Pasal 14 Juknis MBG
        </div>

        <div className="flex items-center gap-2 shrink-0">
          {canManage && onCreate && (
            <button
              onClick={onCreate}
              className="px-3.5 py-1.5 text-xs font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition flex items-center gap-2 shadow-2xs cursor-pointer hover:shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
            >
              <UserPlus className="h-3.5 w-3.5" />
              <span>Tambah Validator</span>
            </button>
          )}

          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl transition flex items-center gap-2 shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Ekspor Log Audit (CSV)</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition flex items-center gap-2 shadow-2xs cursor-pointer hover:shadow-xs focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
          >
            <Printer className="h-3.5 w-3.5 text-slate-300" />
            <span>Cetak Halaman</span>
          </button>
        </div>
      </div>

      {/* ====================================================================
          2. EXECUTIVE TELEMETRY COMMAND RIBBON
          ==================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Metric 1: Kesiapan Armada Lapangan */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-[11px] font-medium text-slate-500">
              Armada validator aktif
            </span>
            
          </div>

          <div className="my-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-slate-900 tabular-nums tracking-tight">
                {stats.active}
              </span>
              <span className="text-xs text-slate-500 font-medium">dari {stats.total} petugas terdaftar</span>
            </div>

            {/* Segmented Fleet Distribution Bar */}
            <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden flex">
              <div
                style={{ width: `${(stats.active / stats.total) * 100}%` }}
                className="bg-emerald-500 h-full"
                title={`${stats.active} Aktif Lapangan`}
              />
              <div
                style={{ width: `${(stats.flagged / stats.total) * 100}%` }}
                className="bg-amber-500 h-full"
                title={`${stats.flagged} Perlu Perhatian`}
              />
              <div
                style={{ width: `${(stats.inactive / stats.total) * 100}%` }}
                className="bg-slate-300 h-full"
                title={`${stats.inactive} Standby`}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 font-mono">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                {stats.active} Aktif
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                {stats.flagged} Anomali
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                {stats.inactive} Nonaktif
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Perangkat terverifikasi:</span>
            <span className="font-bold text-slate-700 font-mono">
              {validatorsList.filter((v) => v.attestationStatus).length} / {stats.total}
            </span>
          </div>
        </div>

        {/* Metric 2: Integritas Audit SOP (Clickable to Filter) */}
        <button
          type="button"
          aria-pressed={statusFilter === 'flagged'}
          onClick={() => setStatusFilter(statusFilter === 'flagged' ? 'all' : 'flagged')}
          className={`bg-white rounded-2xl p-5 border text-left relative overflow-hidden flex flex-col justify-between transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
            statusFilter === 'flagged'
              ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/10'
              : 'border-slate-200/90 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-[11px] font-medium text-slate-500">
              Audit kepatuhan SOP
            </span>
            <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/80">
              PASAL 14 JUKNIS
            </span>
          </div>

          <div className="my-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-rose-800 font-mono tracking-tight">
                {stats.flagged}
              </span>
              <span className="text-xs font-bold text-rose-700">Pelanggaran Kritis</span>
            </div>

            <div className="mt-2.5 p-2.5 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-900 leading-snug">
              {stats.flagged === 0 ? (
                <p className="font-semibold text-rose-800">Tidak ada pelanggaran ambang durasi inspeksi.</p>
              ) : (
                <>
                  <p className="font-semibold flex items-center gap-1.5 text-rose-800">
                    <AlertTriangle className="h-4 w-4 shrink-0" />
                    <span>{stats.flagged} petugas memindai di bawah 0.20 detik per porsi</span>
                  </p>
                  <ul className="mt-1.5 space-y-0.5 text-rose-800">
                    {stats.flaggedList.map((v) => (
                      <li key={v.id} className="flex items-baseline justify-between gap-3">
                        <span className="truncate">{v.school}</span>
                        <span className="font-mono font-bold shrink-0">{v.avgDuration}s</span>
                      </li>
                    ))}
                  </ul>
                </>
              )}
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[10px] flex items-center justify-between gap-2 text-blue-700 font-bold">
            <span className="flex items-center gap-1">
              {statusFilter === 'flagged' && <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />}
              {statusFilter === 'flagged' ? 'Menyaring anomali' : 'Saring anomali'}
            </span>
          </div>
        </button>

        {/* Metric 3: Kecepatan Rata-Rata Inspeksi Fisik (Telemetric Gauge) */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-[11px] font-medium text-slate-500">
              Rata-rata durasi inspeksi per boks
            </span>
            <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/60">
              TARGET &ge; 0.50s
            </span>
          </div>

          <div className="my-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-slate-900 tabular-nums tracking-tight">
                {stats.avgDuration}s
              </span>
              <span className="text-xs text-slate-500 font-medium">
                ambang minimum 0.50s
              </span>
            </div>

            {/* Gauge Benchmark Scale */}
            <div className="mt-3">
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden relative flex">
                {/* 0 to 0.2s Red Danger Zone */}
                <div style={{ width: '20%' }} className="bg-rose-400 h-full" title="Zona Anomali <0.20s" />
                {/* 0.2s to 0.5s Amber Caution Zone */}
                <div style={{ width: '30%' }} className="bg-amber-400 h-full" title="Zona Perhatian 0.20s - 0.49s" />
                {/* >= 0.5s Green Compliant Zone */}
                <div style={{ width: '50%' }} className="bg-emerald-500 h-full" title="Zona Sesuai SOP >=0.50s" />
              </div>

              {/* Threshold Labels */}
              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1 font-mono">
                <span>0.0s</span>
                <span className="text-rose-800 font-bold">0.2s (Batas)</span>
                <span className="text-emerald-700 font-bold">0.5s (SOP)</span>
                <span>1.5s+</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Tingkat Kepatuhan SOP:</span>
            <span className="font-bold text-emerald-800 font-mono">{stats.complianceRate}% Lolos</span>
          </div>
        </div>

        {/* Metric 4: Volume Skrining Porsi Real-time */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 relative overflow-hidden flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-[11px] font-medium text-slate-500">
              Porsi diskrining hari ini
            </span>
            <span className="text-[10px] font-mono font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200/60">
              HARI INI
            </span>
          </div>

          <div className="my-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-slate-900 tabular-nums tracking-tight">
                {stats.totalScans}
              </span>
              <span className="text-xs text-slate-500 font-medium">/ {stats.targetScans} porsi target</span>
            </div>

            {/* Progress Bar */}
            <div className="mt-3">
              <div className="h-2 w-full rounded-full bg-slate-100 overflow-hidden">
                <div
                  style={{ width: `${Math.min(100, Math.round((stats.totalScans / stats.targetScans) * 100))}%` }}
                  className="bg-blue-600 h-full rounded-full transition-all duration-500"
                />
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500 mt-1.5 font-mono">
                <span>Progres: {stats.targetScans > 0 ? Math.round((stats.totalScans / stats.targetScans) * 100) : 0}%</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Kuota harian:</span>
            <span className="font-bold text-slate-700 font-mono">{stats.targetScans} porsi</span>
          </div>
        </div>
      </div>

      {/* ====================================================================
          3. TELEMETRY ANALYTICS (CHARTS)
          ==================================================================== */}
      <ValidatorCharts validators={validatorsList} />

      {/* ====================================================================
          4. ENTERPRISE FILTER & COMMAND TOOLBAR
          ==================================================================== */}
      <div className="bg-white rounded-2xl p-4 border border-slate-200/90 shadow-xs space-y-3.5">
        {/* Status Filter Tabs (Segmented Control) */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 border-b border-slate-100">
          <button
            onClick={() => setStatusFilter('all')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              statusFilter === 'all'
                ? 'bg-slate-900 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Semua Petugas ({stats.total})
          </button>

          <button
            onClick={() => setStatusFilter('flagged')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap flex items-center gap-1.5 cursor-pointer ${
              statusFilter === 'flagged'
                ? 'bg-rose-600 text-white shadow-sm'
                : 'text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/60'
            }`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
            <span>Butuh Audit SOP ({stats.flagged})</span>
          </button>

          <button
            onClick={() => setStatusFilter('active')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              statusFilter === 'active'
                ? 'bg-emerald-700 text-white shadow-sm'
                : 'text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200/60'
            }`}
          >
            Aktif di Lapangan ({stats.active})
          </button>

          <button
            onClick={() => setStatusFilter('certified')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              statusFilter === 'certified'
                ? 'bg-blue-700 text-white shadow-sm'
                : 'text-blue-700 bg-blue-50 hover:bg-blue-100 border border-blue-200/60'
            }`}
          >
            Sertifikasi Lanjutan ({validatorsList.filter((v) => v.certification.includes('Lanjutan')).length})
          </button>

          <button
            onClick={() => setStatusFilter('inactive')}
            className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap cursor-pointer ${
              statusFilter === 'inactive'
                ? 'bg-slate-700 text-white shadow-sm'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            Nonaktif / Dispensasi ({stats.inactive})
          </button>
        </div>

        {/* Search & Advanced Filters */}
        <div className="flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
          {/* Search Box */}
          <div className="relative flex-1">
            <svg className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <circle cx="11" cy="11" r="8" strokeWidth="2" />
              <path d="m21 21-4.35-4.35" strokeWidth="2" />
            </svg>
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari berdasarkan Nama Guru, NIP, NPSN Sekolah, Satgas ID, atau Wilayah..."
              className="w-full pl-10 pr-12 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
            {search ? (
              <button
                onClick={() => setSearch('')}
                aria-label="Bersihkan pencarian"
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-slate-500 hover:text-slate-800 hover:bg-slate-100 rounded-md transition cursor-pointer"
              >
                <X className="h-4 w-4" />
              </button>
            ) : (
            <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-mono text-slate-500 border border-slate-200 rounded px-1 pointer-events-none">
                {filtered.length}/{validatorsList.length}
              </span>
            )}
          </div>

          {/* Dropdown Filters */}
          <div className="flex items-center gap-2 flex-wrap">
            {/* City Dropdown */}
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              aria-label="Filter Wilayah Kerja"
              className="px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition cursor-pointer"
            >
              <option value="all">Semua Wilayah</option>
              {cities.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>

            {/* Hardware Attestation Filter */}
            <select
              value={hardwareFilter}
              onChange={(e) => setHardwareFilter(e.target.value)}
              aria-label="Filter Tipe Perangkat & Enclave"
              className="px-3 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition cursor-pointer"
            >
              <option value="all">Semua Perangkat</option>
              <option value="ios">Apple Secure Enclave</option>
              <option value="android">Android Play Integrity</option>
            </select>

            {/* Density Toggle */}
            <div className="hidden sm:flex items-center border border-slate-200 rounded-xl overflow-hidden bg-slate-50 p-0.5">
              <button
                onClick={() => setDensity('normal')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                  density === 'normal' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Standar
              </button>
              <button
                onClick={() => setDensity('compact')}
                className={`px-2.5 py-1 text-[11px] font-bold rounded-lg transition cursor-pointer ${
                  density === 'compact' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                Kompak
              </button>
            </div>

            {/* Reset Filter Button */}
            {(search || statusFilter !== 'all' || cityFilter !== 'all' || hardwareFilter !== 'all') && (
              <button
                onClick={resetFilters}
                className="px-3 py-2 text-xs font-bold text-rose-700 hover:bg-rose-50 rounded-xl transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
              >
                Reset filter
              </button>
            )}
          </div>
        </div>
      </div>

      {/* ====================================================================
          5. 1-BILLION RUPIAH TELEMETRIC DATA GRID
          ==================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full min-w-[880px] text-left text-xs">
            <caption className="sr-only">
              Roster petugas validator lapangan beserta durasi inspeksi, kuota porsi, dan status sistem
            </caption>
            <thead>
              <tr className="text-slate-500 border-b border-slate-200 bg-slate-50/50 text-[11px] font-semibold uppercase tracking-wider">
                <th className="px-5 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Validator</th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Wilayah & Instansi</th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Telemetri GPS</th>
                <th className="px-4 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Durasi Pindai</th>
                <th className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Porsi</th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Sertifikasi</th>
                <th className="px-3 py-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Status</th>
                <th className="px-3 py-3 hidden xl:table-cell text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Perangkat</th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Aksi</th>
              </tr>
            </thead>

            <tbody className="divide-y divide-slate-100">
              {filtered.map((v) => {
                const isAnomaly = isFastInspection(v) || v.status === 'flagged'
                const isMenuOpen = openMenuId === v.id
                const paddingY = density === 'compact' ? 'py-2.5' : 'py-3.5'
                const certLevel = v.certification.includes('Lanjutan')
                  ? 'advanced'
                  : v.certification.includes('Dasar')
                  ? 'basic'
                  : 'none'

                return (
                  <tr
                    key={v.id}
                    onClick={() => setSelectedValidator(v)}
                    tabIndex={0}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        setSelectedValidator(v)
                      }
                    }}
                    aria-label={`Inspeksi ${v.name}, ${v.school}`}
                    className={`transition-colors cursor-pointer group focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-blue-600 hover:bg-slate-50/80 border-l-2 ${
                      isAnomaly ? 'border-l-rose-500' : 'border-l-transparent'
                    }`}
                  >
                    {/* Col 1: Petugas Validator */}
                    <td className={`px-5 ${paddingY}`}>
                      <div className="flex items-center gap-3">
                        {/* Official Satgas Badge Avatar */}
                        <div
                          className={`h-9 w-9 rounded-full flex items-center justify-center font-bold text-xs shrink-0 ${
                            isAnomaly
                              ? 'bg-rose-100 text-rose-700'
                              : v.status === 'active'
                              ? 'bg-blue-50 text-blue-700'
                              : 'bg-slate-100 text-slate-600'
                          }`}
                        >
                          {v.name
                            .split(' ')
                            .filter((_, i) => i < 2)
                            .map((p) => p[0])
                            .join('')}
                        </div>

                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors text-sm">
                              {v.name}
                            </span>
                            {v.dapodikVerified && (
                              <span className="inline-flex text-emerald-800" title="Dapodik terverifikasi">
                                <CheckCircle2 className="h-3.5 w-3.5" />
                                <span className="sr-only">Dapodik terverifikasi</span>
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="font-mono text-[11px] text-slate-500 bg-slate-100 px-1 rounded-sm">
                              {v.satgasId || 'ID belum ada'}
                            </span>
                            <span className="text-[11px] text-slate-500 truncate max-w-[190px]">
                              {v.role}
                            </span>
                          </div>
                        </div>
                      </div>
                    </td>

                    {/* Col 2: Satuan Pendidikan & Lokasi */}
                    <td className={`px-3 ${paddingY}`}>
                      <p className="font-semibold text-slate-900 leading-snug">{v.school}</p>
                      <p className="text-[11px] text-slate-500 mt-0.5">
                        {v.city}
                        <span className="font-mono text-slate-500"> · NPSN {v.npsn}</span>
                      </p>
                    </td>

                    {/* Col 3: Presensi GPS & Telemetri */}
                    <td className={`px-3 ${paddingY}`}>
                      <span
                        className={`inline-flex items-center gap-1.5 text-[11px] font-medium ${
                          v.geoStatus === 'warning' ? 'text-rose-700' : 'text-slate-700'
                        }`}
                      >
                        <span className={`h-1.5 w-1.5 rounded-full ${v.geoStatus === 'warning' ? 'bg-rose-500' : 'bg-emerald-500'}`} />
                        {v.geoDistance || 'radius tidak tercatat'}
                      </span>
                      <div className="text-[11px] text-slate-500 mt-0.5 font-mono">
                        {v.lastScan}
                        {v.battery ? ` · baterai ${v.battery}` : ''}
                      </div>
                    </td>

                    {/* Col 4: Kecepatan Scan (Telemetric Velocity Gauge) */}
                    <td className={`px-4 ${paddingY}`}>
                      <div className="space-y-1.5 min-w-[150px]">
                        <div className="flex items-center justify-between">
                          <span className={`font-mono font-medium text-sm ${isAnomaly ? 'text-rose-800' : 'text-slate-900'}`}>
                            {v.avgDuration}s <span className="text-[11px] text-slate-500">/ boks</span>
                          </span>
                          {isAnomaly ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-rose-700 bg-rose-50 px-1.5 rounded">
                              <AlertTriangle className="h-3 w-3 shrink-0" />
                              Pindai kilat
                            </span>
                          ) : (
                            <span className="text-[10px] font-semibold text-emerald-700 bg-emerald-50 px-1.5 rounded">Sesuai SOP</span>
                          )}
                        </div>

                        {/* Interactive Velocity Bar */}
                        <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden relative">
                          <div
                            style={{ width: `${Math.min(100, Math.round((v.avgDuration / 1.5) * 100))}%` }}
                            className={`h-full rounded-full ${
                              isAnomaly
                                ? 'bg-rose-500'
                                : v.avgDuration >= 1.0
                                ? 'bg-blue-600'
                                : 'bg-emerald-500'
                            }`}
                          />
                          {/* Standard SOP 0.5s line marker */}
                          <div
                            style={{ left: '33.3%' }}
                            className="absolute top-0 bottom-0 w-0.5 bg-slate-400"
                            title="Batas Minimum SOP Kemenkes: 0.50 detik"
                          />
                        </div>
                      </div>
                    </td>

                    {/* Col 5: Porsi Hari Ini */}
                    <td className={`px-3 ${paddingY} text-right`}>
                      {v.quotaToday ? (
                        <>
                          <span className="font-mono font-medium text-slate-900 text-sm">{v.scansToday}</span>
                          <span className="text-[11px] font-mono text-slate-500"> / {v.quotaToday}</span>
                          <div className="text-[11px] text-slate-500 mt-0.5">
                            {Math.round((v.scansToday / v.quotaToday) * 100)}%
                          </div>
                        </>
                      ) : (
                        <>
                          <span className="font-mono font-medium text-slate-900 text-sm">{v.scansToday ?? 0}</span>
                          <div className="text-[11px] text-slate-500 mt-0.5">kuota belum ditetapkan</div>
                        </>
                      )}
                    </td>

                    {/* Col 6: Sertifikasi Higienitas */}
                    <td className={`px-3 ${paddingY}`}>
                      {certLevel === 'advanced' ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-700">
                          <ShieldCheck className="h-3.5 w-3.5 shrink-0 text-blue-800" />
                          <span>HACCP Lanjutan</span>
                        </span>
                      ) : certLevel === 'basic' ? (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-700">
                          <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-800" />
                          <span>Dasar</span>
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-700">
                          <Clock className="h-3.5 w-3.5 shrink-0 text-amber-500" />
                          <span>Dispensasi</span>
                        </span>
                      )}
                    </td>

                    {/* Col 7: Status Sistem */}
                    <td className={`px-3 ${paddingY}`}>
                      {v.status === 'active' && (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />
                          <span>Aktif</span>
                        </span>
                      )}
                      {v.status === 'flagged' && (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                          <span>Perlu audit</span>
                        </span>
                      )}
                      {v.status === 'inactive' && (
                        <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-slate-700">
                          <span className="h-1.5 w-1.5 rounded-full bg-slate-300" />
                          <span>Dibekukan</span>
                        </span>
                      )}
                    </td>

                    {/* Col 8: Perangkat Terikat */}
                    <td className={`px-3 ${paddingY} hidden xl:table-cell`}>
                      <span className="font-mono text-[11px] text-slate-700">
                        <Lock className="inline h-3.5 w-3.5 mr-1 align-[-1px] text-slate-500" />
                        {v.device}
                      </span>
                    </td>

                    {/* Col 9: Aksi Audit */}
                    <td
                      className={`px-5 ${paddingY} text-right relative`}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => setSelectedValidator(v)}
                          className="px-3 py-1.5 text-xs font-medium text-slate-700 bg-white hover:bg-slate-50 border border-slate-200 rounded-lg shadow-sm transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                        >
                          Detail
                        </button>

                        {isAnomaly && canManage && (
                          <button
                            onClick={() => promptAction('warn', v)}
                            className="px-3 py-1.5 text-xs font-medium text-rose-700 bg-rose-50 hover:bg-rose-100 border border-rose-200/60 rounded-lg transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-rose-600"
                          >
                            Tegur
                          </button>
                        )}

                        {canManage && (
                        <div className="relative">
                          <button
                            onClick={(e) => {
                              e.stopPropagation()
                              setOpenMenuId(isMenuOpen ? null : v.id)
                            }}
                            className={`p-2 rounded-md transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 ${
                              isMenuOpen
                                ? 'bg-slate-200 text-slate-900'
                                : 'text-slate-500 hover:text-slate-800 hover:bg-slate-100'
                            }`}
                            aria-label={`Tindakan lain untuk ${v.name}`}
                            aria-expanded={isMenuOpen}
                            aria-haspopup="menu"
                          >
                            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <circle cx="12" cy="12" r="1.5" strokeWidth="2" />
                              <circle cx="19" cy="12" r="1.5" strokeWidth="2" />
                              <circle cx="5" cy="12" r="1.5" strokeWidth="2" />
                            </svg>
                          </button>

                          {/* DROPDOWN MENU */}
                          {isMenuOpen && (
                            <div
                              ref={dropdownRef}
                              role="menu"
                              aria-label={`Tindakan untuk ${v.name}`}
                              className="absolute right-0 top-full mt-1.5 w-56 bg-white rounded-lg border border-slate-200 shadow-lg py-1 z-30 text-left"
                            >
                              <div className="px-3 py-1.5 text-[10px] font-semibold text-slate-500 border-b border-slate-100">
                                Tindakan untuk {v.name}
                              </div>

                              <div className="py-1">
                                {v.status !== 'active' ? (
                                  <button
                                    role="menuitem"
                                    onClick={() => promptAction('activate', v)}
                                    className="w-full px-3 py-2 text-[11px] text-left text-emerald-800 hover:bg-emerald-50 flex items-center gap-2 font-medium cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-emerald-700"
                                  >
                                    <CheckCircle2 className="h-4 w-4 shrink-0" />
                                    <span>Aktifkan akun</span>
                                  </button>
                                ) : (
                                  <button
                                    role="menuitem"
                                    onClick={() => promptAction('deactivate', v)}
                                    className="w-full px-3 py-2 text-[11px] text-left text-rose-800 hover:bg-rose-50 flex items-center gap-2 font-medium cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-rose-700"
                                  >
                                    <Lock className="h-4 w-4 shrink-0" />
                                    <span>Bekukan akses</span>
                                  </button>
                                )}

                                <button
                                  role="menuitem"
                                  onClick={() => promptAction('resetDevice', v)}
                                  className="w-full px-3 py-2 text-[11px] text-left text-blue-800 hover:bg-blue-50 flex items-center gap-2 font-medium cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-700"
                                >
                                  <Lock className="h-4 w-4 shrink-0" />
                                  <span>Reset tautan perangkat</span>
                                </button>

                                <button
                                  role="menuitem"
                                  onClick={() => promptAction('warn', v)}
                                  className="w-full px-3 py-2 text-[11px] text-left text-amber-900 hover:bg-amber-50 flex items-center gap-2 font-medium cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-amber-700"
                                >
                                  <AlertTriangle className="h-4 w-4 shrink-0" />
                                  <span>Kirim peringatan SOP</span>
                                </button>

                                <button
                                  role="menuitem"
                                  onClick={() => promptAction('assignBackup', v)}
                                  className="w-full px-3 py-2 text-[11px] text-left text-blue-800 hover:bg-blue-50 flex items-center gap-2 font-medium cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-700"
                                >
                                  <Users className="h-4 w-4 shrink-0" />
                                  <span>Tugaskan petugas cadangan</span>
                                </button>
                                {(onEdit || onDelete) && (
                                  <div className="my-1 border-t border-slate-100" />
                                )}

                                {onEdit && (
                                  <button
                                    role="menuitem"
                                    onClick={() => {
                                      setOpenMenuId(null)
                                      onEdit(v)
                                    }}
                                    className="w-full px-3 py-2 text-[11px] text-left text-slate-700 hover:bg-slate-50 flex items-center gap-2 font-medium cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-slate-600"
                                  >
                                    <UserCog className="h-4 w-4 shrink-0" />
                                    <span>Edit akun &amp; kredensial</span>
                                  </button>
                                )}

                                {onDelete && (
                                  <button
                                    role="menuitem"
                                    onClick={() => {
                                      setOpenMenuId(null)
                                      setConfirmDelete(v)
                                    }}
                                    className="w-full px-3 py-2 text-[11px] text-left text-rose-700 hover:bg-rose-50 flex items-center gap-2 font-medium cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-rose-700"
                                  >
                                    <Trash2 className="h-4 w-4 shrink-0" />
                                    <span>Hapus akun validator</span>
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                        )}
                      </div>
                    </td>
                  </tr>
                )
              })}

              {filtered.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-5 py-12 text-center">
                    {loading ? (
                      <>
                        <p className="font-bold text-slate-900 text-sm">Memuat roster validator…</p>
                        <p className="text-xs text-slate-600 mt-1">Mengambil data dari API Gateway.</p>
                      </>
                    ) : validatorsList.length === 0 ? (
                      <>
                        <p className="font-bold text-slate-900 text-sm">Belum ada petugas di roster ini.</p>
                        <p className="text-xs text-slate-600 mt-1">
                          Backend mengembalikan roster kosong; tidak ada data petugas lapangan yang tercatat.
                        </p>
                      </>
                    ) : (
                      <>
                        <p className="font-bold text-slate-900 text-sm">
                          {search ? `Tidak ada petugas yang cocok dengan &quot;${search}&quot;.` : 'Tidak ada petugas pada filter ini.'}
                        </p>
                        <p className="text-xs text-slate-600 mt-1">
                          {validatorsList.length} petugas terdaftar. Reset filter untuk melihat semuanya.
                        </p>
                        <button
                          onClick={resetFilters}
                          className="mt-3 px-3 py-1.5 text-xs font-bold text-slate-700 bg-white border border-slate-300 rounded-lg hover:bg-slate-50 transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                        >
                          Reset filter
                        </button>
                      </>
                    )}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Telemetry Summary */}
        <div className="px-5 py-2.5 border-t border-slate-100 text-xs text-slate-500 flex flex-col sm:flex-row items-center justify-between gap-2 bg-slate-50/50">
          <span className="font-mono text-[11px]">
            Menampilkan <strong className="text-slate-900">{filtered.length}</strong> dari{' '}
            <strong className="text-slate-900">{validatorsList.length}</strong> petugas di roster ini
          </span>
          <span className="font-mono text-[11px] text-slate-500">
            Data simulasi &bull; belum terhubung ke Dapodik atau EMIS
          </span>
        </div>
      </div>

      {/* ====================================================================
          6. PALANTIR / LINEAR-STYLE SLIDE-OVER TELEMETRY DRAWER (SHEET)
          ==================================================================== */}
      {selectedValidator && (
        <div className="fixed inset-0 z-50 overflow-hidden animate-in fade-in duration-200">
          {/* Backdrop */}
          <div
            onClick={() => setSelectedValidator(null)}
            className="fixed inset-0 bg-slate-900/60 backdrop-blur-xs transition-opacity"
          />

          <div className="fixed inset-y-0 right-0 max-w-full flex pl-10">
            <div className="w-screen max-w-xl bg-white shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300 overflow-hidden">
              {/* Drawer Top Header (Satgas ID Badge Preview) */}
              <div className="p-6 bg-slate-900 text-white border-b border-slate-800 shrink-0">
                <div className="flex items-start justify-between">
                  <div className="space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-medium text-blue-300">
                        BADAN GIZI NASIONAL RI &bull; KARTU KENDALI PETUGAS
                      </span>
                      <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
                    </div>

                    <h3 className="text-lg font-black tracking-tight text-white">
                      {selectedValidator.name}
                    </h3>

                    <p className="text-xs text-slate-300">
                      {selectedValidator.role} &bull; {selectedValidator.school}
                    </p>
                  </div>

                  <button
                    onClick={() => setSelectedValidator(null)}
                    className="p-1.5 text-slate-500 hover:text-white rounded-lg transition cursor-pointer"
                    aria-label="Tutup Panel Detail"
                  >
                    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  </button>
                </div>

                {/* Sub-Badges */}
            <div className="flex flex-wrap items-center gap-2 mt-4 pt-3 border-t border-slate-800 text-[10px] font-mono">
              <span className="bg-slate-800 text-slate-200 px-2.5 py-0.5 rounded-md border border-slate-700">
                {selectedValidator.satgasId || 'ID belum tersedia'}
              </span>
                  <span className="bg-slate-800 text-slate-200 px-2.5 py-0.5 rounded-md border border-slate-700">
                    NPSN: {selectedValidator.npsn}
                  </span>
                  <span className={`px-2.5 py-0.5 rounded-md font-bold ${
                    selectedValidator.status === 'active'
                      ? 'bg-emerald-950 text-emerald-400 border border-emerald-800'
                      : selectedValidator.status === 'flagged'
                      ? 'bg-rose-950 text-rose-400 border border-rose-800'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}>
                    STATUS: {selectedValidator.status.toUpperCase()}
                  </span>
                </div>
              </div>

              {/* Drawer Navigation Tabs */}
              <div className="flex items-center border-b border-slate-200 bg-slate-50 px-6 shrink-0">
                <button
                  onClick={() => setDrawerTab('credentials')}
                  className={`py-3 px-3 text-xs font-bold border-b-2 transition cursor-pointer ${
                    drawerTab === 'credentials'
                      ? 'border-blue-600 text-blue-800 bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Kredensial & Satuan
                </button>
                <button
                  onClick={() => setDrawerTab('telemetry')}
                  className={`py-3 px-3 text-xs font-bold border-b-2 transition cursor-pointer ${
                    drawerTab === 'telemetry'
                      ? 'border-blue-600 text-blue-800 bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Telemetri & Enclave
                </button>
                <button
                  onClick={() => setDrawerTab('scans')}
                  className={`py-3 px-3 text-xs font-bold border-b-2 transition cursor-pointer flex items-center gap-1.5 ${
                    drawerTab === 'scans'
                      ? 'border-blue-600 text-blue-800 bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  <span>Log Audit Porsi</span>
                  <span className="font-mono text-[11px] bg-slate-200 text-slate-700 px-1.5 py-0.2 rounded-full">
                    {selectedValidator.scansToday}
                  </span>
                </button>
                <button
                  onClick={() => setDrawerTab('actions')}
                  className={`py-3 px-3 text-xs font-bold border-b-2 transition cursor-pointer ${
                    drawerTab === 'actions'
                      ? 'border-blue-600 text-blue-800 bg-white'
                      : 'border-transparent text-slate-500 hover:text-slate-900'
                  }`}
                >
                  Intervensi Disiplin
                </button>
              </div>

              {/* Drawer Tab Content (Scrollable) */}
              <div className="p-6 overflow-y-auto space-y-6 flex-1 text-slate-800">
                {/* TAB 1: KREDENSIAL & SATUAN PENDIDIKAN */}
                {drawerTab === 'credentials' && (
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200 space-y-3">
                      <h4 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">
                        Kredensial Kepegawaian & Dapodik
                      </h4>
                      <div className="grid grid-cols-2 gap-3 text-xs">
                        <div>
                          <span className="text-[11px] text-slate-500 font-mono">NOMOR INDUK PEGAWAI (NIP):</span>
                          <p className="font-mono font-bold text-slate-900">{selectedValidator.nip || 'Tidak diisi'}</p>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500 font-mono">PENDIDIKAN / GELAR:</span>
                          <p className="font-bold text-slate-900">{selectedValidator.degree || 'Tidak diisi'}</p>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500 font-mono">STATUS VERIFIKASI:</span>
                          <p className="font-bold text-emerald-700 flex items-center gap-1">
                            <CheckCircle2 className="h-4 w-4 shrink-0" />
                            <span>Terverifikasi</span>
                          </p>
                        </div>
                        <div>
                          <span className="text-[11px] text-slate-500 font-mono">VERIFIKASI DAPODIK:</span>
                          <p className="font-mono text-slate-800">
                            {selectedValidator.dapodikVerified ? 'Terverifikasi' : 'Belum diverifikasi'}
                          </p>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200 space-y-3">
                      <h4 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">
                        Satuan Pendidikan Penerima Manfaat
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500">Nama Sekolah:</span>
                          <span className="font-bold text-slate-900">{selectedValidator.school}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500">Nomor Pokok Sekolah Nasional:</span>
                          <span className="font-mono font-bold text-slate-900">{selectedValidator.npsn}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500">Kluster Wilayah Distribusi:</span>
                          <span className="text-slate-800 font-medium">{selectedValidator.cluster || selectedValidator.city}</span>
                        </div>
                      <div className="flex justify-between py-1 border-b border-slate-200/60">
                        <span className="text-slate-500">Akreditasi & Siswa Penerima:</span>
                        <span className="font-medium text-slate-800">
                          {selectedValidator.schoolAccreditation || 'Tidak diisi'} &bull;{' '}
                          {selectedValidator.studentBeneficiaries || 'Tidak diisi'}
                        </span>
                      </div>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200 space-y-3">
                      <h4 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">
                        Sertifikasi Higienitas & Sanitasi Pangan
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500">Lembaga Akreditasi:</span>
                          <span className="font-bold text-slate-900">{selectedValidator.certification}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500">Nomor Registrasi BNSP:</span>
                          <span className="font-mono text-slate-800">{selectedValidator.certNumber || '-'}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-500">Masa Berlaku:</span>
                          <span className="font-bold text-emerald-700">{selectedValidator.certExpiry || '-'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 2: TELEMETRI & ENCLAVE */}
                {drawerTab === 'telemetry' && (
                  <div className="space-y-4">
                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200 space-y-3">
                      <h4 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">
                        Hardware Attestation (Zero-Trust Security)
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500">Perangkat Terikat:</span>
                          <span className="font-bold text-slate-900 font-mono"><Smartphone className="inline h-4 w-4 mr-1 text-slate-500" /> {selectedValidator.device}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500">Attestation Token:</span>
                          <span className="font-mono text-[10px] text-blue-700 font-bold">{selectedValidator.attestationStatus}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500">Sistem Operasi & Versi:</span>
                          <span className="font-mono text-slate-800">{selectedValidator.osVersion || 'OS Verified'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500">Build Aplikasi Mobile MBG:</span>
                          <span className="font-mono text-slate-800">{selectedValidator.appVersion || 'v2.4.1'}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-500">UUID Token Kriptografi:</span>
                          <span className="font-mono text-[11px] text-slate-500">{selectedValidator.deviceUuid || 'uuid-8f92-xx'}</span>
                        </div>
                      </div>
                    </div>

                    <div className="rounded-2xl bg-slate-50 p-4 border border-slate-200 space-y-3">
                      <h4 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">
                        Presensi Geospasial & Jaringan Lapangan
                      </h4>
                      <div className="space-y-2 text-xs">
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500">Koordinat GPS:</span>
                          <span className="font-mono font-bold text-slate-900">{selectedValidator.gpsCoords || '-'}</span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500">Geo-Fence Perimeter:</span>
                          <span className={`font-mono font-bold ${selectedValidator.geoStatus === 'warning' ? 'text-rose-800' : 'text-emerald-700'}`}>
                            {selectedValidator.geoDistance || 'Dalam Radius Aman'}
                          </span>
                        </div>
                        <div className="flex justify-between py-1 border-b border-slate-200/60">
                          <span className="text-slate-500">Jaringan Provider:</span>
                          <span className="text-slate-800">{selectedValidator.network || '4G/5G'}</span>
                        </div>
                        <div className="flex justify-between py-1">
                          <span className="text-slate-500">Daya Baterai Ponsel:</span>
                          <span className="font-mono font-bold text-slate-900">{selectedValidator.battery || '80%'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 3: LOG AUDIT PORSI HARI INI */}
                {drawerTab === 'scans' && (
                  <div className="space-y-4">
                    {selectedValidator.status === 'flagged' && (
                      <div className="rounded-2xl bg-rose-50 border border-rose-200 p-4 space-y-2">
                        <div className="flex items-center gap-2 text-rose-800 font-bold text-xs">
                          <AlertOctagon className="h-4 w-4" />
                          <span>TEMUAN ANOMALI AUDIT: Kecepatan Pindai Tidak Wajar</span>
                        </div>
                        <p className="text-xs text-rose-700 leading-relaxed">
                          {selectedValidator.anomalyNotice || 'Durasi pemindaian per porsi 0.15 detik tidak memenuhi batas waktu fisiologis inspeksi mata manusia (minimal 0.50 detik) sebagaimana diatur dalam Pasal 14 Juknis Operasional MBG. Petugas diduga memindai QR code tanpa memeriksa kualitas fisik dan suhu makanan.'}
                        </p>
                      </div>
                    )}

                    <div className="space-y-2">
                      <h4 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">
                        Riwayat Pemindaian Boks Hari Ini (Timeline)
                      </h4>

                      <div className="divide-y divide-slate-100 border border-slate-200 rounded-2xl bg-slate-50/50 overflow-hidden">
                        {(selectedValidator.scanLogs || []).map((log, idx) => (
                          <div key={idx} className="p-3.5 flex items-center justify-between text-xs hover:bg-slate-100/60 transition">
                            <div className="space-y-0.5">
                              <div className="flex items-center gap-2">
                                <span className="font-mono font-bold text-slate-900">{log.time}</span>
                                <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-slate-200 text-slate-700 font-bold">
                                  {log.boxId}
                                </span>
                                {log.status === 'anomalous' ? (
                                  <span className="px-1.5 py-0.2 rounded text-[11px] font-black bg-rose-600 text-white">
                                    ANOMALI &lt;0.2s
                                  </span>
                                ) : (
                                  <span className="px-1.5 py-0.2 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800">
                                    VERIFIED
                                  </span>
                                )}
                              </div>
                              <p className="text-[11px] text-slate-600 truncate max-w-sm">{log.menu}</p>
                            </div>

                            <div className="text-right">
                              <p className={`font-mono font-bold ${log.status === 'anomalous' ? 'text-rose-800' : 'text-slate-900'}`}>
                                {log.duration}s
                              </p>
                              <p className="font-mono text-[11px] text-slate-500">Suhu: {log.temp}</p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                )}

                {/* TAB 4: TINDAKAN DISIPLINER SUPERADMIN */}
                {drawerTab === 'actions' && (
                  <div className="space-y-3">
                    <h4 className="text-xs font-bold text-slate-900 uppercase font-mono tracking-wider">
                      Intervensi Disipliner & Protokol Darurat
                    </h4>

                    {!canManage && (
                      <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-[11px] text-slate-600">
                        Role Anda hanya memiliki izin baca. Tindakan di bawah memerlukan izin{' '}
                        <code className="font-mono">validators.manage</code>.
                      </p>
                    )}

                    {/* Action 1: Kirim Peringatan SOP */}
                    <div className="p-4 rounded-2xl border border-amber-200 bg-amber-50/50 flex items-start justify-between gap-4">
                      <div>
                        <h5 className="text-xs font-bold text-amber-900">Kirim Peringatan SOP Digital</h5>
                        <p className="text-[11px] text-amber-700 mt-0.5 leading-relaxed">
                          Kirim notifikasi peringatan resmi dan SMS gateway terkait pelanggaran durasi inspeksi visual.
                        </p>
                      </div>
                      <button
                        onClick={() => promptAction('warn', selectedValidator)}
                        disabled={!canManage}
                        className="px-3 py-1.5 text-xs font-bold text-amber-900 bg-amber-200 hover:bg-amber-300 rounded-xl transition shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Terbitkan Teguran
                      </button>
                    </div>

                    {/* Action 2: Reset Perangkat */}
                    <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/50 flex items-start justify-between gap-4">
                      <div>
                        <h5 className="text-xs font-bold text-blue-900">Reset Tautan Token Hardware</h5>
                        <p className="text-[11px] text-blue-700 mt-0.5 leading-relaxed">
                          Putus tautan perangkat saat ini ({selectedValidator.device}) dan wajibkan pendaftaran ulang.
                        </p>
                      </div>
                      <button
                        onClick={() => promptAction('resetDevice', selectedValidator)}
                        disabled={!canManage}
                        className="px-3 py-1.5 text-xs font-bold text-blue-900 bg-blue-200 hover:bg-blue-300 rounded-xl transition shrink-0 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        Reset Token
                      </button>
                    </div>

                    {/* Action 3: Bekukan / Aktivasi */}
                    <div className="p-4 rounded-2xl border border-rose-200 bg-rose-50/50 flex items-start justify-between gap-4">
                      <div>
                        <h5 className="text-xs font-bold text-rose-900">
                          {selectedValidator.status === 'active' ? 'Bekukan Akses Validasi (Lockout)' : 'Aktivasi Akses Validasi'}
                        </h5>
                        <p className="text-[11px] text-rose-700 mt-0.5 leading-relaxed">
                          Blokir sementara kemampuan validator memindai QR code dan mengirimkan BAST porsi.
                        </p>
                      </div>
                      <button
                        onClick={() => promptAction(selectedValidator.status === 'active' ? 'deactivate' : 'activate', selectedValidator)}
                        disabled={!canManage}
                        className={`px-3 py-1.5 text-xs font-bold text-white rounded-xl transition shrink-0 cursor-pointer ${
                          selectedValidator.status === 'active' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-emerald-600 hover:bg-emerald-700'
                        }`}
                      >
                        {selectedValidator.status === 'active' ? 'Bekukan Akun' : 'Aktifkan Akun'}
                      </button>
                    </div>

                    {/* Action 4: Tugaskan Cadangan */}
                    <div className="p-4 rounded-2xl border border-blue-200 bg-blue-50/50 flex items-start justify-between gap-4">
                      <div>
                        <h5 className="text-xs font-bold text-blue-900">Tugaskan Petugas Cadangan</h5>
                        <p className="text-[11px] text-blue-700 mt-0.5 leading-relaxed">
                          Alihkan peran verifikasi porsi hari ini ke Guru Piket terdaftar di sekolah yang sama.
                        </p>
                      </div>
                      <button
                        onClick={() => promptAction('assignBackup', selectedValidator)}
                        disabled={!canManage}
                        className="px-3 py-1.5 text-xs font-bold text-blue-900 bg-blue-200 hover:bg-blue-300 rounded-xl transition shrink-0 cursor-pointer"
                      >
                        Tugaskan Cadangan
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* Drawer Bottom Bar */}
              <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between text-xs shrink-0">
                <span className="text-[10px] font-mono text-slate-500">
                  Actions dijalankan lokal &bull; belum tersinkron ke server
                </span>
                <button
                  onClick={() => setSelectedValidator(null)}
                  className="px-4 py-2 text-xs font-bold text-slate-700 hover:bg-slate-200 rounded-xl transition cursor-pointer"
                >
                  Tutup Panel
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          7. EXECUTIVE CONFIRMATION DIALOG (PROSEDUR FORMAL PEMERINTAH)
          ==================================================================== */}
      {confirmAction && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                {confirmAction.riskLevel || 'PROTOKOL PENGAWASAN MBG'}
              </span>
            </div>

            <h3 className="text-base font-extrabold text-slate-900">
              {confirmAction.title}
            </h3>

            <p className="text-xs text-slate-600 leading-relaxed">
              {confirmAction.desc}
            </p>

            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200 text-[11px] text-slate-600">
              <span className="font-semibold text-slate-700">Subjek Tindakan:</span> {confirmAction.validator.name} ({confirmAction.validator.satgasId}) &bull; {confirmAction.validator.school}
            </div>

            {confirmAction.type === 'warn' && (
              <div className="space-y-1.5">
                <label htmlFor="warn-note" className="block text-[11px] font-semibold text-slate-700">
                  Isi Surat Peringatan <span className="text-rose-600">*</span>
                </label>
                <textarea
                  id="warn-note"
                  rows={4}
                  value={warnNote}
                  onChange={(e) => setWarnNote(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-amber-500 focus:outline-none"
                />
                <p className="text-[10px] text-slate-500">
                  Minimal 10 karakter. Dikirim ke ponsel validator dengan tembusan ke Kepala Sekolah &amp; Satgas Wilayah.
                </p>
              </div>
            )}

            {confirmAction.type === 'assignBackup' && (
              <div className="space-y-1.5">
                <label htmlFor="backup-choice" className="block text-[11px] font-semibold text-slate-700">
                  Guru Piket Cadangan <span className="text-rose-600">*</span>
                </label>
                <select
                  id="backup-choice"
                  value={backupChoice}
                  onChange={(e) => setBackupChoice(e.target.value)}
                  className="w-full rounded-xl border border-slate-300 px-3 py-2 text-xs text-slate-800 focus:border-blue-500 focus:outline-none"
                >
                  <option value="">— Pilih validator aktif di sekolah yang sama —</option>
                  {eligibleBackups.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.satgasId})
                    </option>
                  ))}
                </select>
                <p className="text-[10px] text-slate-500">
                  {eligibleBackups.length === 0
                    ? 'Belum ada validator aktif lain di sekolah ini yang dapat ditunjuk.'
                    : 'Hanya validator aktif pada sekolah yang sama yang dapat ditunjuk.'}
                </p>
              </div>
            )}

            <div className="pt-3 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setConfirmAction(null)}
                disabled={Boolean(pendingAction)}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Batalkan
              </button>
              <button
                onClick={executeConfirmedAction}
                disabled={Boolean(pendingAction)}
                className={`px-4 py-2 text-xs font-bold text-white rounded-xl transition shadow-sm cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed ${confirmAction.btnClass}`}
              >
                {pendingAction ? 'Memproses…' : confirmAction.btnText}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          7b. DIALOG KONFIRMASI HAPUS AKUN VALIDATOR (PUSAT AKUN)
          ==================================================================== */}
      {confirmDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="Konfirmasi hapus akun validator"
          className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
          onClick={() => !pendingDelete && setConfirmDelete(null)}
        >
          <div
            className="w-full max-w-md rounded-2xl bg-white shadow-2xl border border-slate-100 p-6 space-y-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-rose-50 text-rose-600 border border-rose-100 flex items-center justify-center shrink-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-base font-extrabold text-slate-900">Hapus Akun Validator</h3>
                <p className="text-xs text-slate-600 leading-relaxed mt-1">
                  Akun login dan profil roster akan dihapus permanen. Riwayat pindai tetap tersimpan pada
                  log audit.
                </p>
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 border border-slate-200 px-3 py-2.5 text-[11px] text-slate-700">
              <span className="font-semibold text-slate-800">{confirmDelete.name}</span>
              {confirmDelete.satgasId ? ` (${confirmDelete.satgasId})` : ''} &bull; {confirmDelete.school}
            </div>

            <div className="pt-1 flex items-center justify-end gap-2.5">
              <button
                onClick={() => setConfirmDelete(null)}
                disabled={pendingDelete}
                className="px-4 py-2 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer disabled:opacity-50"
              >
                Batalkan
              </button>
              <button
                onClick={executeDelete}
                disabled={pendingDelete}
                className="flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition shadow-sm cursor-pointer disabled:opacity-60"
              >
                {pendingDelete ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
                {pendingDelete ? 'Menghapus…' : 'Hapus Permanen'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default ValidatorPanel