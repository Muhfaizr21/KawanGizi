import { useState, useMemo, useEffect, useRef } from 'react'
import {
  Search,
  Download,
  Printer,
  ChevronRight,
  CheckCircle2,
  X,
  Clock,
  AlertOctagon,
  Building2,
  ChevronDown,
  Utensils,
  Share2,
  FileSearch,
  SlidersHorizontal,
  BadgeAlert,
  Send
} from 'lucide-react'
import { AttendanceCharts } from './AttendanceCharts'
import { RowAction, StatusDot } from './tableKit'
import {
  adjustAttendanceQuota,
  redistributeAttendanceSurplus,
  auditAttendanceDiscrepancy,
} from '../../lib/api'
import { toAttendanceView } from './attendanceView'

/**
 * ==============================================================================
 * BADAN GIZI NASIONAL (BGN) REPUBLIK INDONESIA
 * KONSOL REKONSILIASI PENERIMAAN SISWA & EFISIENSI PORSI (SUPERADMIN)
 * Standar: Enterprise 10-Year UI/UX • Zero-Glitch • Clean Code
 * Dasar Regulasi: Bab 4.2 Poin 8 & Bab 3.3.2 Sistem Pengawasan MBG
 * ==============================================================================
 */

export function AttendancePanel({
  attendanceList: initialAttendanceList,
  onSuperadminAction,
  showToast,
  onReload,
}) {
  const [attendanceList, setAttendanceList] = useState(initialAttendanceList || [])

  useEffect(() => {
    if (Array.isArray(initialAttendanceList)) {
      setAttendanceList(initialAttendanceList)
    }
  }, [initialAttendanceList])

  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'matched' | 'surplus_safe' | 'surplus_redistributed' | 'discrepancy'
  const [cityFilter, setCityFilter] = useState('all')
  const [density, setDensity] = useState('normal') // 'normal' | 'compact'

  // Drawer & Modals State
  const [inspectModalData, setInspectModalData] = useState(null) // { item }
  const [adjustQuotaModalData, setAdjustQuotaModalData] = useState(null) // { item, newQuota, reason }
  const [redistributeModalData, setRedistributeModalData] = useState(null) // { item, targetFacility, portions, courier }
  const [discrepancyAuditModalData, setDiscrepancyAuditModalData] = useState(null) // { item, investigator, notes }
  const [openMenuId, setOpenMenuId] = useState(null)

  const dropdownRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenMenuId(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close modals on ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setInspectModalData(null)
        setAdjustQuotaModalData(null)
        setRedistributeModalData(null)
        setDiscrepancyAuditModalData(null)
        setOpenMenuId(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Distinct cities for filter dropdown
  const cities = useMemo(() => {
    const set = new Set(attendanceList.map((a) => a.city).filter(Boolean))
    return Array.from(set)
  }, [attendanceList])

  // Advanced Filtering
  const filtered = useMemo(() => {
    return attendanceList.filter((item) => {
      const q = search.toLowerCase()
      const matchSearch =
        !search ||
        item.school.toLowerCase().includes(q) ||
        item.npsn.includes(q) ||
        item.sppg.toLowerCase().includes(q) ||
        item.city.toLowerCase().includes(q) ||
        item.principal.toLowerCase().includes(q) ||
        item.headValidator.toLowerCase().includes(q)

      let matchStatus = true
      if (statusFilter === 'matched') matchStatus = item.reconciliationStatus === 'matched'
      else if (statusFilter === 'surplus_safe') matchStatus = item.reconciliationStatus === 'surplus_safe'
      else if (statusFilter === 'surplus_redistributed') matchStatus = item.reconciliationStatus === 'surplus_redistributed'
      else if (statusFilter === 'discrepancy') matchStatus = item.reconciliationStatus === 'discrepancy_flagged'

      const matchCity = cityFilter === 'all' || item.city === cityFilter

      return matchSearch && matchStatus && matchCity
    })
  }, [search, statusFilter, cityFilter, attendanceList])

  // Executive KPI Calculations
  const stats = useMemo(() => {
    const total = attendanceList.length
    const totalRegistered = attendanceList.reduce((acc, a) => acc + a.registeredStudents, 0)
    const totalPresent = attendanceList.reduce((acc, a) => acc + a.presentStudents, 0)
    const totalDelivered = attendanceList.reduce((acc, a) => acc + a.deliveredPortions, 0)
    const totalSurplus = attendanceList.reduce((acc, a) => acc + (a.surplusPortions || 0), 0)
    const discrepancyCount = attendanceList.filter((a) => a.reconciliationStatus === 'discrepancy_flagged').length
    const redistributedCount = attendanceList.filter((a) => a.reconciliationStatus === 'surplus_redistributed').length

    const overallAttendanceRate =
      totalRegistered > 0 ? ((totalPresent / totalRegistered) * 100).toFixed(1) : '0.0'

    const avgFinishRate =
      total > 0
        ? (
            attendanceList.reduce((acc, a) => acc + (a.consumptionEvaluation?.finishRate || 0), 0) /
            total
          ).toFixed(1)
        : '0.0'

    return {
      total,
      totalRegistered,
      totalPresent,
      totalDelivered,
      totalSurplus,
      discrepancyCount,
      redistributedCount,
      overallAttendanceRate,
      avgFinishRate
    }
  }, [attendanceList])

  // Export CSV Handler
  const exportCsv = () => {
    const headers = [
      'npsn',
      'sekolah',
      'jenjang',
      'kota',
      'dapur_sppg',
      'siswa_terdaftar',
      'siswa_hadir',
      'siswa_sakit',
      'siswa_izin',
      'tingkat_kehadiran_pct',
      'porsi_dikirim',
      'porsi_dikonsumsi',
      'sisa_porsi_utuh',
      'status_rekonsiliasi',
      'sisa_menit_golden_window',
      'indeks_piring_bersih_pct',
      'kuota_esok_rekomendasi'
    ]

    const rows = filtered.map((a) => [
      a.npsn,
      a.school,
      a.level,
      a.city,
      a.sppg,
      a.registeredStudents,
      a.presentStudents,
      a.absentDetails?.sick ?? 0,
      a.absentDetails?.permission ?? 0,
      a.attendanceRate,
      a.deliveredPortions,
      a.consumedPortions,
      a.surplusPortions,
      a.reconciliationStatus,
      a.goldenWindow?.minutesLeft ?? 0,
      a.consumptionEvaluation?.finishRate ?? 0,
      a.targetTomorrowQuota
    ])

    const escape = (cell) => {
      const s = cell == null ? '' : String(cell)
      return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
    }
    const csvContent = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n')
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = `kawangizi_rekonsiliasi_presensi_${new Date().toISOString().split('T')[0]}.csv`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    URL.revokeObjectURL(url)
    showToast?.(`[EKSPOR BERHASIL] ${filtered.length} rekap data presensi & porsi berhasil diunduh.`)
  }

  // 1. ACTION: Penyesuaian Alokasi Harian Otomatis (Quota Tomorrow)
  const handleOpenAdjustQuotaModal = (item) => {
    setOpenMenuId(null)
    setAdjustQuotaModalData({
      item,
      newQuota: item.targetTomorrowQuota,
      reason: `Penyesuaian kuota berdasarkan rata-rata presensi fisik ${item.attendanceRate}% untuk menghindari food waste.`
    })
  }

  const executeAdjustQuota = async () => {
    if (!adjustQuotaModalData) return
    const { item, newQuota, reason } = adjustQuotaModalData
    if (onSuperadminAction?.('adjust_attendance_quota', { item, newQuota, reason })?.allowed === false) return
    const quotaVal = parseInt(newQuota, 10) || item.targetTomorrowQuota

    try {
      const updated = await adjustAttendanceQuota(item.id, { newQuota: quotaVal, reason })
      const view = updated ? toAttendanceView(updated) : null
      setAttendanceList((prev) =>
        prev.map((a) => (a.id === item.id ? (view || { ...a, targetTomorrowQuota: quotaVal }) : a))
      )
      showToast?.(`[ALOKASI H+1 DIPERBARUI] Kuota pesanan ${item.school} untuk esok hari ditetapkan sebesar ${quotaVal} porsi.`)
      onReload?.()
    } catch (err) {
      showToast?.(`Gagal memperbarui kuota di server: ${err.message || 'Kesalahan server'}`)
    }

    setAdjustQuotaModalData(null)
  }

  // 2. ACTION: Otorisasi Distribusi Porsi Berlebih (Redistribution)
  const handleOpenRedistributeModal = (item) => {
    setOpenMenuId(null)
    setRedistributeModalData({
      item,
      targetFacility: 'Panti Asuhan Yatim Piatu Terdekat (Radius < 2.5 km)',
      portions: item.surplusPortions,
      courier: 'Kurir Satgas Logistik MBG'
    })
  }

  const executeRedistribute = async () => {
    if (onSuperadminAction?.('redistribute_surplus')?.allowed === false) return
    if (!redistributeModalData) return
    const { item, targetFacility, portions, courier } = redistributeModalData
    const portionCount = parseInt(portions, 10) || item.surplusPortions

    try {
      const updated = await redistributeAttendanceSurplus(item.id, {
        targetFacility,
        portionsAllocated: portionCount,
        courierName: courier,
        authorizedBy: 'Dr. Hendra Prasetyo (Satgas MBG Pusat)',
      })
      const view = updated ? toAttendanceView(updated) : null
      if (view) {
        setAttendanceList((prev) => prev.map((a) => (a.id === item.id ? view : a)))
      }
      showToast?.(`[PENGALIHAN RESMI DISAHKAN] ${portionCount} porsi utuh dari ${item.school} dialihkan ke ${targetFacility}.`)
      onReload?.()
    } catch (err) {
      showToast?.(`Gagal mengalihkan surplus di server: ${err.message || 'Kesalahan server'}`)
    }

    setRedistributeModalData(null)
  }

  // 3. ACTION: Audit Selisih Data (Discrepancy Investigation)
  const handleOpenDiscrepancyModal = (item) => {
    setOpenMenuId(null)
    setDiscrepancyAuditModalData({
      item,
      investigator: 'Dr. Hendra Prasetyo (Satgas MBG Pusat)',
      notes: `Ditemukan selisih ${item.discrepancyCount} boks antara data kurir penyedia dan presensi fisik Dapodik. Tim investigasi diterjunkan untuk klarifikasi fisik.`
    })
  }

  const executeAuditDiscrepancy = async () => {
    if (!discrepancyAuditModalData) return
    const { item, investigator, notes } = discrepancyAuditModalData
    if (onSuperadminAction?.('audit_discrepancy', { item, investigator, notes })?.allowed === false) return

    try {
      const updated = await auditAttendanceDiscrepancy(item.id, { investigator, notes })
      const view = updated ? toAttendanceView(updated) : null
      if (view) {
        setAttendanceList((prev) => prev.map((a) => (a.id === item.id ? view : a)))
      }
      showToast?.(`[BERITA ACARA AUDIT DITERBITKAN] Perintah investigasi selisih porsi untuk ${item.school} telah dicatat dalam log audit.`)
      onReload?.()
    } catch (err) {
      showToast?.(`Gagal menerbitkan berita acara audit di server: ${err.message || 'Kesalahan server'}`)
    }

    setDiscrepancyAuditModalData(null)
  }

  return (
    <div className="space-y-6">
      {/* ====================================================================
          1. COMPACT TOP UTILITY & LIVE RECONCILIATION BAR (NO HEAVY CARD)
          ==================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-xs text-slate-500 font-medium">
          Rekapitulasi Presensi Dapodik &amp; Rekonsiliasi Porsi MBG
        </div>

        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={exportCsv}
            disabled={filtered.length === 0}
            className="px-3.5 py-1.5 text-xs font-semibold text-slate-700 bg-white hover:bg-slate-50 border border-slate-200/90 rounded-xl transition flex items-center gap-2 shadow-2xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed hover:border-slate-300 focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>Ekspor Data (CSV)</span>
          </button>

          <button
            onClick={() => window.print()}
            className="px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-xl transition flex items-center gap-2 shadow-2xs cursor-pointer hover:shadow-xs focus-visible:outline-2 focus-visible:outline-blue-600"
          >
            <Printer className="h-3.5 w-3.5 text-slate-300" />
            <span>Cetak Rekap</span>
          </button>
        </div>
      </div>

      {/* ====================================================================
          2. EXECUTIVE KPI COMMAND RIBBON (4 METRIC CARDS)
          ==================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Presensi Fisik Siswa Hari Ini */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-[11px] font-medium text-slate-500">
              Presensi siswa hadir
            </span>
            
          </div>

          <div className="my-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-slate-900 tabular-nums tracking-tight">
                {stats.totalPresent.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 font-medium">
                dari {stats.totalRegistered.toLocaleString()} siswa
              </span>
            </div>

            {/* Attendance Progress Bar */}
            <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden flex">
              <div
                style={{ width: `${stats.overallAttendanceRate}%` }}
                className="bg-blue-600 h-full"
                title={`${stats.totalPresent} Siswa Hadir`}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 font-mono">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                {stats.totalPresent} Masuk Kelas
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-slate-400" />
                {stats.totalRegistered - stats.totalPresent} Sakit/Izin
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Standar Toleransi Absensi:</span>
            <span className="font-bold text-slate-700 font-mono">Maks 5.0%</span>
          </div>
        </div>

        {/* Card 2: Sisa Porsi Aman (Untouched Buffer) (Clickable to Filter) */}
        <button
          type="button"
          aria-pressed={statusFilter === 'surplus_safe'}
          onClick={() => setStatusFilter(statusFilter === 'surplus_safe' ? 'all' : 'surplus_safe')}
          className={`bg-white rounded-2xl p-5 border text-left relative overflow-hidden flex flex-col justify-between transition-all focus-visible:outline-2 focus-visible:outline-blue-600 ${
            statusFilter === 'surplus_safe'
              ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/10'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-[11px] font-medium text-slate-500">
              Sisa porsi aman
            </span>
            <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-amber-700 bg-amber-50 px-2 py-0.5 rounded-full border border-amber-200/60">
              SIAP DIALIHKAN
            </span>
          </div>

          <div className="my-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-amber-800 font-mono tracking-tight">
                {stats.totalSurplus}
              </span>
              <span className="text-xs font-bold text-amber-700">Porsi Utuh Tersedia</span>
            </div>

            <div className="mt-2.5 p-2 rounded-xl bg-amber-50/80 border border-amber-200/70 text-[11px] text-amber-900 leading-snug">
              <p className="font-semibold flex items-center gap-1 text-amber-800">
                <Clock className="h-3.5 w-3.5 shrink-0 text-amber-800" />
                <span>Golden Window: Batas 4 Jam Aman</span>
              </p>
              <p className="text-[10px] text-amber-700 mt-0.5 font-mono">
                Bebas disentuh &bull; Siap dialihkan ke panti asuhan
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[10px] flex items-center justify-between text-blue-700 font-bold">
            <span>
              {statusFilter === 'surplus_safe' ? 'Sedang Menyaring Porsi Sisa' : 'Saring Porsi Siap Dialihkan'}
            </span>
            <ChevronRight className="h-3 w-3" />
          </div>
        </button>

        {/* Card 3: Indeks Porsi Dihabiskan (Plate Waste Index) */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-[11px] font-medium text-slate-500">
              Indeks piring bersih
            </span>
            <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
              EVALUASI RASA
            </span>
          </div>

          <div className="my-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-800 font-mono tracking-tight">
                {stats.avgFinishRate}%
              </span>
              <span className="text-xs font-bold text-emerald-700">Habis Bersih</span>
            </div>

            <div className="mt-2.5 p-2 rounded-xl bg-emerald-50/80 border border-emerald-200/70 text-[11px] text-emerald-900 leading-snug space-y-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 font-semibold text-emerald-800">
                  <Utensils className="h-3.5 w-3.5 shrink-0 text-emerald-800" />
                  Rasio Sisa Makanan Sangat Rendah
                </span>
              </div>
              <p className="text-[10px] text-emerald-700 font-mono">
                Sisa sayuran &lt; 3.0% &bull; Lauk protein 99.5% habis
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Tingkat Kepuasan Rasa:</span>
            <span className="font-bold text-emerald-700 font-mono">Sangat Tinggi (A)</span>
          </div>
        </div>

        {/* Card 4: Selisih Porsi Mencurigakan (Clickable to Filter) */}
        <button
          type="button"
          aria-pressed={statusFilter === 'discrepancy'}
          onClick={() => setStatusFilter(statusFilter === 'discrepancy' ? 'all' : 'discrepancy')}
          className={`bg-white rounded-2xl p-5 border text-left relative overflow-hidden flex flex-col justify-between transition-all focus-visible:outline-2 focus-visible:outline-blue-600 ${
            statusFilter === 'discrepancy'
              ? 'border-rose-500 ring-2 ring-rose-500/20 bg-rose-50/10'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-[11px] font-medium text-slate-500">
              Audit selisih data
            </span>
            <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/80">
              PERLU INVESTIGASI
            </span>
          </div>

          <div className="my-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-rose-800 font-mono tracking-tight">
                {stats.discrepancyCount}
              </span>
              <span className="text-xs font-bold text-rose-700">Sekolah Ada Selisih</span>
            </div>

            <div className="mt-2.5 p-2 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-900 leading-snug">
              <p className="font-semibold flex items-center gap-1.5 text-rose-800">
                <AlertOctagon className="h-3.5 w-3.5 shrink-0" />
                <span>Selisih Tanda Terima Kurir vs Guru</span>
              </p>
              <p className="text-[10px] text-rose-700 mt-0.5 font-mono">
                SDN 05 Tebet (+30 boks tak bertuan)
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[10px] flex items-center justify-between text-blue-700 font-bold">
            <span>
              {statusFilter === 'discrepancy' ? 'Sedang Menyaring Selisih' : 'Saring Sekolah Beranomali'}
            </span>
            <ChevronRight className="h-3 w-3" />
          </div>
        </button>
      </div>

      {/* ====================================================================
          3. INTEGRATED ANALYTICAL CHARTS (RECHARTS TELEMETRY)
          ==================================================================== */}
      <AttendanceCharts attendanceList={attendanceList} />

      {/* ====================================================================
          4. FILTER CONTROLS & SEARCH TOOLBAR
          ==================================================================== */}
      <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          {/* Search Box */}
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3.5 top-2.5 h-4 w-4 text-slate-500" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cari nama sekolah, NPSN, SPPG penyedia, kepala sekolah, atau kota..."
              className="w-full pl-9 pr-8 py-2 text-xs rounded-xl bg-slate-50 border border-slate-200 text-slate-800 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:bg-white transition-all"
            />
            {search && (
              <button
                onClick={() => setSearch('')}
                className="absolute right-2.5 top-2.5 text-slate-500 hover:text-slate-600 p-0.5"
                aria-label="Hapus pencarian"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Quick Filter Chips */}
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            <button
              onClick={() => setStatusFilter('all')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              Semua ({stats.total})
            </button>
            <button
              onClick={() => setStatusFilter('matched')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                statusFilter === 'matched'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              Presensi Tuntas ({attendanceList.filter((a) => a.reconciliationStatus === 'matched').length})
            </button>
            <button
              onClick={() => setStatusFilter('surplus_safe')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                statusFilter === 'surplus_safe'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              Sisa Porsi Aman ({attendanceList.filter((a) => a.reconciliationStatus === 'surplus_safe').length})
            </button>
            <button
              onClick={() => setStatusFilter('surplus_redistributed')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                statusFilter === 'surplus_redistributed'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              Telah Dialihkan ({stats.redistributedCount})
            </button>
            <button
              onClick={() => setStatusFilter('discrepancy')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition cursor-pointer ${
                statusFilter === 'discrepancy'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              Selisih Data ({stats.discrepancyCount})
            </button>
          </div>

          {/* Secondary Dropdown Selectors */}
          <div className="flex items-center gap-2 shrink-0">
            {/* City Selector */}
            <select
              value={cityFilter}
              onChange={(e) => setCityFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">Semua Kota ({cities.length})</option>
              {cities.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>

            {/* View Density Toggle */}
            <div className="hidden sm:flex items-center rounded-xl border border-slate-200 p-0.5 bg-slate-50">
              <button
                onClick={() => setDensity('normal')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition cursor-pointer ${
                  density === 'normal' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500'
                }`}
              >
                Normal
              </button>
              <button
                onClick={() => setDensity('compact')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition cursor-pointer ${
                  density === 'compact' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500'
                }`}
              >
                Rapat
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* ====================================================================
          5. ENTERPRISE ATTENDANCE & PORTION RECONCILIATION TABLE
          ==================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[1020px] table-fixed">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-5 py-2.5 w-[26%] text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Sekolah Sasaran &amp; Jenjang</th>
                <th className="px-4 py-2.5 w-[20%] text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Porsi vs Presensi Hadir</th>
                <th className="px-4 py-2.5 w-[20%] text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Sisa Porsi &amp; Golden Window</th>
                <th className="px-4 py-2.5 w-[17%] text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Indeks Piring Bersih</th>
                <th className="px-4 py-2.5 text-left w-[11%] text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Status</th>
                <th className="px-5 py-2.5 text-right w-[6%] text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-500">
                    <p className="font-semibold text-slate-700">Tidak ada data rekonsiliasi yang sesuai dengan kriteria filter.</p>
                    <button
                      onClick={() => {
                        setSearch('')
                        setStatusFilter('all')
                        setCityFilter('all')
                      }}
                      className="mt-2 text-xs font-semibold text-blue-800 hover:underline cursor-pointer"
                    >
                      Reset Semua Filter
                    </button>
                  </td>
                </tr>
              ) : (
                filtered.map((item) => {
                  const isSurplusSafe = item.reconciliationStatus === 'surplus_safe'
                  const isDiscrepancy = item.reconciliationStatus === 'discrepancy_flagged'
                  const isRedistributed = item.reconciliationStatus === 'surplus_redistributed'
                  const paddingY = density === 'compact' ? 'py-3' : 'py-3.5'

                  return (
                    <tr
                      key={item.id}
                      onClick={() => setInspectModalData({ item })}
                      className={`hover:bg-slate-50/80 cursor-pointer transition-colors group border-l-2 ${
                        isDiscrepancy
                          ? 'border-l-rose-500 bg-rose-50/20'
                          : isSurplusSafe
                          ? 'border-l-amber-500 bg-amber-50/15'
                          : isRedistributed
                          ? 'border-l-blue-500 bg-blue-50/10'
                          : 'border-l-transparent'
                      }`}
                    >
                      {/* Col 1: Sekolah Sasaran & Jenjang */}
                      <td className={`px-5 ${paddingY}`}>
                        <div className="flex items-center gap-3">
                          <div
                            className={`h-9 w-9 rounded-xl flex items-center justify-center shrink-0 border ${
                              isDiscrepancy
                                ? 'bg-rose-50 border-rose-200 text-rose-800'
                                : isSurplusSafe
                                ? 'bg-amber-50 border-amber-200 text-amber-700'
                                : 'bg-blue-50 border-blue-200 text-blue-700'
                            }`}
                          >
                            <Building2 className="h-4.5 w-4.5" />
                          </div>

                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-semibold text-slate-900 group-hover:text-blue-700 transition-colors text-xs truncate">
                                {item.school}
                              </span>
                              <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1 py-0.5 rounded-sm">
                                NPSN: {item.npsn}
                              </span>
                            </div>

                            <p className="text-[11px] text-slate-500 truncate mt-0.5">
                              {item.level} &bull; {item.city}
                            </p>

                            <p className="text-[11px] text-slate-500 font-mono mt-0.5 truncate">
                              SPPG: <span className="text-slate-600 font-medium">{item.sppg}</span>
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Col 2: Porsi vs Presensi Hadir */}
                      <td className={`px-4 ${paddingY}`}>
                        <div className="space-y-1.5">
                          <div className="flex items-baseline justify-between text-xs">
                            <span className="font-mono font-bold text-slate-900">
                              {item.presentStudents.toLocaleString()}{' '}
                              <span className="text-[10px] font-normal text-slate-500">siswa hadir</span>
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">
                              / {item.deliveredPortions.toLocaleString()} porsi
                            </span>
                          </div>

                          {/* Progress bar */}
                          <div className="h-1.5 w-full bg-slate-100 rounded-full overflow-hidden">
                            <div
                              style={{ width: `${Math.min(100, item.attendanceRate)}%` }}
                              className={`h-full rounded-full transition-all ${
                                isDiscrepancy ? 'bg-rose-500' : 'bg-blue-600'
                              }`}
                            />
                          </div>

                          <div className="flex items-center justify-between text-[10px] font-mono text-slate-500">
                            <span className="font-semibold text-slate-700">
                              Presensi: {item.attendanceRate}%
                            </span>
                            <span className="text-rose-800 font-medium">
                              Absen: {(item.absentDetails?.sick || 0) + (item.absentDetails?.permission || 0)}
                            </span>
                          </div>
                        </div>
                      </td>

                      {/* Col 3: Sisa Porsi & Golden Window */}
                      <td className={`px-4 ${paddingY}`}>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <span className="font-mono font-bold text-slate-900 text-xs">
                              {item.surplusPortions} Porsi Utuh
                            </span>
                            {item.surplusPortions > 0 && (
                              <span
                                className={`text-[11px] font-bold px-1.5 py-0.2 rounded font-mono ${
                                  (item.goldenWindow?.minutesLeft || 0) <= 15
                                    ? 'bg-rose-50 text-rose-700'
                                    : 'bg-amber-50 text-amber-800'
                                }`}
                              >
                                {(item.goldenWindow?.minutesLeft || 0) > 0
                                  ? `${item.goldenWindow.minutesLeft}m tersisa`
                                  : 'Waktu Habis'}
                              </span>
                            )}
                          </div>

                          <p className="text-[11px] text-slate-500 truncate">
                            Batas Aman:{' '}
                            <strong className="text-slate-700 font-medium font-mono">
                              {item.goldenWindow?.safeUntil || '-'}
                            </strong>
                          </p>

                          <p className="text-[11px] text-slate-500 font-mono truncate">
                            {item.surplusStatus === 'redistributed'
                              ? 'Dialihkan ke Posko / Panti'
                              : item.surplusStatus === 'available_for_redistribution'
                              ? 'Higienis & Siap Dialihkan'
                              : 'Tidak Ada Sisa Berlebih'}
                          </p>
                        </div>
                      </td>

                      {/* Col 4: Indeks Piring Bersih & Evaluasi */}
                      <td className={`px-4 ${paddingY}`}>
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5">
                            <Utensils className="h-3.5 w-3.5 text-emerald-800 shrink-0" />
                            <span className="font-mono font-bold text-slate-900 text-xs">
                              {item.consumptionEvaluation?.finishRate ?? 0}% Habis
                            </span>
                          </div>

                          <p className="text-[11px] text-slate-500 truncate">
                            Sisa Sayur:{' '}
                            <span className="font-mono font-medium text-slate-700">
                              {item.consumptionEvaluation?.veggieWastePct ?? 0}%
                            </span>
                            <span className="mx-1 text-slate-300">&bull;</span>
                            Lauk:{' '}
                            <span className="font-mono font-medium text-slate-700">
                              {item.consumptionEvaluation?.proteinWastePct ?? 0}%
                            </span>
                          </p>

                          <p className="text-[11px] text-slate-500 font-mono truncate">
                            Rekomendasi H+1: {item.targetTomorrowQuota} Porsi
                          </p>
                        </div>
                      </td>

                      {/* Col 5: Status. Titik + label, bukan pil. */}
                      <td className={`px-4 ${paddingY}`}>
                        {isDiscrepancy ? (
                          <StatusDot tone="critical">Selisih data</StatusDot>
                        ) : isRedistributed ? (
                          <StatusDot tone="info">Dialihkan</StatusDot>
                        ) : isSurplusSafe ? (
                          <StatusDot tone="warn">Sisa aman</StatusDot>
                        ) : (
                          <StatusDot tone="ok">Cocok</StatusDot>
                        )}
                        <p className="text-[11px] text-slate-500 mt-0.5 font-mono">
                          {isDiscrepancy
                            ? `Selisih ${item.discrepancyCount} boks`
                            : isSurplusSafe
                            ? `+${item.surplusPortions} boks berlebih`
                            : 'Presensi 100%'}
                        </p>
                      </td>

                      {/* Col 6: Aksi Superadmin */}
                      <td className={`px-5 ${paddingY} text-right`}>
                        <div className="flex items-center justify-end gap-1.5" onClick={(e) => e.stopPropagation()}>
                          <RowAction onClick={() => setInspectModalData({ item })}>Detail</RowAction>

                          <div className="relative">
                            <button
                              onClick={() => setOpenMenuId(openMenuId === item.id ? null : item.id)}
                              className="p-1.5 rounded-lg border border-slate-200 bg-white hover:bg-slate-50 text-slate-500 hover:text-slate-800 shadow-2xs transition cursor-pointer hover:border-slate-300"
                              aria-label="Menu Aksi Superadmin"
                            >
                              <ChevronDown className="h-3.5 w-3.5" />
                            </button>

                            {/* Dropdown Actions */}
                            {openMenuId === item.id && (
                              <div
                                ref={dropdownRef}
                                className="absolute right-0 top-full mt-1 w-60 bg-white rounded-xl shadow-xl border border-slate-200 py-1.5 z-30 text-xs animate-in fade-in"
                              >
                                <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 border-b border-slate-100">
                                  OTORITAS SUPERADMIN
                                </div>

                                <button
                                  onClick={() => handleOpenAdjustQuotaModal(item)}
                                  className="w-full text-left px-3 py-2 flex items-center gap-2 text-slate-700 hover:bg-slate-50 font-medium transition cursor-pointer"
                                >
                                  <SlidersHorizontal className="h-3.5 w-3.5 text-blue-800" />
                                  <span>Penyesuaian Alokasi H+1</span>
                                </button>

                                <button
                                  onClick={() => handleOpenRedistributeModal(item)}
                                  disabled={item.surplusPortions === 0 || item.surplusStatus === 'redistributed'}
                                  className={`w-full text-left px-3 py-2 flex items-center gap-2 font-medium transition cursor-pointer ${
                                    item.surplusPortions === 0 || item.surplusStatus === 'redistributed'
                                      ? 'text-slate-500 cursor-not-allowed'
                                      : 'text-amber-700 hover:bg-amber-50'
                                  }`}
                                >
                                  <Share2 className="h-3.5 w-3.5 text-amber-800" />
                                  <span>Otorisasi Alihkan Porsi Sisa</span>
                                </button>

                                <button
                                  onClick={() => handleOpenDiscrepancyModal(item)}
                                  className="w-full text-left px-3 py-2 flex items-center gap-2 text-rose-700 hover:bg-rose-50 font-medium transition cursor-pointer"
                                >
                                  <FileSearch className="h-3.5 w-3.5 text-rose-800" />
                                  <span>Audit Investigasi Selisih</span>
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Summary */}
        <div className="bg-slate-50/70 border-t border-slate-200/80 px-4 py-3 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
          <div className="flex items-center gap-2">
            <span>Menampilkan <strong>{filtered.length}</strong> dari <strong>{stats.total}</strong> sekolah terpantau</span>
            <span className="text-slate-300">&bull;</span>
            <span className="text-emerald-700 font-semibold">Tersinkronisasi Dapodik &amp; Satgas MBG</span>
          </div>
          <div className="flex items-center gap-4 text-slate-500 font-mono text-[10px]">
            <span>TOTAL SISWA TERLAYANI: <strong>{stats.totalPresent.toLocaleString()} SISWA</strong></span>
            <span>&bull;</span>
            <span>STANDAR EFISIENSI APBN</span>
          </div>
        </div>
      </div>

      {/* ====================================================================
          MODAL 1: PENYESUAIAN ALOKASI HARIAN OTOMATIS (H+1 QUOTA ADJUSTMENT)
          ==================================================================== */}
      {adjustQuotaModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-blue-700 text-xs font-bold font-mono">
                  <SlidersHorizontal className="h-4 w-4" />
                  <span>EFISIENSI ANGGARAN &amp; KUOTA MBG</span>
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Penyesuaian Alokasi Porsi Harian Esok (H+1)
                </h3>
                <p className="text-xs text-slate-500">
                  {adjustQuotaModalData.item.school} &bull; {adjustQuotaModalData.item.sppg}
                </p>
              </div>
              <button
                onClick={() => setAdjustQuotaModalData(null)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Comparison Box */}
            <div className="grid grid-cols-2 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500">Porsi Hari Ini:</span>
                <p className="font-mono font-bold text-slate-900 text-lg mt-0.5">
                  {adjustQuotaModalData.item.deliveredPortions} porsi
                </p>
                <p className="text-[11px] text-slate-500 mt-1">
                  Siswa Hadir: {adjustQuotaModalData.item.presentStudents} ({adjustQuotaModalData.item.attendanceRate}%)
                </p>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                <span className="text-blue-800 font-semibold">Rekomendasi Esok (H+1):</span>
                <p className="font-mono font-bold text-blue-900 text-lg mt-0.5">
                  {adjustQuotaModalData.newQuota} porsi
                </p>
                <p className="text-[10px] text-blue-700 mt-1">
                  Penghematan: {adjustQuotaModalData.item.deliveredPortions - adjustQuotaModalData.newQuota} Porsi / Hari
                </p>
              </div>
            </div>

            {/* Input Form */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Ketetapan Kuota Porsi untuk Dapur SPPG (Esok Hari):
                </label>
                <input
                  type="number"
                  value={adjustQuotaModalData.newQuota}
                  onChange={(e) =>
                    setAdjustQuotaModalData({
                      ...adjustQuotaModalData,
                      newQuota: parseInt(e.target.value, 10) || 0
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-900 font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Catatan Dasar Pertimbangan Rekonsiliasi:
                </label>
                <textarea
                  rows={3}
                  value={adjustQuotaModalData.reason}
                  onChange={(e) =>
                    setAdjustQuotaModalData({ ...adjustQuotaModalData, reason: e.target.value })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
              <button
                onClick={() => setAdjustQuotaModalData(null)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={executeAdjustQuota}
                className="px-4 py-2 font-bold text-white bg-blue-600 hover:bg-blue-700 rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Simpan &amp; Teruskan ke SPPG</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 2: OTORISASI DISTRIBUSI PORSI BERLEBIH (REDISTRIBUTION)
          ==================================================================== */}
      {redistributeModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-amber-700 text-xs font-bold font-mono">
                  <Share2 className="h-4 w-4" />
                  <span>SURAT JALAN PENGALIHAN PORSI UTUH</span>
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Otorisasi Distribusi Porsi Berlebih MBG
                </h3>
                <p className="text-xs text-slate-500">
                  {redistributeModalData.item.school} &bull; Sisa {redistributeModalData.item.surplusPortions} Boks
                </p>
              </div>
              <button
                onClick={() => setRedistributeModalData(null)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Warning Timer Notice */}
            <div className="p-3 rounded-xl bg-amber-50 border border-amber-200 text-xs text-amber-900 space-y-1">
              <p className="font-semibold text-amber-800 flex items-center gap-1.5">
                <Clock className="h-4 w-4" />
                <span>Golden Window Terbatas: Batas Akhir {redistributeModalData.item.goldenWindow?.safeUntil || '-'}</span>
              </p>
              <p className="text-[11px] leading-relaxed">
                Porsi yang dialihkan harus dalam kondisi segel utuh dan tiba di lokasi penerima sebelum batas waktu konsumsi 4 jam habis.
              </p>
            </div>

            {/* Input Form */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Lembaga / Panti Sosial Penerima:
                </label>
                <input
                  type="text"
                  value={redistributeModalData.targetFacility}
                  onChange={(e) =>
                    setRedistributeModalData({
                      ...redistributeModalData,
                      targetFacility: e.target.value
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Jumlah Boks Dialihkan:
                  </label>
                  <input
                    type="number"
                    max={redistributeModalData.item.surplusPortions}
                    value={redistributeModalData.portions}
                    onChange={(e) =>
                      setRedistributeModalData({
                        ...redistributeModalData,
                        portions: parseInt(e.target.value, 10) || 0
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-mono font-bold text-slate-900 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block font-semibold text-slate-700 mb-1">
                    Armada Kurir Pengantar:
                  </label>
                  <input
                    type="text"
                    value={redistributeModalData.courier}
                    onChange={(e) =>
                      setRedistributeModalData({
                        ...redistributeModalData,
                        courier: e.target.value
                      })
                    }
                    className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 font-medium text-slate-800 focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
              <button
                onClick={() => setRedistributeModalData(null)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={executeRedistribute}
                className="px-4 py-2 font-bold text-white bg-amber-600 hover:bg-amber-700 rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <Send className="h-4 w-4" />
                <span>Sahkan &amp; Terbitkan Surat Jalan</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 3: AUDIT SELISIH DATA (DISCREPANCY INVESTIGATION)
          ==================================================================== */}
      {discrepancyAuditModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-1.5 text-rose-700 text-xs font-bold font-mono">
                  <BadgeAlert className="h-4 w-4" />
                  <span>BERITA ACARA INVESTIGASI SELISIH MBG</span>
                </div>
                <h3 className="text-base font-bold text-slate-900">
                  Investigasi Selisih Serah Terima Porsi
                </h3>
                <p className="text-xs text-slate-500">
                  {discrepancyAuditModalData.item.school} &bull; Selisih {discrepancyAuditModalData.item.discrepancyCount} Boks
                </p>
              </div>
              <button
                onClick={() => setDiscrepancyAuditModalData(null)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Discrepancy Breakdown */}
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-2">
              <div className="flex justify-between items-center font-semibold">
                <span>Catatan Serah Terima Kurir SPPG:</span>
                <span className="font-mono">{discrepancyAuditModalData.item.deliveredPortions} Boks</span>
              </div>
              <div className="flex justify-between items-center font-semibold">
                <span>Presensi Fisik Siswa di Kelas (Dapodik):</span>
                <span className="font-mono">{discrepancyAuditModalData.item.presentStudents} Siswa</span>
              </div>
              <div className="flex justify-between items-center font-bold text-rose-700 pt-1 border-t border-rose-200">
                <span>Selisih Porsi Tak Bertuan:</span>
                <span className="font-mono">+{discrepancyAuditModalData.item.discrepancyCount} Boks</span>
              </div>
            </div>

            {/* Input Form */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Petugas Pemeriksa (Satgas BPKP / Inspektorat):
                </label>
                <input
                  type="text"
                  value={discrepancyAuditModalData.investigator}
                  onChange={(e) =>
                    setDiscrepancyAuditModalData({
                      ...discrepancyAuditModalData,
                      investigator: e.target.value
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block font-semibold text-slate-700 mb-1">
                  Instruksi Khusus Klarifikasi Lapangan:
                </label>
                <textarea
                  rows={3}
                  value={discrepancyAuditModalData.notes}
                  onChange={(e) =>
                    setDiscrepancyAuditModalData({
                      ...discrepancyAuditModalData,
                      notes: e.target.value
                    })
                  }
                  className="w-full px-3 py-2 rounded-xl bg-slate-50 border border-slate-200 text-slate-800 text-xs focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>
            </div>

            {/* Action buttons */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2 text-xs">
              <button
                onClick={() => setDiscrepancyAuditModalData(null)}
                className="px-4 py-2 font-semibold text-slate-600 hover:bg-slate-100 rounded-xl transition cursor-pointer"
              >
                Batal
              </button>
              <button
                onClick={executeAuditDiscrepancy}
                className="px-4 py-2 font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl transition shadow-xs cursor-pointer flex items-center gap-1.5"
              >
                <FileSearch className="h-4 w-4" />
                <span>Terbitkan Berita Acara Klarifikasi</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 4: DETAIL LENGKAP REKONSILIASI & EVALUASI SISA MAKANAN
          ==================================================================== */}
      {inspectModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-50 text-blue-700 border border-blue-200">
                    NPSN: {inspectModalData.item.npsn}
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    {inspectModalData.item.city} &bull; {inspectModalData.item.level}
                  </span>
                </div>
                <h3 className="text-lg font-bold text-slate-900">
                  {inspectModalData.item.school}
                </h3>
                <p className="text-xs text-slate-500">
                  Kepala Sekolah: {inspectModalData.item.principal} &bull; Validator: {inspectModalData.item.headValidator}
                </p>
              </div>

              <button
                onClick={() => setInspectModalData(null)}
                className="p-1 rounded-lg text-slate-500 hover:text-slate-600 hover:bg-slate-100 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Metrics Breakdown Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-200">
                <span className="text-slate-500">Total Siswa:</span>
                <p className="font-mono font-bold text-slate-900 text-base mt-0.5">
                  {inspectModalData.item.registeredStudents}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-blue-50 border border-blue-200">
                <span className="text-blue-800 font-semibold">Hadir di Kelas:</span>
                <p className="font-mono font-bold text-blue-900 text-base mt-0.5">
                  {inspectModalData.item.presentStudents}
                </p>
              </div>
              <div className="p-3 rounded-xl bg-amber-50 border border-amber-200">
                <span className="text-amber-700 font-semibold">Sisa Porsi Utuh:</span>
                <p className="font-mono font-bold text-amber-900 text-base mt-0.5">
                  {inspectModalData.item.surplusPortions} boks
                </p>
              </div>
              <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-200">
                <span className="text-emerald-700 font-semibold">Indeks Piring Bersih:</span>
                <p className="font-mono font-bold text-emerald-900 text-base mt-0.5">
                  {inspectModalData.item.consumptionEvaluation?.finishRate ?? 0}%
                </p>
              </div>
            </div>

            {/* Consumption Feedback Box */}
            <div className="p-4 rounded-xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
              <p className="font-bold text-slate-800 flex items-center justify-between">
                <span>Evaluasi Sisa Makanan &amp; Selera Siswa (Plate Waste)</span>
                <span className="text-[10px] font-mono text-emerald-700">
                  Sayur: {inspectModalData.item.consumptionEvaluation?.veggieWastePct ?? 0}% &bull; Lauk: {inspectModalData.item.consumptionEvaluation?.proteinWastePct ?? 0}%
                </span>
              </p>
              <p className="text-slate-600 leading-relaxed bg-white p-2.5 rounded-lg border border-slate-200 italic">
                "{inspectModalData.item.consumptionEvaluation?.feedbackNotes || 'Porsi gizi dihabiskan dengan baik oleh siswa.'}"
              </p>
            </div>

            {/* Redistribution Log If Available */}
            {inspectModalData.item.redistributionLog && (
              <div className="p-4 rounded-xl bg-blue-50 border border-blue-200 space-y-2 text-xs">
                <p className="font-bold text-blue-900 flex items-center gap-1.5">
                  <Share2 className="h-4 w-4 text-blue-700" />
                  <span>Riwayat Pengalihan Porsi Berlebih</span>
                </p>
                <div className="space-y-1 text-[11px] text-blue-900">
                  <p>Lembaga Penerima: <strong>{inspectModalData.item.redistributionLog.targetFacility}</strong></p>
                  <p>Alokasi: <strong>{inspectModalData.item.redistributionLog.portionsAllocated} Porsi</strong> dialihkan oleh {inspectModalData.item.redistributionLog.courierName}</p>
                  <p className="text-[10px] text-blue-700 font-mono">Disahkan oleh: {inspectModalData.item.redistributionLog.authorizedBy}</p>
                </div>
              </div>
            )}

            {/* Footer Close */}
            <div className="pt-3 border-t border-slate-100 flex items-center justify-end gap-2">
              <button
                onClick={() => setInspectModalData(null)}
                className="px-4 py-2 text-xs font-semibold text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-xl transition cursor-pointer"
              >
                Tutup
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
export default AttendancePanel
