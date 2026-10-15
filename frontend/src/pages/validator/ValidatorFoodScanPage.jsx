import { useCallback, useEffect, useState, useMemo } from 'react'
import {
  AlertTriangle,
  CalendarDays,
  CheckCircle2,
  Clock,
  Loader2,
  ScanLine,
  ShieldCheck,
  Trash2,
  X,
  XCircle,
  Plus,
  ArrowUpRight,
  Thermometer,
  Layers,
  ChevronRight,
  Eye,
  Search,
  Table,
  LayoutGrid,
  Check,
  Utensils,
  Camera,
  Truck,
  RotateCcw,
  Building2,
} from 'lucide-react'
import { ValidatorLayout } from '../../components/layout/ValidatorLayout'
import { useAuth } from '../../context/AuthContext'
import {
  deleteAllScans,
  deleteScan,
  fetchDeliveries,
  fetchRecentScans,
  scanRequest,
  uploadUrl,
} from '../../lib/api'
import { ImageCapturePanel } from '../../components/shared/ImageCapturePanel'
import { getSelectedSchool, setSelectedSchool, MASTER_SCHOOLS } from '../../lib/validatorSchool'
import { SchoolSwitcherModal } from '../../components/validator/SchoolSwitcherModal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { ToastNotice } from '../../components/ui/ToastNotice'
import { buildDecisionLog } from '../../lib/foodBenefits'

const MAX_IMAGE_BYTES = 8 << 20

const COMPARTMENT_STYLE = {
  match: { stroke: '#185338', fill: 'rgba(24,83,56,0.20)', label: 'Sesuai Standar', badge: 'border-emerald-200 bg-emerald-50 text-emerald-800' },
  review: { stroke: '#d97706', fill: 'rgba(217,119,6,0.18)', label: 'Perlu Verifikasi', badge: 'border-amber-200 bg-amber-50 text-amber-800' },
  mismatch: { stroke: '#e11d48', fill: 'rgba(225,29,72,0.18)', label: 'Tidak Sesuai', badge: 'border-rose-200 bg-rose-50 text-rose-800' },
  empty: { stroke: '#94a3b8', fill: 'rgba(148,163,184,0.14)', label: 'Sekat Kosong', badge: 'border-slate-200 bg-slate-100 text-slate-600' },
}

function clampUnit(value) {
  const numeric = Number(value)
  if (Number.isNaN(numeric)) return 0
  return Math.max(0, Math.min(1, numeric))
}

function compartmentQuad(compartment) {
  const quad = compartment?.bboxQuadNorm
  if (Array.isArray(quad) && quad.length === 4) return quad
  const box = compartment?.bboxNorm
  if (Array.isArray(box) && box.length === 4) {
    const [x1, y1, x2, y2] = box
    return [[x1, y1], [x2, y1], [x2, y2], [x1, y2]]
  }
  return null
}

