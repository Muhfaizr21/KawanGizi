import { Fragment, useState, useMemo, useEffect, useRef } from 'react'
import {
  Search,
  Download,
  Printer,
  ChevronRight,
  AlertTriangle,
  CheckCircle2,
  X,
  Clock,
  Lock,
  AlertOctagon,
  Building2,
  Sliders,
  Scale,
  ChevronDown,
  Info,
  FileCheck,
  UserRound
} from 'lucide-react'
import { SppgCharts } from './SppgCharts'
import { Code, Figure, RowAction, StatusDot } from './tableKit'
import { SppgAccountManagerModal } from './SppgAccountManagerModal'

/**
 * ==============================================================================
 * BADAN GIZI NASIONAL (BGN) REPUBLIK INDONESIA
 * KONSOL DIREKTORI & EVALUASI KEPATUHAN DAPUR SPPG (SUPERADMIN)
 * Standar: Enterprise 10-Year UI/UX Ã¢â‚¬Â¢ Zero-Glitch Ã¢â‚¬Â¢ Clean Code
 * Dasar Hukum: Perpres No. 83/2024 & Bab 4.2 Poin 8 Sistem Pengawasan MBG
 * ==============================================================================
 */

export function SppgPanel({
  sppgList = [],
  onAction,
  canManage,
  canDiscipline,
  canManageAccounts = false,
  loading,
  showToast
}) {
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('all') // 'all' | 'active' | 'warning' | 'suspended' | 'expiring'
  const [cityFilter, setCityFilter] = useState('all')
  const [typeFilter, setTypeFilter] = useState('all') // 'all' | 'sentral' | 'rekanan'
  const [density, setDensity] = useState('normal') // 'normal' | 'compact'

  // Drawer & Modals State
  const [selectedSppg, setSelectedSppg] = useState(null)

  useEffect(() => {
    setSelectedSppg((cur) => (cur ? sppgList.find((k) => k.id === cur.id) || null : cur))
  }, [sppgList])
  const [drawerTab, setDrawerTab] = useState('overview') // 'overview' | 'scorecard' | 'schools' | 'recipe' | 'logs'
  // Menu aksi baris dirender melayang (position: fixed) agar tidak terpotong
  // oleh overflow tabel; menyimpan koordinat anchor-nya.
  const [openMenu, setOpenMenu] = useState(null) // { id, top, left }

  // Superadmin Action Modals
  const [warningModalData, setWarningModalData] = useState(null) // { sppg, warningType: 'SP-1' | 'SP-2' }
  const [suspensionModalData, setSuspensionModalData] = useState(null) // { sppg, reason, alternativeSppg }
  const [reinstateModalData, setReinstateModalData] = useState(null) // { sppg, reason, initialQuota }
  const [recipeAuditModalData, setRecipeAuditModalData] = useState(null) // { sppg }
  const [quotaModalData, setQuotaModalData] = useState(null) // { sppg, newQuota, reason }
  const [schoolsModalData, setSchoolsModalData] = useState(null) // { sppg }
  const [accountModalSppg, setAccountModalSppg] = useState(null) // dapur (view) yang akun loginnya dikelola
  const [expandedId, setExpandedId] = useState(null) // baris SPPG yang daftar sekolahnya sedang dibuka

  const dropdownRef = useRef(null)

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (e.target.closest?.('[data-row-menu-toggle]')) return
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setOpenMenu(null)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  // Close modals on ESC key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setSelectedSppg(null)
        setWarningModalData(null)
        setSuspensionModalData(null)
        setReinstateModalData(null)
        setRecipeAuditModalData(null)
        setQuotaModalData(null)
        setSchoolsModalData(null)
        setAccountModalSppg(null)
        setOpenMenu(null)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])

  // Tutup dropdown melayang saat halaman digulir/di-resize agar tak nyangkut.
  useEffect(() => {
    if (!openMenu) return
    const close = () => setOpenMenu(null)
    window.addEventListener('scroll', close, true)
    window.addEventListener('resize', close)
    return () => {
      window.removeEventListener('scroll', close, true)
      window.removeEventListener('resize', close)
    }
  }, [openMenu])

  // Distinct cities for filter dropdown
  const cities = useMemo(() => {
    const set = new Set(sppgList.map((s) => s.city).filter(Boolean))
    return Array.from(set)
  }, [sppgList])

  // Dapur yang menu aksinya sedang terbuka (dipakai dropdown melayang).
  const menuSppg = useMemo(
    () => (openMenu ? sppgList.find((k) => k.id === openMenu.id) || null : null),
    [openMenu, sppgList]
  )

  // Advanced Filtering
  const filtered = useMemo(() => {
    return sppgList.filter((s) => {
      const q = search.toLowerCase()
      const matchSearch =
        !search ||
        s.name.toLowerCase().includes(q) ||
        s.code.toLowerCase().includes(q) ||
        s.manager.toLowerCase().includes(q) ||
        s.nutritionist.toLowerCase().includes(q) ||
        s.city.toLowerCase().includes(q) ||
        s.address.toLowerCase().includes(q) ||
        s.assignedSchools.some((sch) => sch.name.toLowerCase().includes(q))

      let matchStatus = true
      if (statusFilter === 'active') matchStatus = s.status === 'active'
      else if (statusFilter === 'warning') matchStatus = s.status === 'warning' || s.scorecard.compositeScore < 85
      else if (statusFilter === 'suspended') matchStatus = s.status === 'suspended'
      else if (statusFilter === 'expiring') matchStatus = s.certificates?.slhs?.status === 'expiring' || (s.certificates?.slhs?.daysLeft ?? 0) < 30

      const matchCity = cityFilter === 'all' || s.city === cityFilter
      const matchType = typeFilter === 'all' || s.type === typeFilter

      return matchSearch && matchStatus && matchCity && matchType
    })
  }, [search, statusFilter, cityFilter, typeFilter, sppgList])

  // Executive KPI Summary Stats
  const stats = useMemo(() => {
    const total = sppgList.length
    const sentralCount = sppgList.filter((s) => s.type === 'sentral').length
    const rekananCount = sppgList.filter((s) => s.type === 'rekanan').length
    const activeCount = sppgList.filter((s) => s.status === 'active').length
    const warningCount = sppgList.filter((s) => s.status === 'warning' || s.scorecard.compositeScore < 85).length
    const suspendedCount = sppgList.filter((s) => s.status === 'suspended').length
    const expiringSlhsCount = sppgList.filter((s) => s.certificates?.slhs?.status === 'expiring' || (s.certificates?.slhs?.daysLeft ?? 0) < 30).length

    const totalMaxCapacity = sppgList.reduce((acc, s) => acc + s.capacity.maxDailyPortions, 0)
    const totalActiveQuota = sppgList.reduce((acc, s) => acc + s.capacity.activeQuota, 0)
    const avgUtilization = totalMaxCapacity ? Math.round((totalActiveQuota / totalMaxCapacity) * 100) : 0

    const activeKitchens = sppgList.filter((s) => s.status !== 'suspended')
    const divisor = activeKitchens.length || 1
    const avgComposite = +(activeKitchens.reduce((acc, s) => acc + s.scorecard.compositeScore, 0) / divisor).toFixed(1)
    const avgSafety = +(activeKitchens.reduce((acc, s) => acc + s.scorecard.safetyScore, 0) / divisor).toFixed(1)
    const avgColdChain = +(activeKitchens.reduce((acc, s) => acc + s.scorecard.coldChainScore, 0) / divisor).toFixed(1)
    const avgTimeliness = +(activeKitchens.reduce((acc, s) => acc + s.scorecard.timelinessScore, 0) / divisor).toFixed(1)

    return {
      total,
      sentralCount,
      rekananCount,
      activeCount,
      warningCount,
      suspendedCount,
      expiringSlhsCount,
      totalMaxCapacity,
      totalActiveQuota,
      avgUtilization,
      avgComposite,
      avgSafety,
      avgColdChain,
      avgTimeliness
    }
  }, [sppgList])

  // CSV Export Functionality
  const exportCsv = () => {
    if (!filtered.length) return
    const headers = [
      'Kode SPPG',
      'Nama Dapur Produsen',
      'Tipe',
      'Kota',
      'Penanggung Jawab',
      'Kapasitas Maks',
      'Kuota Aktif',
      'Jumlah Sekolah',
      'Safety Score AI',
      'Cold Chain Score',
      'Timeliness Score',
      'Skor Gabungan',
      'Grade',
      'Status SLHS',
      'Masa Berlaku SLHS',
      'Status Operasional'
    ]

    const rows = filtered.map((s) => [
      s.code,
      s.name,
      s.typeLabel,
      s.city,
      s.manager,
      s.capacity.maxDailyPortions,
      s.capacity.activeQuota,
      s.assignedSchools.length,
      s.scorecard.safetyScore + '%',
      s.scorecard.coldChainScore + '%',
      s.scorecard.timelinessScore + '%',
      s.scorecard.compositeScore + '%',
      s.scorecard.grade,
      s.certificates?.slhs?.status ?? '—',
      s.certificates?.slhs?.validUntil ?? '—',
      s.status
    ])

    const escape = (cell) => {
      const str = cell == null ? '' : String(cell)
      return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
    }

    const csvContent = [headers, ...rows].map((r) => r.map(escape).join(',')).join('\n')
    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `audit-dapur-sppg-${new Date().toISOString().slice(0, 10)}.csv`
    a.click()
    URL.revokeObjectURL(url)
    showToast?.(`${filtered.length} data produsen berhasil diekspor ke format CSV.`)
  }

  // 1. ACTION: Penerbitan Surat Peringatan (SP-1 / SP-2)
  const handleOpenWarningModal = (sppg) => {
    setOpenMenu(null)
    const letters = sppg.warningLetters || []
    const hasSp1 = letters.some((w) => w.type === 'SP-1')
    const hasSp2 = letters.some((w) => w.type === 'SP-2')

    if (hasSp1 && hasSp2) {
      showToast?.(`[PERINGATAN MAKSIMAL] ${sppg.name} telah menerima SP-1 dan SP-2. Sanksi eskalasi berikutnya adalah Penangguhan Izin Distribusi (Suspension).`, 'error')
      return
    }

    const nextSpType = !hasSp1 ? 'SP-1' : 'SP-2'
    const docSeq = sppg.code?.replace('BGN-SPPG-', '') || '014'

    setWarningModalData({
      sppg,
      warningType: nextSpType,
      letterNumber: `BGN/${nextSpType}/MBG/IX/2026/0${docSeq}`,
      issueDate: new Date().toLocaleDateString('id-ID', { day: '2-digit', month: 'long', year: 'numeric' }),
      deadlineDays: nextSpType === 'SP-1' ? '3 Hari Kerja' : '7 Hari Kerja',
      reasons: [
        `Kepatuhan rata-rata 7 hari terakhir tercatat ${sppg.scorecard.compositeScore}% (di bawah batas minimum 85%).`,
        `Skor Cold-Chain armada tercatat ${sppg.scorecard.coldChainScore}% dengan fluktuasi suhu di atas batas aman.`,
        sppg.recipeAudit.tkpiStatus === 'VIOLATION'
          ? `Ditemukan deviasi takaran gramatur bahan baku (${sppg.recipeAudit.avgDeviationPct}%) melanggar standar TKPI Kemenkes RI.`
          : 'Catatan pengawasan lapangan Satgas MBG Wilayah.'
      ],
      legalBasis: 'Perpres No. 83/2024 & Pasal 22 Juknis Operasional Penjaminan Mutu MBG RI',
      notes: ''
    })
  }

  const executeIssueWarning = async () => {
    if (!warningModalData || !canDiscipline) return
    const { sppg, warningType, letterNumber, reasons, deadlineDays } = warningModalData
    const result = await onAction?.('issue_warning', sppg, {
      letterType: warningType,
      letterNumber,
      reason: reasons.join(' '),
      deadlineLabel: deadlineDays,
    })
    if (result?.ok) setWarningModalData(null)
  }

  const executeSuspension = async () => {
    if (!suspensionModalData || !canDiscipline) return
    const { sppg, alternativeSppgId, formalNotes } = suspensionModalData
    const result = await onAction?.('suspend_kitchen', sppg, {
      reason: formalNotes,
      alternativeSppgId,
    })
    if (result?.ok) setSuspensionModalData(null)
  }

  const handleOpenReinstateModal = (sppg) => {
    setOpenMenu(null)
    setReinstateModalData({
      sppg,
      reason: 'Audit sanitasi ulang & perbaikan fasilitas telah diverifikasi oleh tim pengawas BGN.',
      initialQuota: sppg.capacity?.maxDailyPortions ? Math.round(sppg.capacity.maxDailyPortions * 0.7) : 1500,
    })
  }

  const executeReinstate = async () => {
    if (!reinstateModalData || !canDiscipline) return
    const { sppg, reason, initialQuota } = reinstateModalData
    const result = await onAction?.('reinstate_kitchen', sppg, {
      reason,
      initialQuota: parseInt(initialQuota, 10) || 1500,
    })
    if (result?.ok) setReinstateModalData(null)
  }

  // 2. ACTION: Penangguhan Izin Distribusi (Suspension)
  const handleOpenSuspensionModal = (sppg) => {
    setOpenMenu(null)
    // Find viable alternative kitchens nearby
    const alternatives = sppgList.filter((k) => k.id !== sppg.id && k.status === 'active')

    setSuspensionModalData({
      sppg,
      reasonCategory: 'pathogen', // 'pathogen' | 'recipe_fraud' | 'sanitation_failure'
      alternativeSppgId: alternatives[0]?.id || '',
      formalNotes: 'Ditemukan hasil positif uji kultur laboratorium mikrobiologi dan/atau indikasi cemaran silang berbahaya.',
      notifyDinkes: true,
      contingencyRerouting: true
    })
  }

  // 3. ACTION: Audit Gramatur Resep (TKPI Inspection)
  const handleOpenRecipeAudit = (sppg) => {
    setOpenMenu(null)
    setRecipeAuditModalData({
      sppg,
      tkpiStatus: sppg.recipeAudit.tkpiStatus || 'COMPLIANT',
      avgDeviationPct: sppg.recipeAudit.avgDeviationPct || 0,
      auditorName: sppg.recipeAudit.auditor || '',
      notes: ''
    })
  }

  const executeVerifyRecipeAudit = async () => {
    if (!recipeAuditModalData || !canManage) return
    const { sppg, tkpiStatus, avgDeviationPct, auditorName, notes } = recipeAuditModalData
    const result = await onAction?.('audit_recipe', sppg, {
      tkpiStatus,
      avgDeviationPct: avgDeviationPct ?? 0,
      auditor: auditorName,
      notes,
    })
    if (result?.ok) setRecipeAuditModalData(null)
  }

  // 4. ACTION: Penetapan Kuota Produksi
  const handleOpenQuotaModal = (sppg) => {
    setOpenMenu(null)
    setQuotaModalData({
      sppg,
      newQuota: sppg.capacity.activeQuota,
      reason: 'Penyesuaian kuota harian berdasarkan kapasitas sarana dan skor akreditasi dapur.'
    })
  }

  const executeSetQuota = async () => {
    if (!quotaModalData || !canManage) return
    const { sppg, newQuota, reason } = quotaModalData
    const quotaVal = parseInt(newQuota, 10) || sppg.capacity.activeQuota
    const result = await onAction?.('update_quota', sppg, {
      quota: quotaVal,
      reason,
    })
    if (result?.ok) setQuotaModalData(null)
  }

  return (
    <div className="space-y-6">
      {/* ====================================================================
          1. COMPACT TOP UTILITY & LIVE TELEMETRY BAR (NO HEAVY CARD)
          ==================================================================== */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div className="text-xs text-slate-500 font-medium">
          Direktori &amp; Evaluasi Kepatuhan Dapur SPPG / Rekanan MBG
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
            <span>Cetak Rapor</span>
          </button>
        </div>
      </div>

      {/* ====================================================================
          2. EXECUTIVE KPI COMMAND RIBBON (4 METRIC CARDS)
          ==================================================================== */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Produsen & Utilisasi Kapasitas */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-[11px] font-medium text-slate-500">
              Produsen terakreditasi
            </span>
          </div>

          <div className="my-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-slate-900 tabular-nums tracking-tight">
                {stats.totalActiveQuota.toLocaleString()}
              </span>
              <span className="text-xs text-slate-500 font-medium">porsi / hari</span>
            </div>

            {/* Segmented Capacity Bar */}
            <div className="mt-3 h-2 w-full rounded-full bg-slate-100 overflow-hidden flex">
              <div
                style={{ width: `${stats.avgUtilization}%` }}
                className="bg-blue-600 h-full"
                title={`Kapasitas Digunakan: ${stats.avgUtilization}%`}
              />
              <div
                style={{ width: `${100 - stats.avgUtilization}%` }}
                className="bg-slate-200 h-full"
                title={`Kapasitas Cadangan: ${100 - stats.avgUtilization}%`}
              />
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 mt-2 font-mono">
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                {stats.sentralCount} Dapur Sentral
              </span>
              <span className="flex items-center gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-blue-600" />
                {stats.rekananCount} Mitra Rekanan
              </span>
              <span className="text-slate-500">
                Maks {stats.totalMaxCapacity.toLocaleString()}
              </span>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Rata-rata Utilisasi:</span>
            <span className="font-bold text-slate-700 font-mono">
              {stats.avgUtilization}% (Aman &lt;85%)
            </span>
          </div>
        </div>

        {/* Card 2: Rapor Kepatuhan Mutu Nasional */}
        <div className="bg-white rounded-xl border border-slate-200 p-4 flex flex-col justify-between">
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-[11px] font-medium text-slate-500">
              Rapor kepatuhan nasional
            </span>
          </div>

          <div className="my-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-emerald-800 font-mono tracking-tight">
                {stats.avgComposite}%
              </span>
              <span className="text-xs font-semibold text-emerald-700">Skor Gabungan</span>
            </div>

            {/* Tri-Metric Indicators */}
            <div className="grid grid-cols-3 gap-1.5 mt-2.5 pt-1 text-[10px] font-mono">
              <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200/60 text-center">
                <p className="text-[11px] text-slate-500 font-bold">SAFETY</p>
                <p className="font-bold text-slate-800">{stats.avgSafety}%</p>
              </div>
              <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200/60 text-center">
                <p className="text-[11px] text-slate-500 font-bold">COLD-CH</p>
                <p className="font-bold text-slate-800">{stats.avgColdChain}%</p>
              </div>
              <div className="bg-slate-50 p-1.5 rounded-lg border border-slate-200/60 text-center">
                <p className="text-[11px] text-slate-500 font-bold">ON-TIME</p>
                <p className="font-bold text-slate-800">{stats.avgTimeliness}%</p>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[11px] text-slate-500 flex items-center justify-between">
            <span>Metode Evaluasi:</span>
            <span className="font-semibold text-slate-700 font-mono">AI Visual + IoT Sensor</span>
          </div>
        </div>

        {/* Card 3: Peringatan & Anomali Kritis (Clickable Filter to isolate issues) */}
        <button
          type="button"
          aria-pressed={statusFilter === 'warning' || statusFilter === 'suspended'}
          onClick={() => {
            if (statusFilter === 'warning' || statusFilter === 'suspended') {
              setStatusFilter('all')
            } else {
              setStatusFilter('warning')
            }
          }}
          className={`bg-white rounded-2xl p-5 border text-left relative overflow-hidden flex flex-col justify-between transition-all focus-visible:outline-2 focus-visible:outline-blue-600 ${
            statusFilter === 'warning'
              ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/10'
              : 'border-slate-200/90 hover:border-amber-300'
          }`}
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-[11px] font-medium text-slate-500">
              Tindakan disiplin digital
            </span>
            <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-rose-700 bg-rose-50 px-2 py-0.5 rounded-full border border-rose-200/80">
              PASAL 22 JUKNIS
            </span>
          </div>

          <div className="my-3">
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-black text-rose-800 font-mono tracking-tight">
                {stats.warningCount + stats.suspendedCount}
              </span>
              <span className="text-xs font-bold text-rose-700">Dapur Perlu Intervensi</span>
            </div>

            <div className="mt-2.5 p-2 rounded-xl bg-rose-50 border border-rose-200 text-[11px] text-rose-900 leading-snug space-y-1">
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 font-semibold text-amber-800">
                  <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-800" />
                  1 Penerbitan SP-1 Aktif
                </span>
                <span className="font-mono text-[10px] font-bold text-amber-700">Surabaya</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="flex items-center gap-1 font-semibold text-rose-800">
                  <AlertOctagon className="h-3.5 w-3.5 shrink-0 text-rose-800" />
                  1 Izin Ditangguhkan
                </span>
                <span className="font-mono text-[10px] font-bold text-rose-700">Jayapura</span>
              </div>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[10px] flex items-center justify-between text-blue-700 font-bold">
            <span>
              {statusFilter === 'warning' ? 'Sedang Menyaring Dapur Anomali' : 'Saring Dapur Perlu SP / Penangguhan'}
            </span>
            <ChevronRight className="h-3 w-3" />
          </div>
        </button>

        {/* Card 4: Audit Sertifikat SLHS & HACCP */}
        <button
          type="button"
          aria-pressed={statusFilter === 'expiring'}
          onClick={() => setStatusFilter(statusFilter === 'expiring' ? 'all' : 'expiring')}
          className={`bg-white rounded-2xl p-5 border text-left relative overflow-hidden flex flex-col justify-between transition-all focus-visible:outline-2 focus-visible:outline-blue-600 ${
            statusFilter === 'expiring'
              ? 'border-amber-500 ring-2 ring-amber-500/20 bg-amber-50/10'
              : 'border-slate-200/90 hover:border-slate-300'
          }`}
        >
          <div className="flex items-center justify-between pb-2 border-b border-slate-100">
            <span className="text-[11px] font-medium text-slate-500">
              Audit SLHS & HACCP
            </span>
            <span className="flex items-center gap-1 text-[10px] font-mono font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200/60">
              DINKES SETEMPAT
            </span>
          </div>

          <div className="my-3">
            <div className="flex items-baseline gap-2">
              <span className="text-2xl font-semibold text-slate-900 tabular-nums tracking-tight">
                {sppgList.filter((s) => s.certificates?.slhs?.status === 'valid').length}
              </span>
              <span className="text-xs text-slate-500 font-medium">dari {stats.total} berizin penuh</span>
            </div>

            <div className="mt-2.5 p-2 rounded-xl bg-amber-50/80 border border-amber-200/80 text-[11px] text-amber-900 leading-snug">
              <p className="font-semibold flex items-center gap-1.5 text-amber-800">
                <Clock className="h-3.5 w-3.5 shrink-0" />
                <span>{stats.expiringSlhsCount} Sertifikat Segera Berakhir (&lt;30 Hari)</span>
              </p>
              <p className="text-[10px] text-amber-700 mt-0.5 font-mono">
                SPPG Sentral Tamalate (Sisa 18 Hari)
              </p>
            </div>
          </div>

          <div className="pt-3 border-t border-slate-100 text-[10px] flex items-center justify-between text-blue-700 font-bold">
            <span>
              {statusFilter === 'expiring' ? 'Menyaring Sertifikat Segera Expired' : 'Saring Sertifikat &lt;30 Hari'}
            </span>
            <ChevronRight className="h-3 w-3" />
          </div>
        </button>
      </div>

      {/* ====================================================================
          3. INTEGRATED ANALYTICAL CHARTS (RECHARTS TELEMETRY)
          ==================================================================== */}
      <SppgCharts sppgList={sppgList} />

      {/* ====================================================================
          4. FILTER CONTROLS & SEARCH BAR
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
              placeholder="Cari nama dapur, kode BGN, PIC, sekolah binaan, atau kota..."
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
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                statusFilter === 'all'
                  ? 'bg-slate-900 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              Semua ({stats.total})
            </button>
            <button
              onClick={() => setStatusFilter('active')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                statusFilter === 'active'
                  ? 'bg-emerald-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              Aktif ({stats.activeCount})
            </button>
            <button
              onClick={() => setStatusFilter('warning')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                statusFilter === 'warning'
                  ? 'bg-amber-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              Peringatan SP-1 ({stats.warningCount})
            </button>
            <button
              onClick={() => setStatusFilter('suspended')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                statusFilter === 'suspended'
                  ? 'bg-rose-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              Ditangguhkan ({stats.suspendedCount})
            </button>
            <button
              onClick={() => setStatusFilter('expiring')}
              className={`px-3 py-1.5 rounded-lg font-semibold transition ${
                statusFilter === 'expiring'
                  ? 'bg-blue-600 text-white shadow-2xs'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200/70'
              }`}
            >
              SLHS &lt;30 Hari ({stats.expiringSlhsCount})
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

            {/* Type Selector */}
            <select
              value={typeFilter}
              onChange={(e) => setTypeFilter(e.target.value)}
              className="text-xs bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-700 font-medium focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
            >
              <option value="all">Semua Tipe</option>
              <option value="sentral">Dapur Sentral BGN</option>
              <option value="rekanan">Katering Rekanan</option>
            </select>

            {/* View Density Toggle */}
            <div className="hidden sm:flex items-center rounded-xl border border-slate-200 p-0.5 bg-slate-50">
              <button
                onClick={() => setDensity('normal')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition ${
                  density === 'normal' ? 'bg-white text-slate-800 shadow-2xs' : 'text-slate-500'
                }`}
              >
                Normal
              </button>
              <button
                onClick={() => setDensity('compact')}
                className={`px-2.5 py-1 text-[11px] font-semibold rounded-lg transition ${
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
          5. ENTERPRISE VENDOR DIRECTORY DATA TABLE
          ==================================================================== */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs min-w-[1040px] table-fixed">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-5 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-[26%]">
                  Dapur SPPG
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-[16%]">
                  Kapasitas terpakai
                </th>
                <th className="px-4 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-[18%]">
                  Rapor akreditasi
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-[15%]">
                  Sertifikat
                </th>
                <th className="px-4 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-[13%]">
                  Status
                </th>
                <th className="px-5 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 w-[12%]">
                  <span className="sr-only">Aksi</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="6" className="py-12 text-center text-slate-500">
                    <p className="font-semibold text-slate-700">Tidak ada Dapur SPPG yang sesuai dengan kriteria filter.</p>
                    <button
                      onClick={() => {
                        setSearch('')
                        setStatusFilter('all')
                        setCityFilter('all')
                        setTypeFilter('all')
                      }}
                      className="mt-2 text-xs font-semibold text-blue-800 hover:underline cursor-pointer"
                    >
                      Reset Semua Filter
                    </button>
                  </td>
                </tr>
              ) : (
                filtered.map((sppg) => {
                  const isWarning = sppg.status === 'warning' || sppg.scorecard.compositeScore < 85
                  const isSuspended = sppg.status === 'suspended'
                  const slhsDays = sppg.certificates.slhs.daysLeft
                  const paddingY = density === 'compact' ? 'py-3' : 'py-3.5'

                  // Clean display helpers
                  const cleanName = sppg.name.replace('SPPG Sentral ', '').replace('Dapur Katering ', '')
                  const initials = cleanName.split(' ').filter(Boolean).slice(0, 2).map((p) => p[0]).join('').toUpperCase() || 'SP'
                  const cleanManager = sppg.manager.split(',')[0].trim()
                  const cleanNutritionist = sppg.nutritionist.split('(')[0].replace(/,\s*$/, '').trim()

                  // Format HACCP Grade nicely without the split bug
                  let haccpDisplay = 'Grade A'
                  if (sppg.certificates.haccp.grade.includes('Grade A+')) haccpDisplay = 'Grade A+'
                  else if (sppg.certificates.haccp.grade.includes('Grade A')) haccpDisplay = 'Grade A'
                  else if (sppg.certificates.haccp.grade.includes('Grade B+')) haccpDisplay = 'Grade B+'
                  else if (sppg.certificates.haccp.grade.includes('Grade B')) haccpDisplay = 'Grade B'
                  else if (sppg.certificates.haccp.grade.includes('Audit')) haccpDisplay = 'Perlu Audit'
                  else if (sppg.certificates.haccp.grade.includes('Gagal')) haccpDisplay = 'Belum Lolos'

                  return (
                    <Fragment key={sppg.id}>
                    <tr
                      onClick={() => setSelectedSppg(sppg)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault()
                          setSelectedSppg(sppg)
                        }
                      }}
                      tabIndex={0}
                      aria-label={`Detail ${sppg.name}`}
                      className={`cursor-pointer transition-colors ${
                        isSuspended ? 'bg-rose-50/40' : isWarning ? 'bg-amber-50/40' : 'hover:bg-slate-50'
                      } focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-blue-600`}
                    >
                      {/* Col 1: Dapur SPPG & PIC */}
                      <td className={`px-5 ${paddingY}`}>
                        <div className="flex items-center gap-3">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation()
                              setExpandedId(expandedId === sppg.id ? null : sppg.id)
                            }}
                            aria-expanded={expandedId === sppg.id}
                            aria-label={
                              expandedId === sppg.id
                                ? `Tutup daftar sekolah ${sppg.name}`
                                : `Tampilkan daftar sekolah ${sppg.name}`
                            }
                            className="p-1 -ml-1 rounded-md text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition cursor-pointer shrink-0 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                          >
                            {expandedId === sppg.id ? (
                              <ChevronDown className="h-4 w-4" />
                            ) : (
                              <ChevronRight className="h-4 w-4" />
                            )}
                          </button>
                          <div className="h-9 w-9 rounded-lg bg-slate-100 text-slate-700 flex items-center justify-center font-semibold text-xs shrink-0">
                            {initials}
                          </div>
                          <div className="min-w-0">
                            <div className="flex items-baseline gap-2 flex-wrap">
                              <span className="font-semibold text-slate-900 text-sm">{sppg.name}</span>
                              <Code>{sppg.code}</Code>
                            </div>
                            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                              {sppg.type === 'sentral' ? 'Dapur sentral' : 'Mitra rekanan'} &middot; {sppg.city}
                            </p>
                            <p className="text-[11px] text-slate-500 mt-0.5 truncate">
                              PIC {cleanManager} &middot; Gizi {cleanNutritionist}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Col 2: Kapasitas terpakai */}
                      <td className={`px-4 ${paddingY} text-right`}>
                        <Figure
                          value={`${sppg.capacity.activeQuota.toLocaleString('id-ID')} / ${sppg.capacity.maxDailyPortions.toLocaleString('id-ID')}`}
                          hint={`${sppg.capacity.utilizationPct}% terpakai`}
                          tone={isSuspended ? 'critical' : sppg.capacity.utilizationPct > 90 ? 'warn' : 'idle'}
                        />
                        <div className="mt-1.5 h-1 w-full max-w-[9rem] ml-auto bg-slate-100 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${sppg.capacity.utilizationPct}%` }}
                            className={`h-full rounded-full ${
                              isSuspended ? 'bg-rose-600' : sppg.capacity.utilizationPct > 90 ? 'bg-amber-600' : 'bg-blue-600'
                            }`}
                          />
                        </div>
                        <button
                          onClick={(e) => {
                            e.stopPropagation()
                            setExpandedId(expandedId === sppg.id ? null : sppg.id)
                          }}
                          aria-expanded={expandedId === sppg.id}
                          className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-blue-700 hover:underline cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600 rounded"
                        >
                          {expandedId === sppg.id ? (
                            <ChevronDown className="h-3 w-3" />
                          ) : (
                            <ChevronRight className="h-3 w-3" />
                          )}
                          {sppg.assignedSchools.length} sekolah binaan
                        </button>
                      </td>

                      {/* Col 3: Rapor akreditasi. Skor adalah angka, grade cukup label. */}
                      <td className={`px-4 ${paddingY} text-right`}>
                        <Figure
                          value={`${sppg.scorecard.compositeScore}%`}
                          hint={`Nilai gabungan &middot; ${sppg.scorecard.weeklyTrend}`}
                          tone={sppg.scorecard.compositeScore >= 90 ? 'ok' : sppg.scorecard.compositeScore >= 80 ? 'warn' : 'critical'}
                        />
                        <p className="text-[11px] text-slate-500 mt-1">
                          AI {sppg.scorecard.safetyScore}% &middot; Suhu {sppg.scorecard.coldChainScore}% &middot; Waktu{' '}
                          {sppg.scorecard.timelinessScore}%
                        </p>
                      </td>

                      {/* Col 4: Sertifikat. Satu baris, tanpa pil bertumpuk. */}
                      <td className={`px-4 ${paddingY}`}>
                        <div className="space-y-0.5">
<StatusDot
                             tone={sppg.certificates?.slhs?.status === 'valid' ? 'ok' : sppg.certificates?.slhs?.status === 'expiring' ? 'warn' : 'critical'}
                           >
                             SLHS {sppg.certificates?.slhs?.status === 'valid' ? 'valid' : sppg.certificates?.slhs?.status === 'expiring' ? `sisa ${slhsDays}h` : 'kedaluwarsa'}
                           </StatusDot>
                          <p className="text-[11px] text-slate-500">HACCP {haccpDisplay}</p>
                          <p className="text-[11px] text-slate-500 font-mono truncate">{sppg.certificates?.slhs?.number ?? '—'}</p>
                        </div>
                      </td>

                      {/* Col 5: Status operasional. Satu status dominan per baris. */}
                      <td className={`px-4 ${paddingY}`}>
                        {isSuspended ? (
                          <StatusDot tone="critical">DIBEKUKAN</StatusDot>
                        ) : isWarning ? (
                          <StatusDot tone="warn">PERLU TINDAK</StatusDot>
                        ) : (
                          <StatusDot tone="ok">OPERASIONAL</StatusDot>
                        )}
                      </td>

                      {/* Col 6: Aksi */}
                      <td className={`px-5 ${paddingY} text-right`} onClick={(e) => e.stopPropagation()}>
                        <div className="flex items-center justify-end gap-1">
                          <RowAction onClick={() => setSelectedSppg(sppg)}>Detail</RowAction>
                          <button
                            type="button"
                            data-row-menu-toggle
                            onClick={(e) => {
                              if (openMenu?.id === sppg.id) {
                                setOpenMenu(null)
                                return
                              }
                              const rect = e.currentTarget.getBoundingClientRect()
                              const width = 224
                              const left = Math.max(8, Math.min(rect.right - width, window.innerWidth - width - 8))
                              setOpenMenu({ id: sppg.id, top: rect.bottom + 4, left })
                            }}
                            aria-label={`Aksi lain untuk ${sppg.name}`}
                            aria-expanded={openMenu?.id === sppg.id}
                            className="p-2 rounded-md text-slate-500 hover:text-slate-800 hover:bg-slate-100 transition cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-600"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>

                    {expandedId === sppg.id && (
                      <tr className="bg-slate-50/70">
                        <td colSpan={6} className="px-5 pb-4 pt-0">
                          <div className="rounded-xl border border-slate-200 bg-white p-3.5">
                            <div className="flex items-center justify-between gap-2 mb-2.5">
                              <p className="text-[11px] font-bold uppercase tracking-wider text-slate-500">
                                Daftar Sekolah Binaan ({sppg.assignedSchools.length})
                              </p>
                              <span className="text-[10px] font-mono text-slate-400">
                                schools.sppg_id = {sppg.id}
                              </span>
                            </div>

                            {sppg.assignedSchools.length === 0 ? (
                              <p className="text-xs text-slate-500">
                                Belum ada sekolah yang ditugaskan ke dapur ini.
                              </p>
                            ) : (
                              <ul className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-2">
                                {sppg.assignedSchools.map((sch) => (
                                  <li
                                    key={sch.id}
                                    className="flex items-start justify-between gap-3 rounded-lg border border-slate-100 bg-slate-50/70 px-3 py-2"
                                  >
                                    <div className="min-w-0">
                                      <p className="text-xs font-semibold text-slate-800 truncate" title={sch.name}>
                                        {sch.name}
                                      </p>
                                      <p className="text-[11px] text-slate-500 font-mono">
                                        NPSN {sch.npsn}
                                        {sch.city && sch.city !== '—' ? ` · ${sch.city}` : ''}
                                      </p>
                                    </div>
                                    <span className="text-[11px] font-mono text-slate-600 shrink-0 whitespace-nowrap">
                                      {sch.portions.toLocaleString('id-ID')} porsi
                                    </span>
                                  </li>
                                ))}
                              </ul>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                    </Fragment>
                  )
                })
              )}
            </tbody>
          </table>
        </div>

        {/* Table Footer Summary */}
        <div className="bg-slate-50/70 border-t border-slate-200/80 px-4 py-3 flex flex-col sm:flex-row items-center justify-between text-[11px] text-slate-500 gap-2">
          <div className="flex items-center gap-2">
            <span>Menampilkan <strong>{filtered.length}</strong> dari <strong>{stats.total}</strong> Dapur SPPG terdaftar</span>
            <span className="text-slate-300">&bull;</span>
            <span className="text-emerald-700 font-semibold">Tersinkronisasi dengan Database Satgas MBG</span>
          </div>
          <div className="flex items-center gap-4 text-slate-500 font-mono text-[10px]">
            <span>TOTAL SUPLAI: <strong>{stats.totalActiveQuota.toLocaleString()} PORSI</strong></span>
            <span>&bull;</span>
            <span>STANDAR BPKP &amp; KEMENKES RI</span>
          </div>
        </div>
      </div>

      {/* ====================================================================
          MODAL 1: PENERBITAN SURAT PERINGATAN (SP-1 / SP-2 DIGITAL)
          ==================================================================== */}
      {warningModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-slate-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-amber-100 text-amber-800 text-[10px] font-mono font-bold">
                    INSTRUMEN PENEGAKAN DISIPLIN
                  </span>
                  <span className="text-xs font-mono text-slate-500">
                    {warningModalData.letterNumber}
                  </span>
                </div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight">
                  Penerbitan Surat Peringatan {warningModalData.warningType} Digital
                </h3>
                <p className="text-xs text-slate-500">
                  Kepada: <strong className="text-slate-900">{warningModalData.sppg.name}</strong> ({warningModalData.sppg.legalEntity})
                </p>
              </div>
              <button
                onClick={() => setWarningModalData(null)}
                className="text-slate-500 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Official Letter Preview Card */}
            <div className="p-4 rounded-xl bg-amber-50/50 border border-amber-200/80 space-y-3 text-xs">
              <div className="flex items-center justify-between pb-2 border-b border-amber-200/60">
                <span className="font-bold text-amber-900 uppercase tracking-wider text-[11px]">
                  BADAN GIZI NASIONAL REPUBLIK INDONESIA
                </span>
                <span className="font-mono text-amber-800 text-[10px] font-bold">
                  {warningModalData.issueDate}
                </span>
              </div>

              <div>
                <p className="text-slate-600 font-semibold mb-1">Dasar Pertimbangan Hukum:</p>
                <p className="text-slate-700 italic bg-white p-2 rounded border border-amber-200/60 text-[11px]">
                  "{warningModalData.legalBasis}"
                </p>
              </div>

              <div>
                <p className="text-slate-600 font-semibold mb-1">Temuan Pelanggaran Mutu &amp; Kepatuhan:</p>
                <ul className="space-y-1 text-slate-700 bg-white p-2.5 rounded border border-amber-200/60">
                  {warningModalData.reasons.map((r, i) => (
                    <li key={i} className="flex items-start gap-1.5">
                      <span className="text-rose-500 font-bold">Ã¢â‚¬Â¢</span>
                      <span>{r}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="grid grid-cols-2 gap-3 pt-1">
                <div className="bg-white p-2.5 rounded border border-amber-200/60">
                  <span className="text-[11px] text-slate-500 font-semibold uppercase">Tenggat Waktu Klarifikasi:</span>
                  <p className="font-bold text-rose-800 mt-0.5">{warningModalData.deadlineDays}</p>
                </div>
                <div className="bg-white p-2.5 rounded border border-amber-200/60">
                  <span className="text-[11px] text-slate-500 font-semibold uppercase">Tembusan Resmi:</span>
                  <p className="font-bold text-slate-700 mt-0.5">Dinkes, BPKP, &amp; Satgas MBG Wilayah</p>
                </div>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setWarningModalData(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                onClick={executeIssueWarning}
                className="px-4 py-2 rounded-xl bg-amber-600 hover:bg-amber-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm"
              >
                <FileCheck className="h-4 w-4" />
                <span>Terbitkan &amp; Tanda Tangani Digital (DS-BGN)</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 2: PENANGGUHAN IZIN DISTRIBUSI (SUSPENSION)
          ==================================================================== */}
      {suspensionModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-rose-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-4 border-b border-rose-100">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-rose-100 text-rose-800 text-[10px] font-mono font-bold">
                    TINDAKAN DARURAT KRITIS
                  </span>
                  <span className="text-xs font-mono text-slate-500">PASAL 24 JUKNIS MBG</span>
                </div>
                <h3 className="text-lg font-black text-rose-800 tracking-tight flex items-center gap-2">
                  <AlertOctagon className="h-5 w-5" />
                  <span>Pembekuan Hak Suplai / Distribusi Vendor</span>
                </h3>
                <p className="text-xs text-slate-500">
                  Dapur: <strong className="text-slate-900">{suspensionModalData.sppg.name}</strong>
                </p>
              </div>
              <button
                onClick={() => setSuspensionModalData(null)}
                className="text-slate-500 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Warning Box */}
            <div className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-900 space-y-2">
              <p className="font-bold flex items-center gap-1.5 text-rose-800">
                <AlertTriangle className="h-4 w-4 shrink-0 text-rose-800" />
                <span>Peringatan Keamanan Pangan Nasional:</span>
              </p>
              <p className="leading-relaxed">
                Tindakan ini akan <strong>membekukan sementara seluruh hak masak dan distribusi</strong> dari {suspensionModalData.sppg.name} guna mencegah insiden keracunan pangan pada siswa. Kuota aktif akan diset menjadi 0 porsi.
              </p>
            </div>

            {/* Contingency Re-routing Form */}
            <div className="space-y-3 text-xs">
              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Pilih Dapur Pengalih Kontingensi (Re-Routing Suplai):
                </label>
                <select
                  value={suspensionModalData.alternativeSppgId}
                  onChange={(e) =>
                    setSuspensionModalData({ ...suspensionModalData, alternativeSppgId: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-slate-800 font-medium focus:ring-2 focus:ring-blue-500"
                >
                  {sppgList
                    .filter((k) => k.id !== suspensionModalData.sppg.id && k.status === 'active')
                    .map((k) => (
                      <option key={k.id} value={k.id}>
                        {k.name} ({k.city}): Sisa Buffer Kapasitas: {(k.capacity.maxDailyPortions - k.capacity.activeQuota).toLocaleString()} Porsi
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-slate-500 mt-1">
                  Sekolah binaan ({suspensionModalData.sppg.assignedSchools.length} sekolah) otomatis dialihkan agar siswa tetap menerima makan siang.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">Catatan Audit Pembekuan Izin:</label>
                <textarea
                  rows="2"
                  value={suspensionModalData.formalNotes}
                  onChange={(e) =>
                    setSuspensionModalData({ ...suspensionModalData, formalNotes: e.target.value })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-rose-500"
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setSuspensionModalData(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                onClick={executeSuspension}
                className="px-4 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm"
              >
                <Lock className="h-4 w-4" />
                <span>Bekukan Izin Distribusi Sekarang</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 3: AUDIT GRAMATUR RESEP (STANDAR TKPI KEMENKES RI)
          ==================================================================== */}
      {recipeAuditModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <div className="flex items-center gap-2">
                  <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-mono font-bold">
                    AUDIT TAKARAN PORSI
                  </span>
                  <span className="text-xs font-mono text-slate-500">STANDAR KEMENKES TKPI</span>
                </div>
                <h3 className="text-lg font-black text-slate-900 tracking-tight mt-1">
                  Audit Gramatur Resep Pangan Bergizi
                </h3>
                <p className="text-xs text-slate-500">
                  Produsen: <strong className="text-slate-900">{recipeAuditModalData.sppg.name}</strong>
                </p>
              </div>
              <button
                onClick={() => setRecipeAuditModalData(null)}
                className="text-slate-500 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Menu Header Card */}
            <div className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs">
              <div>
                <span className="text-[11px] text-slate-500 uppercase font-bold">Menu Hari Ini:</span>
                <p className="font-bold text-slate-900 mt-0.5">{recipeAuditModalData.sppg.recipeAudit.menuToday}</p>
              </div>
              <div className="text-right">
                <span className="text-[11px] text-slate-500 uppercase font-bold">Kecukupan Energi:</span>
                <p className="font-bold font-mono text-blue-800 text-sm mt-0.5">
                  {recipeAuditModalData.sppg.recipeAudit.actualCalories} / {recipeAuditModalData.sppg.recipeAudit.targetCalories} kkal
                </p>
              </div>
            </div>

            {/* Hasil Audit (diisi petugas lapangan) */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Status TKPI</label>
                <select
                  value={recipeAuditModalData.tkpiStatus || 'COMPLIANT'}
                  onChange={(e) =>
                    setRecipeAuditModalData((d) => ({ ...d, tkpiStatus: e.target.value }))
                  }
                  className="w-full px-2.5 py-1.5 text-xs font-mono font-bold border border-slate-200 rounded-lg focus:outline-2 focus:outline-blue-600"
                >
                  <option value="COMPLIANT">Sesuai</option>
                  <option value="WARNING">Perhatian</option>
                  <option value="VIOLATION">Pelanggaran</option>
                </select>
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Deviasi Rata-rata (%)</label>
                <input
                  type="number"
                  step="0.1"
                  value={recipeAuditModalData.avgDeviationPct ?? ''}
                  onChange={(e) =>
                    setRecipeAuditModalData((d) => ({
                      ...d,
                      avgDeviationPct: e.target.value === '' ? null : parseFloat(e.target.value),
                    }))
                  }
                  placeholder="0.0"
                  className="w-full px-2.5 py-1.5 text-xs font-mono font-bold border border-slate-200 rounded-lg focus:outline-2 focus:outline-blue-600"
                />
              </div>
              <div>
                <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Petugas Lapangan</label>
                <input
                  type="text"
                  value={recipeAuditModalData.auditorName || ''}
                  onChange={(e) =>
                    setRecipeAuditModalData((d) => ({ ...d, auditorName: e.target.value }))
                  }
                  placeholder="Nama auditor"
                  className="w-full px-2.5 py-1.5 text-xs font-mono font-bold border border-slate-200 rounded-lg focus:outline-2 focus:outline-blue-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-[10px] font-bold uppercase text-slate-500 mb-1">Catatan Berita Acara</label>
              <textarea
                value={recipeAuditModalData.notes || ''}
                onChange={(e) =>
                  setRecipeAuditModalData((d) => ({ ...d, notes: e.target.value }))
                }
                rows={2}
                placeholder="Temuan lapangan..."
                className="w-full px-2.5 py-1.5 text-xs font-mono font-bold border border-slate-200 rounded-lg focus:outline-2 focus:outline-blue-600 resize-none"
              />
            </div>

            {/* Table of 5 Food Groups */}
            <div className="border border-slate-200/80 rounded-xl overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200">
                  <tr>
                    <th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Komponen Pangan</th>
                    <th className="py-2.5 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Kode TKPI</th>
                    <th className="py-2.5 px-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Target Kemenkes</th>
                    <th className="py-2.5 px-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Realisasi Dapur</th>
                    <th className="py-2.5 px-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Deviasi</th>
                    <th className="py-2.5 px-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {recipeAuditModalData.sppg.recipeAudit.items.map((item, idx) => (
                    <tr key={idx} className="hover:bg-slate-50/50">
                      <td className="py-2.5 px-3 font-semibold text-slate-800">{item.name}</td>
                      <td className="py-2.5 px-3 font-mono text-slate-500 text-[10px]">{item.standardCode}</td>
                      <td className="py-2.5 px-3 text-right font-mono font-medium text-slate-600">{item.targetGram}g</td>
                      <td className="py-2.5 px-3 text-right font-mono font-bold text-slate-900">{item.actualGram}g</td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono font-bold ${
                          item.devPct < -5 ? 'text-rose-800' : 'text-slate-700'
                        }`}
                      >
                        {item.devPct > 0 ? `+${item.devPct}%` : `${item.devPct}%`}
                      </td>
                      <td className="py-2.5 px-3 text-center">
                        <span
                          className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                            item.status === 'optimal'
                              ? 'bg-emerald-50 text-emerald-700'
                              : item.status === 'warning'
                              ? 'bg-amber-50 text-amber-800'
                              : 'bg-rose-50 text-rose-700'
                          }`}
                        >
                          {item.status === 'optimal' ? 'Sesuai' : item.status === 'warning' ? 'Perhatian' : 'Kurang'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            {/* Macro Breakdown */}
            <div className="grid grid-cols-3 gap-2.5 text-center text-xs">
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 uppercase font-semibold">Protein</span>
                <p className="font-extrabold text-slate-900 font-mono mt-0.5">
                  {recipeAuditModalData.sppg.recipeAudit.actualProteinG}g / {recipeAuditModalData.sppg.recipeAudit.targetProteinG}g
                </p>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 uppercase font-semibold">Karbohidrat</span>
                <p className="font-extrabold text-slate-900 font-mono mt-0.5">
                  {recipeAuditModalData.sppg.recipeAudit.actualCarbsG}g / {recipeAuditModalData.sppg.recipeAudit.targetCarbsG}g
                </p>
              </div>
              <div className="p-2.5 bg-slate-50 rounded-xl border border-slate-200">
                <span className="text-[11px] text-slate-500 uppercase font-semibold">Lemak Sehat</span>
                <p className="font-extrabold text-slate-900 font-mono mt-0.5">
                  {recipeAuditModalData.sppg.recipeAudit.actualFatG}g / {recipeAuditModalData.sppg.recipeAudit.targetFatG}g
                </p>
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setRecipeAuditModalData(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-50 transition"
              >
                Tutup
              </button>
              <button
                onClick={executeVerifyRecipeAudit}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Sahkan Berita Acara Uji Gramatur</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 4: PENETAPAN KUOTA PRODUKSI HARIAN
          ==================================================================== */}
      {quotaModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-xl bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="px-2 py-0.5 rounded bg-blue-50 text-slate-800 text-[10px] font-mono font-bold">
                  ALOKASI KUOTA MBG
                </span>
                <h3 className="text-lg font-black text-slate-900 tracking-tight mt-1">
                  Penetapan Kuota Produksi Harian
                </h3>
                <p className="text-xs text-slate-500">
                  Dapur: <strong className="text-slate-900">{quotaModalData.sppg.name}</strong>
                </p>
              </div>
              <button
                onClick={() => setQuotaModalData(null)}
                className="text-slate-500 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            {/* Current vs Proposed Slider */}
            <div className="space-y-4 text-xs">
              <div className="bg-slate-50 p-4 rounded-xl border border-slate-200/80 space-y-3">
                <div className="flex justify-between items-baseline">
                  <span className="font-semibold text-slate-600">Alokasi Porsi Harian:</span>
                  <span className="text-2xl font-black font-mono text-blue-800">
                    {parseInt(quotaModalData.newQuota, 10).toLocaleString()} <span className="text-xs text-slate-500">porsi</span>
                  </span>
                </div>

                <input
                  type="range"
                  min="500"
                  max={quotaModalData.sppg.capacity.maxDailyPortions}
                  step="50"
                  value={quotaModalData.newQuota}
                  onChange={(e) =>
                    setQuotaModalData({ ...quotaModalData, newQuota: parseInt(e.target.value, 10) })
                  }
                  className="w-full h-2 bg-slate-200 rounded-lg appearance-none cursor-pointer accent-blue-600"
                />

                <div className="flex justify-between text-[10px] font-mono text-slate-500">
                  <span>Min: 500</span>
                  <span>
                    Utilisasi Mesin:{' '}
                    <strong className="text-slate-700 font-bold">
                      {Math.round((quotaModalData.newQuota / quotaModalData.sppg.capacity.maxDailyPortions) * 100)}%
                    </strong>
                  </span>
                  <span>Maks Peralatan: {quotaModalData.sppg.capacity.maxDailyPortions.toLocaleString()}</span>
                </div>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Justifikasi / Dasar Penetapan Kuota:
                </label>
                <textarea
                  rows="2"
                  value={quotaModalData.reason}
                  onChange={(e) => setQuotaModalData({ ...quotaModalData, reason: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-blue-500"
                  placeholder="Misal: Penambahan 1 sekolah binaan baru atau pembatasan kuota pasca perbaikan sarana..."
                />
              </div>
            </div>

            {/* Modal Actions */}
            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setQuotaModalData(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                onClick={executeSetQuota}
                className="px-4 py-2 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm"
              >
                <Sliders className="h-4 w-4" />
                <span>Simpan &amp; Terapkan Kuota</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL 5: DAFTAR SEKOLAH BINAAN (SUPLAI PORSI)
          ==================================================================== */}
      {schoolsModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="px-2 py-0.5 rounded bg-blue-100 text-blue-800 text-[10px] font-mono font-bold">
                  JARINGAN DISTRIBUSI PANGAN
                </span>
                <h3 className="text-lg font-black text-slate-900 tracking-tight mt-1">
                  Sekolah Binaan Tanggung Jawab Suplai
                </h3>
                <p className="text-xs text-slate-500">
                  Dapur: <strong className="text-slate-900">{schoolsModalData.sppg.name}</strong> ({schoolsModalData.sppg.assignedSchools.length} Titik Sekolah)
                </p>
              </div>
              <button
                onClick={() => setSchoolsModalData(null)}
                className="text-slate-500 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-2.5">
              {schoolsModalData.sppg.assignedSchools.map((sch, i) => (
                <div
                  key={sch.id || i}
                  className="p-3 rounded-xl bg-slate-50 border border-slate-200/80 flex items-center justify-between text-xs hover:border-blue-200 transition"
                >
                  <div className="space-y-0.5">
                    <p className="font-bold text-slate-900">{sch.name}</p>
                    <p className="text-[11px] text-slate-500 flex items-center gap-2">
                      <span>NPSN: <strong className="font-mono text-slate-700">{sch.npsn}</strong></span>
                      <span>&bull;</span>
                      <span>Jarak: <strong className="font-mono text-slate-700">{sch.distanceKm} km</strong> (~{sch.estMinutes} mnt)</span>
                    </p>
                    <p className="text-[11px] text-slate-500">
                      PJ: {sch.contactPerson}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <span className="text-[11px] text-slate-500 font-bold uppercase block">Porsi Harian:</span>
                    <span className="font-mono font-extrabold text-blue-800 text-sm">
                      {sch.portions.toLocaleString()} Porsi
                    </span>
                    <span className="text-[11px] text-emerald-800 font-semibold block mt-0.5">
                      Drop: {sch.dropTargetTime}
                    </span>
                  </div>
                </div>
              ))}
            </div>

            <div className="pt-2 flex items-center justify-end">
              <button
                onClick={() => setSchoolsModalData(null)}
                className="px-4 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs transition"
              >
                Tutup Jendela
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          6. SLIDE-OVER DRAWER FOR DEEP DIVE INSPECTION
          ==================================================================== */}
      {selectedSppg && (
        <div className="fixed inset-0 z-50 flex justify-end bg-slate-900/40 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-xl bg-white h-full shadow-2xl flex flex-col border-l border-slate-200 animate-in slide-in-from-right duration-300 overflow-hidden">
            {/* Drawer Topbar */}
            <div className="p-5 border-b border-slate-200 bg-slate-50/50">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="px-2 py-0.5 rounded text-[10px] font-mono font-bold bg-blue-100 text-blue-800">
                      {selectedSppg.code}
                    </span>
                    <span className="text-xs font-semibold text-slate-500">
                      {selectedSppg.cluster}
                    </span>
                  </div>
                  <h3 className="text-lg font-black text-slate-900 tracking-tight mt-1">
                    {selectedSppg.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {selectedSppg.address}, {selectedSppg.city}, {selectedSppg.province}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedSppg(null)}
                  className="p-1.5 text-slate-500 hover:text-slate-700 rounded-lg hover:bg-slate-200/50"
                  aria-label="Tutup Panel"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              {/* Tab Navigation */}
              <div className="flex items-center gap-1 mt-4 border-b border-slate-200 text-xs">
                <button
                  onClick={() => setDrawerTab('overview')}
                  className={`pb-2 px-2.5 font-bold transition border-b-2 ${
                    drawerTab === 'overview'
                      ? 'border-blue-600 text-blue-800'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Profil &amp; Sarana
                </button>
                <button
                  onClick={() => setDrawerTab('scorecard')}
                  className={`pb-2 px-2.5 font-bold transition border-b-2 ${
                    drawerTab === 'scorecard'
                      ? 'border-blue-600 text-blue-800'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Scorecard Mutu
                </button>
                <button
                  onClick={() => setDrawerTab('schools')}
                  className={`pb-2 px-2.5 font-bold transition border-b-2 ${
                    drawerTab === 'schools'
                      ? 'border-blue-600 text-blue-800'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Sekolah ({selectedSppg.assignedSchools.length})
                </button>
                <button
                  onClick={() => setDrawerTab('recipe')}
                  className={`pb-2 px-2.5 font-bold transition border-b-2 ${
                    drawerTab === 'recipe'
                      ? 'border-blue-600 text-blue-800'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Resep TKPI
                </button>
                <button
                  onClick={() => setDrawerTab('logs')}
                  className={`pb-2 px-2.5 font-bold transition border-b-2 ${
                    drawerTab === 'logs'
                      ? 'border-blue-600 text-blue-800'
                      : 'border-transparent text-slate-500 hover:text-slate-800'
                  }`}
                >
                  Log Disiplin
                </button>
              </div>
            </div>

            {/* Drawer Body (Scrollable) */}
            <div className="p-5 overflow-y-auto space-y-4 flex-1 text-xs text-slate-700">
              {/* TAB 1: OVERVIEW & FACILITIES */}
              {drawerTab === 'overview' && (
                <div className="space-y-4">
                  {/* Status Banner */}
                  <div
                    className={`p-3 rounded-xl border ${
                      selectedSppg.status === 'suspended'
                        ? 'bg-rose-50 border-rose-200 text-rose-900'
                        : selectedSppg.status === 'warning'
                        ? 'bg-amber-50 border-amber-200 text-amber-900'
                        : 'bg-emerald-50 border-emerald-200 text-emerald-900'
                    }`}
                  >
                    <p className="font-bold flex items-center gap-1.5">
                      <Info className="h-4 w-4" />
                      <span>{selectedSppg.statusNote}</span>
                    </p>
                  </div>

                  {/* Profile Cards */}
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[11px] text-slate-500 uppercase font-bold">Penanggung Jawab (PIC):</span>
                      <p className="font-bold text-slate-900 mt-1">{selectedSppg.manager}</p>
                      <p className="text-[11px] text-slate-500">{selectedSppg.managerPhone}</p>
                    </div>
                    <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                      <span className="text-[11px] text-slate-500 uppercase font-bold">Nutrisionis Terdaftar:</span>
                      <p className="font-bold text-slate-900 mt-1">{selectedSppg.nutritionist}</p>
                      <p className="text-[11px] text-slate-500 font-mono">{selectedSppg.nutritionistStr}</p>
                    </div>
                  </div>

                  {/* Kitchen Specs */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">
                      Spesifikasi Fasilitas Dapur:
                    </h4>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <span className="text-[11px] text-slate-500 uppercase">Luas Dapur</span>
                        <p className="font-bold text-slate-800 font-mono mt-0.5">{selectedSppg.kitchenArea}</p>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <span className="text-[11px] text-slate-500 uppercase">Tenaga Masak</span>
                        <p className="font-bold text-slate-800 font-mono mt-0.5">{selectedSppg.staffCount} Orang</p>
                      </div>
                      <div className="bg-white p-2 rounded-lg border border-slate-200">
                        <span className="text-[11px] text-slate-500 uppercase">Armada Kirim</span>
                        <p className="font-bold text-slate-800 font-mono mt-0.5">{selectedSppg.fleetCount} Unit</p>
                      </div>
                    </div>
                  </div>

                  {/* Machinery / Equipment List */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">
                      Inventaris Peralatan Masak Utama:
                    </h4>
                    <ul className="space-y-1 text-slate-600">
                      {selectedSppg.equipmentList.map((eq, i) => (
                        <li key={i} className="flex items-center gap-2">
                          <CheckCircle2 className="h-3.5 w-3.5 text-blue-800 shrink-0" />
                          <span>{eq}</span>
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Legal Certificates Info */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">
                      Legalitas Sanitasi &amp; Pangan:
                    </h4>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center bg-white p-2 rounded border border-slate-200">
                        <span>SLHS Dinkes ({selectedSppg.certificates.slhs.issuer}):</span>
                        <span className="font-mono font-bold text-slate-800">
                          {selectedSppg.certificates.slhs.validUntil}
                        </span>
                      </div>
                      <div className="flex justify-between items-center bg-white p-2 rounded border border-slate-200">
                        <span>Sertifikasi HACCP:</span>
                        <span className="font-mono font-bold text-slate-800">
                          {selectedSppg.certificates.haccp.grade}
                        </span>
                      </div>
                      <div className="flex justify-between items-center bg-white p-2 rounded border border-slate-200">
                        <span>Sertifikat Halal BPJPH:</span>
                        <span className="font-mono font-bold text-slate-800">
                          {selectedSppg.certificates.halal.number}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 2: SCORECARD & SENSOR TELEMETRY */}
              {drawerTab === 'scorecard' && (
                <div className="space-y-4">
                  <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-bold text-slate-700">Rapor Mutu Keseluruhan</span>
                      <span className="text-lg font-black font-mono text-emerald-800">
                        {selectedSppg.scorecard.compositeScore}% ({selectedSppg.scorecard.grade})
                      </span>
                    </div>

                    <div className="space-y-2 pt-2 border-t border-slate-200">
                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-600">1. Skrining Visual AI Kamera (Safety Score):</span>
                          <span className="font-mono font-bold">{selectedSppg.scorecard.safetyScore}%</span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${selectedSppg.scorecard.safetyScore}%` }}
                            className="h-full bg-emerald-500 rounded-full"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-600">2. Kepatuhan Suhu Armada (Cold-Chain Score):</span>
                          <span className="font-mono font-bold">{selectedSppg.scorecard.coldChainScore}%</span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${selectedSppg.scorecard.coldChainScore}%` }}
                            className="h-full bg-blue-600 rounded-full"
                          />
                        </div>
                      </div>

                      <div>
                        <div className="flex justify-between text-xs mb-1">
                          <span className="text-slate-600">3. Ketepatan Waktu Drop &lt;07:30 (Timeliness):</span>
                          <span className="font-mono font-bold">{selectedSppg.scorecard.timelinessScore}%</span>
                        </div>
                        <div className="h-2 bg-slate-200 rounded-full overflow-hidden">
                          <div
                            style={{ width: `${selectedSppg.scorecard.timelinessScore}%` }}
                            className="h-full bg-blue-600 rounded-full"
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* 7 Days History Pills */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">
                      Riwayat Kepatuhan Harian (7 Hari Terakhir):
                    </h4>
                    <div className="grid grid-cols-7 gap-1 text-center font-mono">
                      {selectedSppg.scorecard.compliance7Days.map((val, i) => (
                        <div
                          key={i}
                          className={`p-1.5 rounded-lg border text-[11px] ${
                            val < 85
                              ? 'bg-rose-50 border-rose-300 text-rose-700 font-bold'
                              : 'bg-white border-slate-200 text-slate-800'
                          }`}
                        >
                          <span className="text-[11px] text-slate-500 block">H-{7 - i}</span>
                          <span className="font-bold">{val}%</span>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Pathogen Microbiology Result */}
                  <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2">
                    <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">
                      Hasil Uji Laboratorium Patogen &amp; Mikrobiologi:
                    </h4>
                    <div className="space-y-1.5">
                      <div className="flex justify-between items-center bg-white p-2 rounded border border-slate-200">
                        <span>Salmonella sp. (25g):</span>
                        <span
                          className={`font-mono font-bold ${
                            selectedSppg.pathogenAudit.salmonella.includes('Negatif')
                              ? 'text-emerald-700'
                              : 'text-rose-800'
                          }`}
                        >
                          {selectedSppg.pathogenAudit.salmonella}
                        </span>
                      </div>
                      <div className="flex justify-between items-center bg-white p-2 rounded border border-slate-200">
                        <span>Escherichia coli:</span>
                        <span className="font-mono font-bold text-slate-800">
                          {selectedSppg.pathogenAudit.ecoli}
                        </span>
                      </div>
                      <div className="flex justify-between items-center bg-white p-2 rounded border border-slate-200 text-[11px] text-slate-500">
                        <span>Laboratorium Penguji:</span>
                        <span>{selectedSppg.pathogenAudit.laboratory}</span>
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {/* TAB 3: ASSIGNED SCHOOLS */}
              {drawerTab === 'schools' && (
                <div className="space-y-2.5">
                  <p className="text-slate-500 text-xs">
                    Daftar sekolah yang menjadi tanggung jawab suplai harian:
                  </p>
                  {selectedSppg.assignedSchools.map((sch, i) => (
                    <div key={i} className="p-3 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center">
                      <div>
                        <p className="font-bold text-slate-900">{sch.name}</p>
                        <p className="text-[11px] text-slate-500">
                          Jarak {sch.distanceKm} km (~{sch.estMinutes} menit) &bull; Target tiba {sch.dropTargetTime}
                        </p>
                        <p className="text-[11px] text-slate-500 mt-0.5">Kontak: {sch.contactPerson}</p>
                      </div>
                      <div className="text-right">
                        <span className="font-mono font-bold text-blue-800 text-sm">
                          {sch.portions.toLocaleString()}
                        </span>
                        <span className="text-[11px] text-slate-500 block">Porsi</span>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* TAB 4: RECIPE TKPI */}
              {drawerTab === 'recipe' && (
                <div className="space-y-3">
                  <div className="p-3 bg-slate-50 rounded-xl border border-slate-200">
                    <span className="text-[11px] text-slate-500 uppercase font-bold">Menu Aktif:</span>
                    <p className="font-bold text-slate-900 mt-0.5">{selectedSppg.recipeAudit.menuToday}</p>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden">
                    <table className="w-full text-xs text-left">
                      <thead className="bg-slate-50 text-[10px] font-bold uppercase text-slate-500 border-b border-slate-200">
                        <tr>
                          <th className="py-2 px-3 text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Komponen</th>
                          <th className="py-2 px-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Target</th>
                          <th className="py-2 px-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Realisasi</th>
                          <th className="py-2 px-3 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500 whitespace-nowrap">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {selectedSppg.recipeAudit.items.map((it, idx) => (
                          <tr key={idx}>
                            <td className="py-2 px-3 font-medium text-slate-800">{it.name}</td>
                            <td className="py-2 px-3 text-right font-mono text-slate-500">{it.targetGram}g</td>
                            <td className="py-2 px-3 text-right font-mono font-bold text-slate-900">{it.actualGram}g</td>
                            <td className="py-2 px-3 text-center">
                              <span
                                className={`px-1.5 py-0.2 rounded text-[10px] font-bold ${
                                  it.status === 'optimal'
                                    ? 'bg-emerald-50 text-emerald-700'
                                    : 'bg-rose-50 text-rose-700'
                                }`}
                              >
                                {it.status}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <button
                    onClick={() => handleOpenRecipeAudit(selectedSppg)}
                    className="w-full py-2 bg-blue-50 text-blue-700 rounded-xl font-bold text-xs border border-blue-200 hover:bg-blue-100 transition"
                  >
                    Buka Rincian Lengkap Audit Gramatur TKPI
                  </button>
                </div>
              )}

              {/* TAB 5: DISCIPLINARY LOGS & RECENT DISPATCH */}
              {drawerTab === 'logs' && (
                <div className="space-y-4">
                  {/* Warning Letters History */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">
                      Arsip Surat Peringatan &amp; Sanksi:
                    </h4>
                    {selectedSppg.warningLetters && selectedSppg.warningLetters.length > 0 ? (
                      selectedSppg.warningLetters.map((w, idx) => (
                        <div key={idx} className="p-3 bg-amber-50 rounded-xl border border-amber-200 text-xs space-y-1">
                          <div className="flex justify-between font-bold text-amber-900">
                            <span>{w.type}</span>
                            <span className="font-mono text-[10px]">{w.issuedDate}</span>
                          </div>
                          <p className="text-slate-600 text-[11px] leading-relaxed">{w.reason}</p>
                          <p className="text-[10px] font-mono text-amber-800 pt-1 border-t border-amber-200/60">
                            No. Dokumen: {w.letterNumber}
                          </p>
                        </div>
                      ))
                    ) : (
                      <p className="text-slate-500 text-xs italic">Tidak ada catatan surat peringatan aktif.</p>
                    )}
                  </div>

                  {/* Dispatch Logs */}
                  <div className="space-y-2">
                    <h4 className="font-bold text-slate-900 uppercase text-[10px] tracking-wider">
                      Log Keberangkatan Armada Terakhir:
                    </h4>
                    {selectedSppg.recentDispatchLogs && selectedSppg.recentDispatchLogs.map((log, idx) => (
                      <div key={idx} className="p-2.5 bg-slate-50 rounded-xl border border-slate-200 flex justify-between items-center text-xs">
                        <div>
                          <p className="font-bold text-slate-800">{log.armada}</p>
                          <p className="text-[11px] text-slate-500">{log.route} &bull; Suhu: {log.temp}</p>
                        </div>
                        <span className="font-mono text-[10px] font-bold text-emerald-700">
                          {log.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Drawer Bottom Actions */}
            <div className="p-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between gap-2 shrink-0">
              <div className="flex items-center gap-1.5">
                <button
                  onClick={() => handleOpenWarningModal(selectedSppg)}
                  className="px-3 py-1.5 rounded-xl border border-amber-300 bg-amber-50 hover:bg-amber-100 text-amber-800 font-bold text-xs transition"
                >
                  Terbitkan SP
                </button>
                <button
                  onClick={() => handleOpenQuotaModal(selectedSppg)}
                  className="px-3 py-1.5 rounded-xl border border-slate-300 bg-slate-100 hover:bg-blue-50 text-slate-800 font-bold text-xs transition"
                >
                  Ubah Kuota
                </button>
                {canManageAccounts && (
                  <button
                    onClick={() => setAccountModalSppg(selectedSppg)}
                    className="px-3 py-1.5 rounded-xl border border-blue-300 bg-blue-50 hover:bg-blue-100 text-blue-800 font-bold text-xs transition cursor-pointer"
                  >
                    Kelola Akun
                  </button>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                {selectedSppg.status === 'suspended' ? (
                  <button
                    onClick={() => handleOpenReinstateModal(selectedSppg)}
                    className="px-3 py-1.5 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition cursor-pointer"
                  >
                    Pulihkan Izin (Reaktivasi)
                  </button>
                ) : (
                  <button
                    onClick={() => handleOpenSuspensionModal(selectedSppg)}
                    className="px-3 py-1.5 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition cursor-pointer"
                  >
                    Bekukan Izin
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          MODAL REINSTATEMENT: PEMULIHAN IZIN DISTRIBUSI DAPUR
          ==================================================================== */}
      {reinstateModalData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs animate-in fade-in">
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-2xl border border-slate-200 p-6 space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-start justify-between pb-3 border-b border-slate-100">
              <div>
                <span className="px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 text-[10px] font-mono font-bold">
                  REAKTIVASI / PEMULIHAN OPERASIONAL
                </span>
                <h3 className="text-lg font-black text-slate-900 tracking-tight mt-1">
                  Pulihkan Hak Masak &amp; Distribusi
                </h3>
                <p className="text-xs text-slate-500">
                  Dapur: <strong className="text-slate-900">{reinstateModalData.sppg.name}</strong> ({reinstateModalData.sppg.code})
                </p>
              </div>
              <button
                onClick={() => setReinstateModalData(null)}
                className="text-slate-500 hover:text-slate-700 p-1 rounded-lg"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div className="p-3 bg-emerald-50 rounded-xl border border-emerald-200 text-emerald-900 leading-relaxed">
                Tindakan ini akan mengaktifkan kembali dapur SPPG dari status <strong>DIBEKUKAN</strong> menjadi <strong>AKTIF</strong>, serta membuka kembali izin distribusi porsi ke sekolah binaan.
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Alokasi Kuota Pemulihan Awal (Porsi/Hari):
                </label>
                <input
                  type="number"
                  min="500"
                  max={reinstateModalData.sppg.capacity?.maxDailyPortions || 3500}
                  value={reinstateModalData.initialQuota}
                  onChange={(e) =>
                    setReinstateModalData({ ...reinstateModalData, initialQuota: parseInt(e.target.value, 10) || 0 })
                  }
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 font-mono focus:ring-2 focus:ring-emerald-500"
                />
                <p className="text-[10px] text-slate-500 mt-1">
                  Maksimum kapasitas peralatan dapur: {reinstateModalData.sppg.capacity?.maxDailyPortions?.toLocaleString()} porsi.
                </p>
              </div>

              <div>
                <label className="block font-bold text-slate-700 mb-1">
                  Dasar Hukum / Catatan Hasil Audit Pemulihan (min. 20 karakter):
                </label>
                <textarea
                  rows="3"
                  value={reinstateModalData.reason}
                  onChange={(e) => setReinstateModalData({ ...reinstateModalData, reason: e.target.value })}
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl p-2.5 text-xs text-slate-800 focus:ring-2 focus:ring-emerald-500"
                  placeholder="Jelaskan hasil verifikasi laboratorium, sterilisasi sarana, atau pembaruan armada..."
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2.5 pt-2">
              <button
                onClick={() => setReinstateModalData(null)}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-white text-slate-700 font-semibold text-xs hover:bg-slate-50 transition"
              >
                Batal
              </button>
              <button
                onClick={executeReinstate}
                className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs transition flex items-center gap-1.5 shadow-sm"
              >
                <CheckCircle2 className="h-4 w-4" />
                <span>Sah Reaktivasi Dapur</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ====================================================================
          DROPDOWN AKSI BARIS (MELAYANG) — dirender fixed agar tak terpotong
          oleh wadah tabel ber-overflow.
          ==================================================================== */}
      {menuSppg && openMenu && (
        <div
          ref={dropdownRef}
          style={{ position: 'fixed', top: openMenu.top, left: openMenu.left }}
          className="w-56 bg-white rounded-lg shadow-lg border border-slate-200 py-1 z-50 text-xs"
        >
          <div className="px-3 py-1.5 text-[11px] font-semibold text-slate-500 border-b border-slate-100">
            Tindakan untuk {menuSppg.code}
          </div>
          <button
            onClick={() => handleOpenWarningModal(menuSppg)}
            className="w-full text-left px-3 py-2 flex items-center gap-2 text-amber-800 hover:bg-amber-50 font-medium transition cursor-pointer"
          >
            <AlertTriangle className="h-3.5 w-3.5" />
            <span>Terbitkan Surat Peringatan</span>
          </button>
          <button
            onClick={() => handleOpenRecipeAudit(menuSppg)}
            className="w-full text-left px-3 py-2 flex items-center gap-2 text-slate-700 hover:bg-slate-50 font-medium transition cursor-pointer"
          >
            <Scale className="h-3.5 w-3.5 text-blue-800" />
            <span>Audit Gramatur Resep (TKPI)</span>
          </button>
          <button
            onClick={() => handleOpenQuotaModal(menuSppg)}
            className="w-full text-left px-3 py-2 flex items-center gap-2 text-slate-700 hover:bg-slate-50 font-medium transition cursor-pointer"
          >
            <Sliders className="h-3.5 w-3.5 text-blue-800" />
            <span>Tetapkan Alokasi Kuota</span>
          </button>
          <button
            onClick={() => {
              setSchoolsModalData({ sppg: menuSppg })
              setOpenMenu(null)
            }}
            className="w-full text-left px-3 py-2 flex items-center gap-2 text-slate-700 hover:bg-slate-50 font-medium transition cursor-pointer"
          >
            <Building2 className="h-3.5 w-3.5 text-blue-800" />
            <span>Daftar Sekolah Suplai</span>
          </button>
          {canManageAccounts && (
            <button
              onClick={() => {
                setAccountModalSppg(menuSppg)
                setOpenMenu(null)
              }}
              className="w-full text-left px-3 py-2 flex items-center gap-2 text-slate-700 hover:bg-slate-50 font-medium transition cursor-pointer"
            >
              <UserRound className="h-3.5 w-3.5 text-blue-800" />
              <span>Kelola Akun Login</span>
            </button>
          )}
          <div className="my-1 border-t border-slate-100" />
          {menuSppg.status === 'suspended' ? (
            <button
              onClick={() => handleOpenReinstateModal(menuSppg)}
              className="w-full text-left px-3 py-2 flex items-center gap-2 font-medium text-emerald-700 hover:bg-emerald-50 cursor-pointer transition"
            >
              <CheckCircle2 className="h-3.5 w-3.5" />
              <span>Pulihkan Izin (Reaktivasi)</span>
            </button>
          ) : (
            <button
              onClick={() => handleOpenSuspensionModal(menuSppg)}
              className="w-full text-left px-3 py-2 flex items-center gap-2 font-medium text-rose-800 hover:bg-rose-50 cursor-pointer transition"
            >
              <Lock className="h-3.5 w-3.5" />
              <span>Bekukan Izin Distribusi</span>
            </button>
          )}
        </div>
      )}

      {/* ====================================================================
          MODAL: KELOLA AKUN LOGIN DAPUR SPPG (SUPERADMIN)
          ==================================================================== */}
      {accountModalSppg && (
        <SppgAccountManagerModal
          sppg={accountModalSppg}
          onClose={() => setAccountModalSppg(null)}
          showToast={showToast}
        />
      )}
    </div>
  )
}