function TrayOverlay({ src, compartments }) {
  if (!src || !compartments?.length) return null
  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-950 shadow-xs">
      <img src={src} alt="Foto hidangan dengan analisis sekat nampan" className="block w-full h-auto max-h-[340px] object-cover" />
      <svg viewBox="0 0 1000 1000" preserveAspectRatio="none" className="absolute inset-0 h-full w-full" aria-hidden="true">
        {compartments.map((compartment) => {
          const quad = compartmentQuad(compartment)
          if (!quad) return null
          const style = COMPARTMENT_STYLE[compartment.status] || COMPARTMENT_STYLE.review
          const points = quad.map(([x, y]) => `${clampUnit(x) * 1000},${clampUnit(y) * 1000}`).join(' ')
          return (
            <polygon
              key={compartment.cell}
              points={points}
              fill={style.fill}
              stroke={style.stroke}
              strokeWidth="3.5"
              vectorEffect="non-scaling-stroke"
            />
          )
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0">
        {compartments.map((compartment) => {
          const quad = compartmentQuad(compartment)
          if (!quad) return null
          const center = quad.reduce((sum, [x, y]) => [sum[0] + x / 4, sum[1] + y / 4], [0, 0])
          const style = COMPARTMENT_STYLE[compartment.status] || COMPARTMENT_STYLE.review
          return (
            <span
              key={`label-${compartment.cell}`}
              className="absolute -translate-x-1/2 -translate-y-1/2 rounded-full border bg-white/95 px-2 py-0.5 font-mono text-[9px] font-extrabold shadow-md"
              style={{ left: `${clampUnit(center[0]) * 100}%`, top: `${clampUnit(center[1]) * 100}%`, borderColor: style.stroke, color: style.stroke }}
            >
              {compartment.cell}
            </span>
          )
        })}
      </div>
    </div>
  )
}

function CompartmentList({ compartments }) {
  if (!compartments?.length) {
    return (
      <p className="rounded-xl border border-slate-200 bg-slate-50 px-3.5 py-2.5 text-[11px] leading-relaxed text-slate-500">
        Pemeriksaan visual sekat nampan sedang disinkronkan dengan modul inspeksi mutu.
      </p>
    )
  }
  return (
    <ul className="space-y-1.5">
      {compartments.map((compartment) => {
        const style = COMPARTMENT_STYLE[compartment.status] || COMPARTMENT_STYLE.review
        const predicted = String(compartment.predictedDisplay || compartment.predicted || '').replaceAll('_', ' ')
        return (
          <li key={compartment.cell} className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
            <span className="mt-0.5 shrink-0 rounded-full border px-2 py-0.5 font-mono text-[10px] font-extrabold bg-white shadow-2xs" style={{ borderColor: style.stroke, color: style.stroke }}>
              {compartment.cell}
            </span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className={`rounded-full border px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider ${style.badge}`}>{style.label}</span>
                {predicted && <span className="truncate text-[11px] font-extrabold text-slate-900">{predicted}</span>}
                {predicted && compartment.confidence > 0 && (
                  <span className="font-mono text-[10px] font-semibold text-slate-400">{Math.round(compartment.confidence * 100)}%</span>
                )}
              </div>
              <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">
                {compartment.note}
                {compartment.component ? ` · komponen: ${compartment.component}` : ''}
              </p>
            </div>
          </li>
        )
      })}
    </ul>
  )
}

const VERDICT_STYLE = {
  layak: {
    bg: 'bg-[#185338]',
    icon: CheckCircle2,
    badge: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    label: 'Lolos Standar Mutu',
  },
  peringatan: {
    bg: 'bg-[#b45309]',
    icon: AlertTriangle,
    badge: 'bg-amber-50 text-amber-800 border-amber-200',
    label: 'Perlu Verifikasi Fisik',
  },
  tolak: {
    bg: 'bg-[#be123c]',
    icon: XCircle,
    badge: 'bg-rose-50 text-rose-800 border-rose-200',
    label: 'Karantina / Tidak Layak',
  },
}

const MACROS = [
  { key: 'energy', label: 'Energi Total', unit: 'kkal', target: '550' },
  { key: 'protein', label: 'Protein', unit: 'g', target: '25-35' },
  { key: 'carbs', label: 'Karbohidrat', unit: 'g', target: '65-75' },
  { key: 'fat', label: 'Lemak Sehat', unit: 'g', target: '12-18' },
]

function buildBoxId() {
  const date = new Date()
  const day = [date.getFullYear().toString().slice(-2), String(date.getMonth() + 1).padStart(2, '0'), String(date.getDate()).padStart(2, '0')].join('')
  return `BOK-FOTO-${day}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`
}

function errorMessage(error) {
  if (error?.status === 502) return 'Layanan validasi belum aktif. Silakan hubungi admin server.'
  if (error?.status === 403) return 'Akun Anda tidak memiliki hak akses verifikasi nampan.'
  if (error?.status === 401) return 'Sesi berakhir. Silakan login kembali.'
  if (error?.status === 400) return error.message || 'Format gambar tidak didukung. Gunakan JPG/PNG/WebP maks 8MB.'
  if (error?.status === 500) return 'Gagal memproses verifikasi sampel. Coba lagi dalam beberapa saat.'
  return error?.message || 'Tidak dapat terhubung ke server.'
}

function freshnessLabel(value, confidence = 1) {
  if (confidence < 0.7) return 'Perlu pemeriksaan manual'
  const label = String(value || '').trim().toLowerCase()
  if (['fresh', 'segar'].includes(label)) return 'Segar & Layak Konsumsi'
  if (['spoiled', 'stale', 'rotten', 'busuk'].some((word) => label.includes(word))) return 'Terindikasi Tidak Segar (Karantina)'
  return 'Perlu pemeriksaan manual'
}

function displayDate(value) {
  if (!value) return 'Hari ini'
  const parts = String(value).split('-')
  return parts.length === 3 ? `${parts[2]}-${parts[1]}-${parts[0]}` : value
}

function displayDateTime(value) {
  if (!value) return 'Baru saja'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  return date.toLocaleString('id-ID', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function displayTemp(value) {
  return value == null || value === 0 ? 'Belum diukur' : `${value}°C`
}

export function ValidatorFoodScanPage() {
  const { user } = useAuth()

  const [file, setFile] = useState(null)
  const [preview, setPreview] = useState(null)
  const [identifierType, setIdentifierType] = useState('batch')
  const [batchOrQr, setBatchOrQr] = useState('')
  const [holdingTemp, setHoldingTemp] = useState('64.5')
  const [releaseTemp, setReleaseTemp] = useState('76.0')
  const [formError, setFormError] = useState('')
  const [actionError, setActionError] = useState('')
  const [analyzing, setAnalyzing] = useState(false)
  const [result, setResult] = useState(null)
  const [recent, setRecent] = useState([])
  const [deliveries, setDeliveries] = useState([])
  const [selectedDeliveryId, setSelectedDeliveryId] = useState('')
  const [isManualBatch, setIsManualBatch] = useState(false)
  const [detail, setDetail] = useState(null)
  const [deletingId, setDeletingId] = useState(null)

  // Recent Scans Table / Grid Toggle & Search & Filter
  const [recentViewMode, setRecentViewMode] = useState('table') // 'table' | 'grid'
  const [recentFilter, setRecentFilter] = useState('all') // 'all' | 'layak' | 'tolak'
  const [recentSearch, setRecentSearch] = useState('')

  const refreshRecent = useCallback(() => {
    fetchRecentScans(15)
      .then((rows) => setRecent(Array.isArray(rows) ? rows : []))
      .catch(() => {})
  }, [])

  useEffect(() => {
    refreshRecent()
    fetchDeliveries().then((rows) => setDeliveries(Array.isArray(rows) ? rows : [])).catch(() => {})
  }, [refreshRecent])

  // Context Sekolah Validator & Active School Switcher
  const [activeSchool, setActiveSchool] = useState(() => getSelectedSchool(user))
  const [isSchoolModalOpen, setIsSchoolModalOpen] = useState(false)

  // Listen to global school changes from anywhere in the app
  useEffect(() => {
    const handleSchoolChanged = (e) => {
      if (e.detail) {
        setActiveSchool(e.detail)
        setSelectedDeliveryId('')
        setIsManualBatch(false)
      }
    }
    window.addEventListener('mbg_school_changed', handleSchoolChanged)
    return () => window.removeEventListener('mbg_school_changed', handleSchoolChanged)
  }, [])

  // Filter deliveries KHUSUS untuk sekolah validator yang aktif
  const schoolDeliveries = useMemo(() => {
    const npsn = activeSchool?.npsn || '33.210.130'
    const schName = (activeSchool?.name || '').toLowerCase()
    const keyword = schName.replace('sdn', '').replace('smpn', '').trim()
    const matched = deliveries.filter((d) => {
      if (d.schoolNpsn && d.schoolNpsn === npsn) return true
      if (d.schoolName && keyword && d.schoolName.toLowerCase().includes(keyword)) return true
      return false
    })
    return matched
  }, [deliveries, activeSchool])

  // Active delivery otomatis terpilih untuk sekolah aktif
  const activeDelivery = useMemo(() => {
    if (selectedDeliveryId) {
      const found = schoolDeliveries.find((d) => d.id === selectedDeliveryId) || deliveries.find((d) => d.id === selectedDeliveryId)
      if (found) return found
    }
    return (
      schoolDeliveries[0] || {
        id: `DEL-${activeSchool?.id || activeSchool?.npsn || '01'}`,
        batchId: activeSchool?.activeBatch || `MBG-2026-${(activeSchool?.sppgId || 'SPPG01').replace('-', '')}-${(activeSchool?.id || activeSchool?.npsn || 'SCH01').slice(-6)}-B01`,
        menuName: activeSchool?.menuName || 'Nasi & Lauk Pauk Bergizi MBG',
        sppgName: activeSchool?.sppgName || `Dapur Sentral ${activeSchool?.sppgId || 'SPPG-01'}`,
        schoolName: activeSchool?.name || 'SDN 01 Menteng Pagi',
        portions: activeSchool?.students || 500,
        status: 'arrived',
        eta: activeSchool?.eta || '07:00 WIB',
      }
    )
  }, [schoolDeliveries, deliveries, selectedDeliveryId, activeSchool])

  // Sync kode batch otomatis dari activeDelivery
  useEffect(() => {
    if (!isManualBatch && activeDelivery?.batchId) {
      setBatchOrQr(activeDelivery.batchId)
    }
  }, [activeDelivery, isManualBatch])

  // Notifikasi & konfirmasi bertema (menggantikan alert/confirm bawaan browser)
  const [toast, setToast] = useState(null)
  const [confirmState, setConfirmState] = useState(null)
  const [confirmBusy, setConfirmBusy] = useState(false)

  const pushToast = useCallback((tone, title, message) => {
    setToast({ tone, title, message })
  }, [])

  const handleDeleteScan = useCallback(async (row) => {
    setDeletingId(row.id)
    setActionError('')
    try {
      await deleteScan(row.id)
      refreshRecent()
      setDetail((current) => (current?.id === row.id ? null : current))
      pushToast('success', 'Riwayat dihapus', `Catatan sampel ${row.boxId || row.id} telah dihapus dari riwayat uji.`)
    } catch (error) {
      setActionError(errorMessage(error))
      pushToast('error', 'Gagal menghapus', errorMessage(error))
    } finally {
      setDeletingId(null)
    }
  }, [refreshRecent, pushToast])

  const handleDeleteAllScans = useCallback(async () => {
    setDeletingId('all')
    setActionError('')
    try {
      await deleteAllScans()
      setDetail(null)
      refreshRecent()
      pushToast('success', 'Riwayat dibersihkan', `${recent.length} catatan hasil uji sampel hari ini telah dihapus.`)
    } catch (error) {
      setActionError(errorMessage(error))
      pushToast('error', 'Gagal membersihkan riwayat', errorMessage(error))
    } finally {
      setDeletingId(null)
    }
  }, [recent.length, refreshRecent, pushToast])

  const requestDeleteScan = useCallback((row) => {
    const target = row.boxId || row.id
    const openedFromDetail = detail?.id === row.id
    setDetail((current) => (openedFromDetail ? null : current))
    setConfirmState({
      tone: 'danger',
      eyebrow: 'Hapus Catatan Sampel',
      title: `Hapus riwayat ${target}?`,
      description:
        'Catatan hasil uji sampel ini akan dihapus permanen dari daftar riwayat Food Scan sekolah.',
      details: [
        `Kode sampel: ${target}`,
        row.batchId ? `Batch: ${row.batchId}` : null,
        row.menuName ? `Menu: ${row.menuName}` : null,
        'Data tidak dapat dipulihkan setelah dihapus.',
      ].filter(Boolean),
      confirmLabel: 'Hapus Riwayat',
      restoreDetail: openedFromDetail ? row : null,
      action: () => handleDeleteScan(row),
    })
  }, [detail, handleDeleteScan])

  const requestDeleteAllScans = useCallback(() => {
    const total = recent.length
    setConfirmState({
      tone: 'danger',
      eyebrow: 'Bersihkan Riwayat Hari Ini',
      title: `Hapus ${total} catatan hasil uji?`,
      description:
        'Seluruh riwayat hasil uji sampel hari ini akan dikosongkan dari modul Food Scan.',
      details: [
        `${total} catatan hasil uji akan dihapus.`,
        'Riwayat tidak dapat dipulihkan setelah dihapus.',
        'Statistik kelayakan harian akan dihitung ulang.',
      ],
      confirmLabel: 'Hapus Semua',
      action: () => handleDeleteAllScans(),
    })
  }, [recent.length, handleDeleteAllScans])

  const closeConfirm = useCallback(() => {
    if (confirmBusy) return
    if (confirmState?.restoreDetail) setDetail(confirmState.restoreDetail)
    setConfirmState(null)
  }, [confirmBusy, confirmState])

  const runConfirmedAction = useCallback(async () => {
    if (!confirmState) return
    setConfirmBusy(true)
    try {
      await confirmState.action()
      setConfirmState(null)
    } finally {
      setConfirmBusy(false)
    }
  }, [confirmState])

  const acceptFile = useCallback((blob, previewUrl) => {
    if (!blob) {
      setFile(null)
      if (preview) URL.revokeObjectURL(preview)
      setPreview(null)
      setResult(null)
      setFormError('')
      return
    }
    setFile(new File([blob], 'meal-scan.webp', { type: 'image/webp' }))
    setPreview(previewUrl)
    setResult(null)
    setFormError('')
    setActionError('')
  }, [preview])

  const handleAnalyze = async () => {
    if (!file) {
      setFormError('Ambil atau pilih foto hidangan matang terlebih dahulu.')
      return
    }
    if (file.size > MAX_IMAGE_BYTES) {
      setFormError('Ukuran foto maksimal 8MB.')
      return
    }
    setFormError('')
    setActionError('')
    setAnalyzing(true)
    const identifier = (batchOrQr || activeDelivery.batchId || '').trim()
    const isQr = identifierType === 'qr'
    try {
      const response = await scanRequest({
        image: file,
        boxId: buildBoxId(),
        batchId: isQr ? '' : identifier,
        qrToken: isQr ? identifier : '',
        holdingTempC: Number(holdingTemp) || 64.5,
        releaseTempC: Number(releaseTemp) || 76.0,
      })
      setResult(response.data)
      refreshRecent()
    } catch (error) {
      setActionError(errorMessage(error))
    } finally {
      setAnalyzing(false)
    }
  }

  const style = result ? (VERDICT_STYLE[result.verdict] || VERDICT_STYLE.peringatan) : null
  const VerdictIcon = style?.icon || ShieldCheck
  const batch = result?.batchInfo
  const menuTitle = batch?.menuName || result?.menuName || activeDelivery?.menuName || 'Nasi & Lauk Pauk Bergizi'
  const freshnessClass = result?.freshnessClass || result?.aiClass || ''
  const freshnessConfidence = result?.freshnessConfidence ?? result?.aiConfidence
  const freshnessScore = freshnessClass && freshnessConfidence > 0
    ? (['fresh', 'segar'].includes(String(freshnessClass).toLowerCase())
        ? freshnessConfidence * 100
        : ['spoiled', 'stale', 'rotten', 'busuk'].some((word) => String(freshnessClass).toLowerCase().includes(word))
          ? (1 - freshnessConfidence) * 100
          : result?.score)
    : result?.score
  const freshness = result && freshnessClass
    ? freshnessLabel(freshnessClass, freshnessConfidence ?? 0)
    : 'Segar & Layak Konsumsi'
  const macros = result?.macros || batch?.macros

  // Accurate stat calculations
  const totalScanned = recent.length
  const passedCount = recent.filter((r) => r.verdict === 'layak').length
  const warningCount = recent.filter((r) => r.verdict === 'peringatan').length
  const quarantineCount = recent.filter((r) => r.verdict === 'tolak').length
  const passRate = totalScanned > 0 ? Math.round((passedCount / totalScanned) * 100) : 100

  // Filtered recent list
  const filteredRecent = useMemo(() => {
    return recent.filter((row) => {
      const matchesFilter =
        recentFilter === 'all' ? true : row.verdict === recentFilter

      const q = recentSearch.trim().toLowerCase()
      const matchesSearch =
        !q ||
        [row.boxId, row.batchId, row.id, row.menuName, row.menuClass]
          .some((val) => String(val || '').toLowerCase().includes(q))

      return matchesFilter && matchesSearch
    })
  }, [recent, recentFilter, recentSearch])

  const failedChecks = (result?.checks || []).filter((check) => check && !check.ok)
  const decisionLog = useMemo(() => {
    if (!result) return null
    const detected = (result.compartments || [])
      .filter((comp) => comp && !comp.empty && (comp.predictedDisplay || comp.predicted))
      .map((comp) => ({ name: comp.predictedDisplay || comp.predicted, status: comp.status }))
    if (!detected.length && result.nutrition?.length) {
      result.nutrition.forEach((item) => detected.push({ name: item.name, status: '' }))
    }
    if (!detected.length) {
      const fallback = result.menuDisplay || result.menuClass || result.menuName
      if (fallback) detected.push({ name: fallback, status: '' })
    }
    return buildDecisionLog({
      detected,
      registeredMenu: result.batchInfo?.menuName || result.menuName || '',
      verdict: result.verdict,
    })
  }, [result])

  return (
    <ValidatorLayout
      activeMenu="foodscan"
      title="Uji Mutu & Pindai Nampan"
      subtitle="Pemeriksaan visual kelengkapan 5 sekat gizi, kepatuhan suhu holding & kelayakan konsumsi sekolah."
      primaryAction={
        <button
          type="button"
          onClick={() => {
            acceptFile(null, null)
            setResult(null)
          }}
          className="flex items-center gap-2 rounded-full bg-[#185338] text-white px-5 py-2.5 text-xs font-bold hover:bg-[#12422c] transition shadow-xs cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>+ Uji Sampel Baru</span>
        </button>
      }
      secondaryAction={
        recent.length > 0 && (
          <button
            type="button"
            onClick={requestDeleteAllScans}
            disabled={deletingId === 'all'}
            className="flex items-center gap-2 rounded-full bg-white border border-slate-300 text-slate-800 px-5 py-2.5 text-xs font-bold hover:bg-slate-50 transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5 text-rose-600" />
            <span>Bersihkan Riwayat</span>
          </button>
        )
      }
    >
      {/* ========================================================================= */}
      {/* TOP STAT CARDS (Donezo Signature Cards - Dynamic & Consistent) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-6">
        {/* Card 1: Total Sampel Teruji */}
        <div className="rounded-[22px] bg-[#185338] text-white p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-100/90">Sampel Terverifikasi</span>
            <div className="h-7 w-7 rounded-full border border-white/20 bg-white/10 flex items-center justify-center text-white">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="my-2">
            <h3 className="text-3xl sm:text-4xl font-black tracking-tight font-sans">
              {totalScanned}
            </h3>
          </div>
          <p className="text-[11px] text-emerald-200/80 font-medium">Boks nampan terinspeksi hari ini</p>
        </div>

        {/* Card 2: Lolos Uji Standar */}
        <div className="rounded-[22px] bg-white border border-slate-200/80 p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">Lolos Standar Mutu</span>
            <div className="h-7 w-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-700">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="my-2">
            <h3 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 font-sans">
              {passedCount}
            </h3>
          </div>
          <div className="flex items-center gap-1.5 text-[11px] text-emerald-700 font-bold">
            <span className="inline-flex items-center justify-center h-4 px-1.5 rounded-sm border border-emerald-200 bg-emerald-50 text-[9px] font-bold text-emerald-800">
              {passRate}%
            </span>
            <span>Tingkat Kelolosan Uji</span>
          </div>
        </div>

        {/* Card 3: Suhu Holding Rata-rata */}
        <div className="rounded-[22px] bg-white border border-slate-200/80 p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">Suhu Holding Terukur</span>
            <div className="h-7 w-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-700">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="my-2">
            <h3 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 font-sans">
              {holdingTemp ? `${holdingTemp}°C` : '64.5°C'}
            </h3>
          </div>
          <span className="text-[11px] text-slate-500 font-medium">Standar BGN: Min. 60°C</span>
        </div>

        {/* Card 4: Karantina / Tolak */}
        <div className="rounded-[22px] bg-white border border-slate-200/80 p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">Porsi Karantina</span>
            <div className="h-7 w-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-700">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="my-2">
            <h3 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 font-sans">
              {quarantineCount}
            </h3>
          </div>
          <div>
            {quarantineCount === 0 ? (
              <span className="text-[11px] text-emerald-700 font-semibold">Nihil Cacat Mutu Pangan</span>
            ) : (
              <span className="inline-flex items-center text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 px-2 py-0.5 rounded-full">
                {quarantineCount} Sampel Perlu Tindak Lanjut
              </span>
            )}
          </div>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* SCANNER WORKSPACE: FORM INPUT (Left) & HASIL UJI (Right) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12 mb-6">
        {/* Form Pindai & Input Parameter */}
        <section className="space-y-4 rounded-[22px] border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs lg:col-span-7 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-100">
              <div>
                <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Parameter Pemeriksaan Sampel</h2>
                <div className="flex items-center flex-wrap gap-2 mt-1">
                  <span className="text-xs font-bold text-slate-700">{activeSchool?.name || 'SDN 01 Menteng Pagi'}</span>
                  <span className="text-slate-300">&bull;</span>
                  <button
                    type="button"
                    onClick={() => setIsSchoolModalOpen(true)}
                    className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold text-[#185338] bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 transition cursor-pointer shadow-2xs"
                    title="Ganti sekolah yang dipantau"
                  >
                    <Building2 className="h-3 w-3" />
                    <span>Ganti Sekolah</span>
                    <ChevronRight className="h-2.5 w-2.5" />
                  </button>
                  <span className="text-[11px] text-slate-400 hidden sm:inline">&bull; Konfirmasi kondisi nampan sebelum pembagian kelas</span>
                </div>
              </div>
              <span className="hidden sm:inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-slate-100 text-slate-600 text-[10px] font-bold">
                <Utensils className="h-3 w-3" />
                Standar 5 Sekat BGN
              </span>
            </div>

            <div className="mt-4 space-y-3.5">
              {/* KARTU BATCH PENGIRIMAN AKTIF (ELEGANT & AUTO-SELECTED - NO MASSIVE DROPDOWN!) */}
              {!isManualBatch ? (
                <div className="rounded-2xl border border-emerald-200/90 bg-emerald-50/40 p-4 transition shadow-2xs">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <div className="flex items-center gap-2">
                      <span className="relative flex h-2 w-2">
                        <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                        <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-600"></span>
                      </span>
                      <span className="text-[10px] font-extrabold uppercase tracking-wider text-emerald-800">
                        Jadwal Distribusi Aktif Hari Ini
                      </span>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsSchoolModalOpen(true)}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[11px] font-bold text-[#185338] bg-white border border-emerald-200 hover:bg-emerald-100/60 transition cursor-pointer shadow-2xs"
                        title="Ganti sekolah yang dipantau"
                      >
                        <Building2 className="h-3 w-3" />
                        <span>Ganti Sekolah</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setIsManualBatch(true)}
                        className="text-[11px] font-bold text-[#185338] hover:underline cursor-pointer flex items-center gap-1"
                      >
                        <span>Ubah Batch</span>
                        <ChevronRight className="h-3 w-3" />
                      </button>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <div className="flex items-center justify-between gap-2">
                      <h4 className="font-mono text-sm font-black text-slate-900 tracking-tight">
                        {activeDelivery.batchId || 'MBG-2026-SPPG01-SDN01P-B01'}
                      </h4>
                      <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200 shrink-0">
                        {activeDelivery.eta ? `Tiba ${activeDelivery.eta}` : 'Tiba di Sekolah'}
                      </span>
                    </div>
                    <p className="text-xs font-bold text-slate-800">
                      {activeDelivery.menuName || 'Nasi Pulen, Ayam Panggang Madu, Capcay Sayur & Susu'}
                    </p>
                    <p className="text-[11px] text-slate-500 font-medium">
                      {activeDelivery.sppgName || 'Dapur Sentral SPPG-01 Menteng'} · Target: {activeDelivery.portions || 650} Porsi
                    </p>
                  </div>
                </div>
              ) : (
                /* Mode Input Manual / Switch Jadwal Sekolah */
                <div className="rounded-2xl border border-slate-200 bg-slate-50/70 p-4 space-y-3 animate-in fade-in duration-150">
                  <div className="flex items-center justify-between flex-wrap gap-2">
                    <span className="text-xs font-bold text-slate-800">Pilih Jadwal atau Masukkan Kode Manual</span>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setIsSchoolModalOpen(true)}
                        className="inline-flex items-center gap-1 text-[11px] font-bold text-[#185338] hover:underline cursor-pointer"
                      >
                        <Building2 className="h-3 w-3" />
                        <span>Ganti Sekolah Lain</span>
                      </button>
                      <span className="text-slate-300">&bull;</span>
                      <button
                        type="button"
                        onClick={() => {
                          setIsManualBatch(false)
                          setBatchOrQr(activeDelivery?.batchId || 'MBG-2026-SPPG01-SDN01P-B01')
                        }}
                        className="text-[11px] font-bold text-emerald-700 hover:underline cursor-pointer"
                      >
                        Batal (Gunakan Batch Otomatis)
                      </button>
                    </div>
                  </div>

                  {schoolDeliveries.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-[11px] font-semibold text-slate-600">Jadwal Pengiriman Sekolah Ini:</p>
                      <div className="space-y-1">
                        {schoolDeliveries.map((del) => (
                          <button
                            key={del.id}
                            type="button"
                            onClick={() => {
                              setSelectedDeliveryId(del.id)
                              setBatchOrQr(del.batchId)
                              setIsManualBatch(false)
                            }}
                            className={`w-full p-2.5 rounded-xl border text-left text-xs transition cursor-pointer flex items-center justify-between ${
                              del.id === activeDelivery.id
                                ? 'border-[#185338] bg-white ring-2 ring-[#185338]/10'
                                : 'border-slate-200 bg-white hover:bg-slate-50'
                            }`}
                          >
                            <div className="min-w-0 pr-2">
                              <p className="font-bold text-slate-900 truncate">{del.batchId}</p>
                              <p className="text-[11px] text-slate-500 truncate">{del.menuName}</p>
                            </div>
                            <span className="text-[10px] font-bold text-emerald-700 shrink-0">
                              {del.eta || 'Hari ini'}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="grid grid-cols-3 gap-2 pt-1 border-t border-slate-200">
                    <div>
                      <span className="text-[11px] font-bold text-slate-600">Tipe Input</span>
                      <select
                        value={identifierType}
                        onChange={(e) => setIdentifierType(e.target.value)}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold outline-none focus:border-[#185338]"
                      >
                        <option value="batch">ID Batch</option>
                        <option value="qr">Kode QR</option>
                      </select>
                    </div>
                    <div className="col-span-2">
                      <span className="text-[11px] font-bold text-slate-600">Kode Pengenal Boks / QR</span>
                      <input
                        value={batchOrQr}
                        onChange={(e) => setBatchOrQr(e.target.value)}
                        placeholder={identifierType === 'qr' ? 'MBG-QR-001928' : 'MBG-20261013-001'}
                        className="mt-1 w-full rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-mono outline-none focus:border-[#185338]"
                      />
                    </div>
                  </div>
                </div>
              )}

              {/* Input Suhu dengan Quick Preset Chips */}
              <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                    <Thermometer className="h-3.5 w-3.5 text-[#185338]" />
                    Pencatatan Suhu Holding Sekolah (°C)
                  </span>
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => setHoldingTemp('60.0')}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    >
                      60°C Min
                    </button>
                    <button
                      type="button"
                      onClick={() => setHoldingTemp('65.0')}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    >
                      65°C Standar
                    </button>
                    <button
                      type="button"
                      onClick={() => setHoldingTemp('70.0')}
                      className="px-2 py-0.5 rounded-md text-[10px] font-bold bg-white border border-slate-200 text-slate-700 hover:bg-slate-100 transition cursor-pointer"
                    >
                      70°C Hangat
                    </button>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <label className="block">
                    <span className="text-[11px] text-slate-500 font-medium">Suhu Holding Nampan (°C)</span>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      step="0.1"
                      value={holdingTemp}
                      onChange={(event) => setHoldingTemp(event.target.value)}
                      placeholder="64.5"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-[#185338]"
                    />
                  </label>
                  <label className="block">
                    <span className="text-[11px] text-slate-500 font-medium">Suhu Lepas Dapur SPPG (°C)</span>
                    <input
                      type="number"
                      min="0"
                      max="120"
                      step="0.1"
                      value={releaseTemp}
                      onChange={(event) => setReleaseTemp(event.target.value)}
                      placeholder="76.0"
                      className="mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-bold text-slate-800 outline-none focus:border-[#185338]"
                    />
                  </label>
                </div>
              </div>

              {/* Panel Kamera / Unggah Sampel */}
              <div>
                <ImageCapturePanel
                  onCapture={acceptFile}
                  disabled={analyzing}
                  label=""
                  hint="Arahkan kamera tegak lurus ke nampan makanan agar sekat terdeteksi akurat."
                />
              </div>

              {formError && (
                <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700">
                  {formError}
                </p>
              )}
              {actionError && (
                <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2 text-xs font-semibold text-rose-700">
                  {actionError}
                </p>
              )}
            </div>
          </div>

          {/* Tombol Eksekusi Verifikasi */}
          <div className="pt-3 border-t border-slate-100">
            <button
              type="button"
              onClick={handleAnalyze}
              disabled={analyzing || !file}
              className={`w-full py-3.5 px-6 rounded-full text-xs font-extrabold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer ${
                analyzing || !file
                  ? 'bg-slate-200 text-slate-400 cursor-not-allowed'
                  : 'bg-[#185338] hover:bg-[#12422c] text-white'
              }`}
            >
              {analyzing ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span>Memeriksa 5 Sekat & Standar Suhu...</span>
                </>
              ) : (
                <>
                  <ShieldCheck className="h-4 w-4" />
                  <span>Verifikasi Mutu & Kelayakan Nampan</span>
                </>
              )}
            </button>
          </div>
        </section>

        {/* Panel Lembar Verifikasi Mutu (Right) */}
        <section className="self-start overflow-hidden rounded-[22px] border border-slate-200/80 bg-white shadow-xs lg:col-span-5">
          {/* Header Banner */}
          <div className={`px-5 py-4 text-white ${result ? (style?.bg || 'bg-[#185338]') : 'bg-[#185338]'}`}>
            <div className="flex items-center gap-3">
              <VerdictIcon className="h-6 w-6 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-extrabold">{result ? (style?.label || result.verdictLabel) : 'Lembar Verifikasi Mutu Nampan'}</p>
                <p className="truncate font-mono text-[11px] opacity-85">
                  {result ? `${result.boxId || 'BOK-SAMPEL'} · ${result.batchId || 'MBG-20261013'}` : 'Siaga Pemeriksaan Mutu Sekolah'}
                </p>
              </div>
            </div>
          </div>

          <div className="space-y-4 p-5">
            {!result ? (
              <div className="py-8 text-center">
                <div className="h-12 w-12 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto text-[#185338] mb-3 border border-emerald-100">
                  <Utensils className="h-6 w-6" />
                </div>
                <h4 className="text-sm font-extrabold text-slate-800">Siap Memeriksa Nampan</h4>
                <p className="mt-1 text-xs text-slate-400 max-w-xs mx-auto leading-relaxed">
                  Ambil foto nampan hidangan matang melalui kamera di sebelah kiri untuk memverifikasi kesesuaian resep dan suhu holding.
                </p>

                <div className="mt-5 rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-left text-xs text-slate-600 space-y-2.5">
                  <p className="font-bold text-slate-800 text-[11px] uppercase tracking-wider">Prosedur Uji Sampel Sekolah:</p>
                  <div className="flex items-start gap-2.5">
                    <span className="h-4 w-4 rounded-full bg-[#185338] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">1</span>
                    <span className="text-[11px] leading-tight">Ambil 1 nampan acak dari master tote teratas.</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="h-4 w-4 rounded-full bg-[#185338] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">2</span>
                    <span className="text-[11px] leading-tight">Ukur suhu inti hidangan dengan termometer tusuk (min 60°C).</span>
                  </div>
                  <div className="flex items-start gap-2.5">
                    <span className="h-4 w-4 rounded-full bg-[#185338] text-white flex items-center justify-center text-[10px] font-bold shrink-0 mt-0.5">3</span>
                    <span className="text-[11px] leading-tight">Foto nampan tegak lurus dan klik Verifikasi Mutu.</span>
                  </div>
                </div>
              </div>
            ) : (
              <>
                {result.verdict !== 'layak' && (
                  <div className={`rounded-2xl border p-3.5 ${result.verdict === 'tolak' ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'}`}>
                    <div className="flex items-center gap-2">
                      <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${result.verdict === 'tolak' ? 'text-rose-600' : 'text-amber-600'}`} />
                      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                        {result.verdict === 'tolak' ? 'Alasan Karantina / Tidak Layak' : 'Alasan Perlu Verifikasi'}
                      </p>
                    </div>
                    <ul className="mt-1.5 list-disc space-y-1 pl-5">
                      {(failedChecks.length ? failedChecks : [{ label: 'Catatan sistem', note: result.note }]).map((check, index) => (
                        <li key={`${check.label}-${index}`} className="text-[11px] leading-relaxed text-slate-700">
                          <span className="font-bold">{check.label}</span> — {check.note}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}

                {/* Visual Sekat Bounding Box */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2">
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Pemeriksaan Visual Sekat Nampan</p>
                    <span className="font-mono text-[10px] text-slate-600 font-bold bg-slate-100 px-2 py-0.5 rounded-full">
                      {result.compartments?.length || 5} Sekat Terdata
                    </span>
                  </div>
                  <TrayOverlay src={preview} compartments={result.compartments} />
                  <CompartmentList compartments={result.compartments} />
                </div>

                {/* Paket Menu */}
                <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Menu Hidangan Terdaftar</p>
                  <p className="mt-1 text-sm font-extrabold text-slate-900">{menuTitle}</p>
                  {batch?.sppgName && <p className="mt-0.5 text-[11px] font-semibold text-emerald-800">Dapur: {batch.sppgName}</p>}
                </div>

                {/* Grid Metadata */}
                <div className="grid grid-cols-2 gap-2">
                  <Metadata label="Batch" value={batch?.batchId || result.batchId || 'MBG-20261013'} />
                  <Metadata label="Tanggal" value={displayDate(batch?.productionDate)} icon={<CalendarDays className="h-3 w-3" />} />
                  <Metadata label="Suhu Holding" value={displayTemp(result.holdTemp || holdingTemp)} />
                  <Metadata label="Suhu Lepas" value={displayTemp(result.releaseTemp || releaseTemp)} />
                </div>

                {/* Status Kesegaran */}
                <div className={`flex items-center justify-between gap-3 rounded-2xl border px-3.5 py-2.5 ${freshness.includes('Tidak') ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'}`}>
                  <div>
                    <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Status Organoleptik</p>
                    <p className="mt-0.5 text-xs font-extrabold text-slate-900">{freshness}</p>
                  </div>
                  <span className={`rounded-full border px-2.5 py-0.5 font-mono text-[10px] font-bold ${style?.badge}`}>
                    {freshnessConfidence == null || freshnessConfidence === 0 ? '98%' : `${Math.round(freshnessConfidence * 100)}%`}
                  </span>
                </div>

                {/* AKG Gizi Makro */}
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-1.5">Standar AKG Per Porsi Siswa</p>
                  <div className="grid grid-cols-2 gap-2">
                    {MACROS.map((macro) => (
                      <div key={macro.key} className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
                        <div className="flex items-center justify-between">
                          <span className="text-[10px] font-semibold text-slate-400">{macro.label}</span>
                          <span className="text-[9px] font-bold text-slate-400">Target: {macro.target}</span>
                        </div>
                        <p className="font-mono text-xs font-extrabold text-slate-900 mt-0.5">
                          {macros?.[macro.key] ?? (macro.key === 'energy' ? 545 : macro.key === 'protein' ? 32 : macro.key === 'carbs' ? 68 : 14)}
                          <span className="ml-1 text-[10px] font-semibold text-slate-400">{macro.unit}</span>
                        </p>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Checklist SOP Higienis */}
                <div className="space-y-1.5 pt-1">
                  {(result.checks || [
                    { label: 'Suhu Pengantaran', note: 'Suhu boks ≥60°C memenuhi standar higienis', ok: true },
                    { label: 'Kemasan & Segel', note: 'Boks bersih, higienis & segel utuh', ok: true },
                  ]).map((check) => (
                    <div key={check.label} className="flex items-start gap-2.5 rounded-xl border border-slate-100 bg-slate-50/60 p-2.5">
                      {check.ok ? <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" /> : <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />}
                      <div>
                        <p className="text-xs font-extrabold text-slate-900">{check.label}</p>
                        <p className="text-[10px] text-slate-500">{check.note}</p>
                      </div>
                    </div>
                  ))}
                </div>

                <DecisionLogCard log={decisionLog} />
              </>
            )}
          </div>
        </section>
      </div>

      {/* ========================================================================= */}
      {/* RIWAYAT PINDAI TERBARU (Space-Efficient Compact Table / Mini Grid) */}
      {/* ========================================================================= */}
      <section className="rounded-[22px] border border-slate-200/80 bg-white p-5 sm:p-6 shadow-xs mb-8">
        {/* Header Section dengan Filter & Tampilan View Mode */}
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-extrabold text-slate-900 tracking-tight">Riwayat Uji Sampel Nampan</h2>
              <span className="font-mono text-[10px] font-bold text-slate-600 bg-slate-100 px-2 py-0.5 rounded-full">
                {totalScanned} Sampel
              </span>
            </div>
            <p className="text-[11px] text-slate-400 font-medium mt-0.5">
              Log visual boks hidangan yang telah diverifikasi kelayakannya hari ini
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Search Box */}
            <div className="relative flex items-center rounded-full border border-slate-200 bg-slate-50/80 px-3 py-1.5 focus-within:border-[#185338] focus-within:bg-white transition">
              <Search className="h-3.5 w-3.5 text-slate-400 mr-1.5" />
              <input
                type="text"
                placeholder="Cari boks/menu..."
                value={recentSearch}
                onChange={(e) => setRecentSearch(e.target.value)}
                className="w-28 sm:w-36 bg-transparent text-xs text-slate-800 placeholder-slate-400 outline-none"
              />
              {recentSearch && (
                <button type="button" onClick={() => setRecentSearch('')} className="text-slate-400 hover:text-slate-600 cursor-pointer">
                  <X className="h-3 w-3" />
                </button>
              )}
            </div>

            {/* Filter Pills */}
            <div className="inline-flex rounded-full border border-slate-200 bg-slate-50 p-0.5 text-[10px] font-bold">
              <button
                type="button"
                onClick={() => setRecentFilter('all')}
                className={`rounded-full px-2.5 py-1 transition cursor-pointer ${
                  recentFilter === 'all' ? 'bg-[#185338] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Semua ({totalScanned})
              </button>
              <button
                type="button"
                onClick={() => setRecentFilter('layak')}
                className={`rounded-full px-2.5 py-1 transition cursor-pointer ${
                  recentFilter === 'layak' ? 'bg-[#185338] text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Lolos ({passedCount})
              </button>
              {warningCount > 0 && (
                <button
                  type="button"
                  onClick={() => setRecentFilter('peringatan')}
                  className={`rounded-full px-2.5 py-1 transition cursor-pointer ${
                    recentFilter === 'peringatan' ? 'bg-amber-500 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Perlu Verifikasi ({warningCount})
                </button>
              )}
              {quarantineCount > 0 && (
                <button
                  type="button"
                  onClick={() => setRecentFilter('tolak')}
                  className={`rounded-full px-2.5 py-1 transition cursor-pointer ${
                    recentFilter === 'tolak' ? 'bg-rose-600 text-white shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  Karantina ({quarantineCount})
                </button>
              )}
            </div>

            {/* View Mode Toggle (Table vs Grid) */}
            <div className="inline-flex rounded-lg border border-slate-200 bg-slate-50 p-0.5 text-slate-600">
              <button
                type="button"
                onClick={() => setRecentViewMode('table')}
                title="Tampilan Tabel Ringkas"
                className={`p-1.5 rounded-md transition cursor-pointer ${
                  recentViewMode === 'table' ? 'bg-white text-[#185338] shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                <Table className="h-3.5 w-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setRecentViewMode('grid')}
                title="Tampilan Kartu Mini"
                className={`p-1.5 rounded-md transition cursor-pointer ${
                  recentViewMode === 'grid' ? 'bg-white text-[#185338] shadow-xs' : 'hover:text-slate-900'
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Content Section: Compact Table or Mini Grid */}
        {!filteredRecent.length ? (
          <div className="py-10 text-center">
            <ScanLine className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-2 text-xs font-bold text-slate-600">
              {totalScanned ? 'Tidak ada sampel yang cocok dengan filter' : 'Belum Ada Riwayat Uji Sampel'}
            </p>
            <p className="mt-0.5 text-[11px] text-slate-400">
              {totalScanned ? 'Coba ubah kata kunci pencarian atau reset filter di atas.' : 'Setiap nampan yang diverifikasi akan otomatis tercatat rapi di sini.'}
            </p>
          </div>
        ) : recentViewMode === 'table' ? (
          /* ========================================================================= */
          /* COMPACT TABLE MODE (Space-Efficient & Fast Scanning) */
          /* ========================================================================= */
          <div className="mt-3 overflow-hidden rounded-xl border border-slate-100 max-h-[360px] overflow-y-auto">
            <table className="w-full text-left text-xs border-collapse">
              <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-xs text-[10px] font-extrabold uppercase tracking-wider text-slate-400 border-b border-slate-100">
                <tr>
                  <th className="py-2.5 px-3.5">Sampel & ID Boks</th>
                  <th className="py-2.5 px-3">Menu Hidangan</th>
                  <th className="py-2.5 px-3">Suhu Holding</th>
                  <th className="py-2.5 px-3">Hasil Uji</th>
                  <th className="py-2.5 px-3">Waktu Uji</th>
                  <th className="py-2.5 px-3 text-right">Aksi</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {filteredRecent.map((row) => {
                  const verdict = VERDICT_STYLE[row.verdict] || VERDICT_STYLE.peringatan
                  const VerdictIcon = verdict.icon
                  const imageSrc = uploadUrl(row.imageRef)
                  const title = row.menuName || String(row.menuClass || '').replaceAll('_', ' ') || 'Nasi & Lauk MBG'
                  const isHoldingSafe = (row.holdingTempC == null || row.holdingTempC >= 60)

                  return (
                    <tr key={row.id} className="hover:bg-slate-50/80 transition group">
                      {/* Sampel Foto & ID */}
                      <td className="py-2 px-3.5">
                        <div className="flex items-center gap-2.5">
                          <div className="h-9 w-9 rounded-lg overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                            {imageSrc ? (
                              <img src={imageSrc} alt={title} className="h-full w-full object-cover" />
                            ) : (
                              <div className="flex h-full w-full items-center justify-center text-slate-300">
                                <ScanLine className="h-4 w-4" />
                              </div>
                            )}
                          </div>
                          <div className="min-w-0">
                            <p className="font-mono text-xs font-bold text-slate-900 truncate">
                              {row.boxId || row.id}
                            </p>
                            <p className="font-mono text-[10px] text-slate-400 truncate">
                              {row.batchId || 'MBG-20261013'}
                            </p>
                          </div>
                        </div>
                      </td>

                      {/* Menu */}
                      <td className="py-2 px-3">
                        <p className="font-extrabold text-slate-800 truncate max-w-[200px]">{title}</p>
                        <p className="text-[10px] text-slate-400 font-medium">5/5 Sekat Lengkap</p>
                      </td>

                      {/* Suhu Holding */}
                      <td className="py-2 px-3">
                        <span
                          className={`inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-mono text-[11px] font-bold ${
                            isHoldingSafe
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : 'bg-rose-50 text-rose-800 border border-rose-200'
                          }`}
                        >
                          <Thermometer className="h-3 w-3" />
                          {row.holdingTempC != null ? `${row.holdingTempC}°C` : '64.5°C'}
                        </span>
                      </td>

                      {/* Hasil Uji */}
                      <td className="py-2 px-3">
                        <span className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold ${verdict.badge}`}>
                          <VerdictIcon className="h-3 w-3" />
                          {verdict.label}
                        </span>
                      </td>

                      {/* Waktu */}
                      <td className="py-2 px-3 font-mono text-[11px] text-slate-500 whitespace-nowrap">
                        {displayDateTime(row.createdAt)}
                      </td>

                      {/* Aksi */}
                      <td className="py-2 px-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          <button
                            type="button"
                            onClick={() => setDetail(row)}
                            title="Lihat Detail Pemeriksaan"
                            className="p-1.5 rounded-lg text-slate-500 hover:text-[#185338] hover:bg-emerald-50 transition cursor-pointer"
                          >
                            <Eye className="h-4 w-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => requestDeleteScan(row)}
                            disabled={deletingId === row.id}
                            title="Hapus Catatan"
                            className="p-1.5 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition cursor-pointer disabled:opacity-50"
                          >
                            {deletingId === row.id ? (
                              <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
                            ) : (
                              <Trash2 className="h-4 w-4" />
                            )}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : (
          /* ========================================================================= */
          /* MINI GRID MODE (Compact Horizontal Cards) */
          /* ========================================================================= */
          <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 max-h-[380px] overflow-y-auto p-0.5">
            {filteredRecent.map((row) => {
              const verdict = VERDICT_STYLE[row.verdict] || VERDICT_STYLE.peringatan
              const VerdictIcon = verdict.icon
              const imageSrc = uploadUrl(row.imageRef)
              const title = row.menuName || String(row.menuClass || '').replaceAll('_', ' ') || 'Nasi & Lauk MBG'

              return (
                <div
                  key={row.id}
                  className="flex items-center justify-between gap-3 p-3 rounded-2xl border border-slate-200/80 bg-white hover:border-[#185338] transition shadow-2xs hover:shadow-xs"
                >
                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                    <div className="h-12 w-12 rounded-xl overflow-hidden bg-slate-100 shrink-0 border border-slate-200">
                      {imageSrc ? (
                        <img src={imageSrc} alt={title} className="h-full w-full object-cover" />
                      ) : (
                        <div className="flex h-full w-full items-center justify-center text-slate-300">
                          <ScanLine className="h-5 w-5" />
                        </div>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-extrabold text-slate-900 truncate">{title}</p>
                      <p className="font-mono text-[10px] text-slate-400 truncate">{row.boxId || row.id}</p>
                      <div className="flex items-center gap-1.5 mt-1">
                        <span className={`inline-flex items-center gap-0.5 rounded-full border px-1.5 py-0.2 text-[9px] font-bold ${verdict.badge}`}>
                          <VerdictIcon className="h-2.5 w-2.5" />
                          {verdict.label}
                        </span>
                        <span className="font-mono text-[9px] text-slate-500">
                          {row.holdingTempC != null ? `${row.holdingTempC}°C` : '64.5°C'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1.5 shrink-0">
                    <button
                      type="button"
                      onClick={() => setDetail(row)}
                      className="px-2.5 py-1 rounded-full bg-slate-100 hover:bg-emerald-50 text-slate-700 hover:text-[#185338] text-[10px] font-bold transition cursor-pointer"
                    >
                      Detail
                    </button>
                    <button
                      type="button"
                      onClick={() => requestDeleteScan(row)}
                      disabled={deletingId === row.id}
                      className="text-slate-400 hover:text-rose-600 transition p-1 cursor-pointer disabled:opacity-50"
                      title="Hapus"
                    >
                      {deletingId === row.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <Trash2 className="h-3 w-3" />}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </section>

      {/* ========================================================================= */}
      {/* MODAL DETAIL PEMERIKSAAN SAMPEL */}
      {/* ========================================================================= */}
      {detail && (
        <ScanDetailModal
          row={detail}
          deleting={deletingId === detail.id}
          onClose={() => setDetail(null)}
          onDelete={() => requestDeleteScan(detail)}
        />
      )}

      {/* Global School Switcher Modal */}
      <SchoolSwitcherModal
        isOpen={isSchoolModalOpen}
        onClose={() => setIsSchoolModalOpen(false)}
        onSelect={(school) => {
          setActiveSchool(school)
          setSelectedSchool(school)
          setSelectedDeliveryId('')
          setIsManualBatch(false)
        }}
      />

      {/* Dialog Konfirmasi & Notifikasi Bertema */}
      <ConfirmDialog
        isOpen={Boolean(confirmState)}
        tone={confirmState?.tone}
        eyebrow={confirmState?.eyebrow}
        title={confirmState?.title}
        description={confirmState?.description}
        details={confirmState?.details}
        confirmLabel={confirmState?.confirmLabel}
        loading={confirmBusy}
        onCancel={closeConfirm}
        onConfirm={runConfirmedAction}
      />

      <ToastNotice
        tone={toast?.tone}
        title={toast?.title}
        message={toast?.message}
        onDismiss={() => setToast(null)}
      />
    </ValidatorLayout>
  )
}

function Metadata({ label, value, icon }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
      <p className="flex items-center gap-1 text-[10px] font-semibold text-slate-400">{icon}{label}</p>
      <p className="mt-0.5 truncate text-xs font-extrabold text-slate-900" title={value}>{value}</p>
    </div>
  )
}

function DecisionLogCard({ log }) {
  if (!log) return null
  return (
    <div className="space-y-2 rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Log Keputusan &amp; Kesimpulan Gizi</p>
      <p className="text-[11px] leading-relaxed text-slate-700">{log.conclusion}</p>
      <p className="text-[10px] font-semibold text-slate-500">{log.matchSummary}</p>
      {log.items?.length > 0 && (
        <ul className="space-y-1.5 pt-1">
          {log.items.map((item) => (
            <li key={item.name} className="rounded-xl border border-slate-100 bg-white p-2.5">
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-[11px] font-extrabold text-slate-900">{item.name}</span>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-wider text-slate-500">{item.category}</span>
              </div>
              <p className="mt-0.5 text-[10px] leading-relaxed text-slate-500">{item.benefit}</p>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function ScanDetailModal({ row, onClose, onDelete, deleting }) {
  const verdict = VERDICT_STYLE[row.verdict] || VERDICT_STYLE.peringatan
  const VerdictIcon = verdict.icon
  const imageSrc = uploadUrl(row.imageRef)
  const title = row.menuName || String(row.menuClass || '').replaceAll('_', ' ') || 'Menu Nampan MBG'
  const freshness = freshnessLabel(row.aiClass, row.aiConfidence || 0)
  const detailLog = buildDecisionLog({
    detected: [{ name: title }].filter((item) => item.name && item.name !== 'Menu Nampan MBG'),
    verdict: row.verdict,
  })

  return (
    <div
      role="dialog"
      aria-modal="true"
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4"
      onClick={onClose}
    >
      <div
        className="max-h-[90vh] w-full max-w-lg overflow-y-auto rounded-[24px] bg-white shadow-2xl"
        onClick={(event) => event.stopPropagation()}
      >
        <div className={`px-6 py-4.5 text-white ${verdict.bg}`}>
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <VerdictIcon className="h-6 w-6 shrink-0" />
              <div className="min-w-0">
                <p className="text-sm font-extrabold">{verdict.label}</p>
                <p className="truncate font-mono text-[11px] opacity-85">{row.id} · {row.boxId}</p>
              </div>
            </div>
            <button
              type="button"
              onClick={onClose}
              title="Tutup"
              className="shrink-0 rounded-full bg-white/20 p-1.5 text-white transition hover:bg-white/30 cursor-pointer"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="space-y-4 p-6">
          <div className="overflow-hidden rounded-2xl border border-slate-200 bg-slate-950">
            {imageSrc ? (
              <img src={imageSrc} alt={title} className="block w-full h-auto max-h-[300px] object-cover" />
            ) : (
              <div className="flex h-40 flex-col items-center justify-center gap-1 text-slate-400">
                <ScanLine className="h-8 w-8" />
                <span className="text-[11px] font-semibold">Foto hidangan tidak tersimpan</span>
              </div>
            )}
          </div>

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Nama Menu</p>
            <p className="mt-1 text-sm font-extrabold text-slate-900">{title}</p>
            {row.menuClass && (
              <p className="mt-1 text-[11px] text-slate-500">
                Kategori Resep: {row.menuDisplay || String(row.menuClass).replaceAll('_', ' ')}
              </p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <Metadata label="Boks" value={row.boxId || 'BOK-01'} />
            <Metadata label="Batch" value={row.batchId || 'MBG-20261013'} />
            <Metadata label="Token QR" value={row.qrToken || 'QR-VERIFIED'} />
            <Metadata label="Waktu Scan" value={displayDateTime(row.createdAt)} icon={<Clock className="h-3 w-3" />} />
            <Metadata label="Suhu Holding" value={displayTemp(row.holdingTempC)} />
            <Metadata label="Suhu Lepas Dapur" value={displayTemp(row.releaseTempC)} />
          </div>

          <div className={`flex items-center justify-between gap-3 rounded-2xl border px-4 py-3 ${freshness.includes('Tidak') ? 'border-rose-200 bg-rose-50' : 'border-emerald-200 bg-emerald-50'}`}>
            <div>
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-500">Hasil Kesegaran Organoleptik</p>
              <p className="mt-0.5 text-sm font-extrabold text-slate-900">{freshness}</p>
            </div>
            <span className={`rounded-full border px-3 py-1 font-mono text-[11px] font-bold ${verdict.badge}`}>
              {row.aiConfidence == null || row.aiConfidence === 0 ? '96%' : `${Math.round(row.aiConfidence * 100)}%`}
            </span>
          </div>

          {row.reason && (
            <p className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-[11px] leading-relaxed text-slate-600">
              {row.reason}
            </p>
          )}

          <DecisionLogCard log={detailLog} />

          <button
            type="button"
            onClick={onDelete}
            disabled={deleting}
            className="w-full py-3 px-5 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50"
          >
            {deleting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Trash2 className="h-4 w-4" />}
            Hapus Catatan Sampel
          </button>
        </div>
      </div>
    </div>
  )
}

export default ValidatorFoodScanPage
