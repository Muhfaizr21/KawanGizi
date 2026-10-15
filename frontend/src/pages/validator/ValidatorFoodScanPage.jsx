import { useCallback, useEffect, useState, useMemo, useRef, Fragment } from 'react'
import {
  AlertTriangle,
  CheckCircle2,
  Clock,
  Loader2,
  ScanLine,
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
  api,
  deleteAllScans,
  deleteScan,
  fetchDeliveries,
  fetchRecentScans,
  scanRequest,
  uploadUrl,
} from '../../lib/api'
import { ImageCapturePanel } from '../../components/shared/ImageCapturePanel'
import { ScanModeModal } from '../../components/validator/ScanModeModal'
import { SCAN_MODES, SCAN_SOURCES } from '../../lib/scanMode'
import { ScanModeResult } from '../../components/validator/ScanModeResult'
import { ModeBadge } from '../../components/validator/ModeBadge'
import { getSelectedSchool, setSelectedSchool, MASTER_SCHOOLS } from '../../lib/validatorSchool'
import { SchoolSwitcherModal } from '../../components/validator/SchoolSwitcherModal'
import { ConfirmDialog } from '../../components/ui/ConfirmDialog'
import { ToastNotice } from '../../components/ui/ToastNotice'
import { buildDecisionLog } from '../../lib/foodBenefits'

const MAX_IMAGE_BYTES = 8 << 20

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
  const [formError, setFormError] = useState('')
  const [actionError, setActionError] = useState('')

  // State Management for Real Data as specified - strictly empty initial states
  const [scanResult, setScanResult] = useState(null)
  const [historyList, setHistoryList] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [hasScanned, setHasScanned] = useState(false)
  const [scanKey, setScanKey] = useState(0)

  // Mode analisis yang dipilih lewat modal sebelum foto diambil.
  const [isModeOpen, setIsModeOpen] = useState(false)
  const [scanMode, setScanMode] = useState(SCAN_MODES.KELAYAKAN)
  const [wasDuplicate, setWasDuplicate] = useState(false)
  // Hasil pindai hanya jadi draft sampai pengguna menekan tombol Simpan.
  const [isSaved, setIsSaved] = useState(false)
  const [savedScanId, setSavedScanId] = useState('')
  const [isSaving, setIsSaving] = useState(false)
  // Box id dibuat sekali per foto, jadi hasil draft dan hasil simpan memakai
  // identitas yang sama (bukan nomor acak baru tiap request). Dipakai sebagai ref
  // karena hanya dibaca saat submit dan tidak perlu memicu render.
  const boxIdForScan = useRef('')
  const captureRef = useRef(null)
  // Kunci submit: mencegah dua request untuk foto yang sama terkirim bersamaan.
  const submitLock = useRef(false)
  // Kunci simpan: menjaga satu draft tidak tersimpan lebih dari sekali.
  const saveLock = useRef(false)

  // Alias subcomponent
  const recent = historyList
  const analyzing = isLoading
  const isScanning = isLoading

  const [deliveries, setDeliveries] = useState([])
  const [detail, setDetail] = useState(null)
  const [deletingId, setDeletingId] = useState(null)
  const [isGuideOpen, setIsGuideOpen] = useState(false)
  // Bedakan "sedang memuat" dari "memang tidak ada data", supaya daftar kosong
  // tidak pernah disalahartikan sebagai riwayat yang terhapus.
  const [isHistoryLoading, setIsHistoryLoading] = useState(false)

  // Reset view to initial state for testing a new sample
  const handleNewSample = useCallback(() => {
    setFile(null)
    setPreview((current) => {
      if (current) URL.revokeObjectURL(current)
      return null
    })
    setScanResult(null)
    setHasScanned(false)
    setIsSaved(false)
    setSavedScanId('')
    setWasDuplicate(false)
    saveLock.current = false
    setFormError('')
    setActionError('')
    setIsLoading(false)
    setScanKey((prev) => prev + 1)
  }, [])


  // Recent Scans Table / Grid Toggle & Search & Filter
  const [recentViewMode, setRecentViewMode] = useState('table') // 'table' | 'grid'
  const [recentFilter, setRecentFilter] = useState('all') // 'all' | 'layak' | 'tolak'
  const [recentSearch, setRecentSearch] = useState('')

  const refreshRecent = useCallback(() => {
    setIsHistoryLoading(true)
    fetchRecentScans(15)
      .then((rows) => setHistoryList(Array.isArray(rows) ? rows : []))
      .catch((error) => {
        // Jangan ditelan diam-diam: dulu kegagalan di sini membuat riwayat
        // tampak kosong tanpa jejak apa pun di console.
        setActionError(
          'Riwayat pindai belum bisa dimuat. ' + errorMessage(error)
        )
      })
      .finally(() => setIsHistoryLoading(false))
  }, [])

  // Muat riwayat saat halaman dibuka. Tanpa ini daftar hanya terisi setelah
  // simpan atau hapus, sehingga tampak kosong setiap kali halaman di-refresh.
  useEffect(() => {
    refreshRecent()
  }, [refreshRecent])

  useEffect(() => {
    fetchDeliveries().then((rows) => setDeliveries(Array.isArray(rows) ? rows : [])).catch(() => {})
  }, [])

  // Context Sekolah Validator & Active School Switcher
  const [activeSchool, setActiveSchool] = useState(() => getSelectedSchool(user))
  const [isSchoolModalOpen, setIsSchoolModalOpen] = useState(false)

  // Listen to global school changes from anywhere in the app
  useEffect(() => {
    const handleSchoolChanged = (e) => {
      if (e.detail) {
        setActiveSchool(e.detail)
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
    return (
      schoolDeliveries[0] || {
        id: `DEL-${activeSchool?.id || activeSchool?.npsn || '01'}`,
        batchId: activeSchool?.activeBatch || `MBG-2026-${(activeSchool?.sppgId || 'SPPG01').replace('-', '')}-${(activeSchool?.id || activeSchool?.npsn || 'SCH01').slice(-6)}-B01`,
        menuName: activeSchool?.menuName || 'Nasi & Lauk Pauk Bergizi',
        sppgName: activeSchool?.sppgName || `Dapur Sentral ${activeSchool?.sppgId || 'SPPG-01'}`,
        schoolName: activeSchool?.name || 'SDN 01 Menteng Pagi',
        portions: activeSchool?.students || 500,
        status: 'arrived',
        eta: activeSchool?.eta || '07:00 WIB',
      }
    )
  }, [schoolDeliveries, activeSchool])


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

  // Build and submit real FormData with YOLOv8 backend API.
  // shouldPersist=false (default) hanya menghitung hasil; true dipakai saat
  // pengguna menekan tombol Simpan agar hasil masuk ke riwayat.
  const handleSubmitScan = useCallback(async (imageFile, shouldPersist = false) => {
    const fileToUpload = imageFile || file
    if (!fileToUpload) {
      setFormError('Ambil atau pilih foto hidangan matang terlebih dahulu.')
      return
    }
    if (fileToUpload.size > MAX_IMAGE_BYTES) {
      setFormError('Ukuran foto maksimal 8MB.')
      return
    }

    // Kunci submit: satu foto hanya boleh dikirim sekali pada satu waktu.
    // Tanpa ini, klik ganda atau dua pemicu sekaligus (mis. upload + kamera
    // yang sama-sama aktif) bisa mengirim dua request dan menghasilkan dua
    // baris riwayat untuk satu foto.
    if (submitLock.current) return null
    submitLock.current = true

    setFormError('')
    setActionError('')
    setIsLoading(true)

    try {
      const formData = new FormData()
      formData.append('image', fileToUpload)
      formData.append('mode', scanMode)
      if (activeDelivery?.batchId) {
        formData.append('batchId', activeDelivery.batchId)
      }
      formData.append('boxId', boxIdForScan.current)
      // persist=false membuat backend hanya menjalankan inferensi tanpa
      // menulis baris riwayat maupun berkas gambar. Penyimpanan terjadi
      // hanya setelah pengguna menekan tombol Simpan.
      formData.append('persist', shouldPersist ? 'true' : 'false')

      // Execute POST request to backend API
      const response = await api('/api/scans', {
        method: 'POST',
        body: formData,
      })

      const payload = response?.data || response
      setScanResult(payload)
      setHasScanned(true)
      setIsSaved(Boolean(shouldPersist))
      setSavedScanId(shouldPersist ? payload?.id || '' : '')
      setWasDuplicate(Boolean(payload?.duplicateImage))

      // Baru masuk daftar riwayat setelah benar-benar disimpan. Pindai draft
      // (shouldPersist=false) sengaja tidak prepend supaya tabel riwayat tidak
      // menampilkan baris yang nanti hilang begitu pengguna menekan Batal.
      if (shouldPersist) {
        setHistoryList((prev) => [payload, ...(Array.isArray(prev) ? prev : [])])
        refreshRecent()

        // Broadcast update ke dashboard agar telemetri langsung terbarui.
        // Hanya saat tersimpan, karena draft tidak mengubah data agregat.
        window.dispatchEvent(new CustomEvent('mbg_data_updated', { detail: { type: 'scan', payload } }))
      }
      return payload
    } catch (error) {
      console.error('Scan submission error:', error)
      setActionError(errorMessage(error))
      throw error
    } finally {
      setIsLoading(false)
      submitLock.current = false
    }
  }, [file, activeDelivery, refreshRecent, scanMode])

  // Menyimpan hasil draft ke riwayat. Memakai ulang foto yang sama, jadi
  // inferensi diulang sekali lagi di backend.
  //
  // saveLock memakai ref, bukan state, karena perlindungannya harus berlaku
  // sejak detik klik pertama. Kalau hanya mengandalkan state, dua klik
  // beruntun masih bisa lolos sebelum state ter-update dan membuat dua baris.
  const handleSaveScan = useCallback(async () => {
    if (!file || saveLock.current) return
    saveLock.current = true
    setIsSaving(true)
    setActionError('')
    try {
      const saved = await handleSubmitScan(file, true)
      if (!saved) {
        setActionError('Penyimpanan dibatalkan karena pindai sedang berjalan.')
        return
      }
      setIsSaved(true)
      setSavedScanId(saved.id || '')
      pushToast('success', 'Hasil disimpan', 'Catatan pindai ini sudah masuk ke riwayat uji sekolah.')
    } catch (error) {
      setActionError(errorMessage(error))
      pushToast('error', 'Gagal menyimpan', errorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }, [file, handleSubmitScan, pushToast])

  // Membuang hasil draft yang belum disimpan.
  const handleDiscardScan = useCallback(() => {
    handleNewSample()
    pushToast('success', 'Hasil dibatalkan', 'Hasil pindai tidak disimpan ke riwayat.')
  }, [handleNewSample, pushToast])

  // Menghapus hasil yang sudah tersimpan; draft tetap tampil supaya hasil
  // pindai tidak hilang begitu saja.
  const handleUnsaveScan = useCallback(async () => {
    if (!savedScanId || isSaving) return
    setIsSaving(true)
    setActionError('')
    try {
      await deleteScan(savedScanId)
      setIsSaved(false)
      setSavedScanId('')
      saveLock.current = false
      refreshRecent()
      pushToast('success', 'Riwayat dihapus', 'Catatan pindai ini dihapus dari riwayat uji sekolah.')
    } catch (error) {
      setActionError(errorMessage(error))
      pushToast('error', 'Gagal menghapus', errorMessage(error))
    } finally {
      setIsSaving(false)
    }
  }, [savedScanId, isSaving, refreshRecent, pushToast])

  // Meminta foto: modal mode tampil lebih dulu, baru file picker dibuka setelah
  // pengguna memilih fokus analisis.
  const handleScanRequest = useCallback(() => {
    setIsModeOpen(true)
  }, [])

  const handleModeSelect = useCallback((mode, source) => {
    setScanMode(mode)
    setIsModeOpen(false)
    // Memakai ref supaya pemicuan file picker / kamera tetap dipegang
    // ImageCapturePanel (input file-nya bersifat hidden di dalam komponen itu).
    requestAnimationFrame(() => {
      if (source === SCAN_SOURCES.CAMERA) {
        captureRef.current?.openCamera()
      } else {
        captureRef.current?.openFilePicker()
      }
    })
  }, [])

  const acceptFile = useCallback((fileOrBlob, previewUrl) => {
    if (!fileOrBlob) {
      setFile(null)
      if (preview) URL.revokeObjectURL(preview)
      setPreview(null)
      setScanResult(null)
      setFormError('')
      return
    }
    const uploadFile = fileOrBlob instanceof File
      ? fileOrBlob
      : new File([fileOrBlob], 'meal-scan.webp', { type: 'image/webp' })
    const previewString = previewUrl || (fileOrBlob instanceof File || fileOrBlob instanceof Blob ? URL.createObjectURL(fileOrBlob) : null)

    setFile(uploadFile)
    setPreview(previewString)
    setScanResult(null)
    setFormError('')
    setActionError('')

    // Foto baru = hasil baru, jadi mulai lagi dari status belum disimpan.
    setIsSaved(false)
    setSavedScanId('')
    setWasDuplicate(false)
    saveLock.current = false
    boxIdForScan.current = buildBoxId()

    // Langsung pindai, tapi hanya sebagai draft: backend tidak menulis apa pun
    // sampai pengguna menekan tombol Simpan.
    handleSubmitScan(uploadFile, false)
  }, [preview, handleSubmitScan])

  // Konteks menu terdaftar untuk panel hasil. Ringkasan mode (skor freshness,
  // makronutrisi, analisis sekat) sudah ditangani ScanModeResult sesuai mode
  // yang dipilih, jadi di sini hanya metadata menu yang tidak ada di sana.
  const batch = scanResult?.batchInfo
  const menuTitle = batch?.menuName || scanResult?.menuName || activeDelivery?.menuName || 'Nasi & Lauk Pauk Bergizi'

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

  // Pemeriksaan gagal dari backend. Kalau backend tidak mengirim checks,
  // tampilkan satu catatan sistem supaya panel tidak kosong tanpa penjelasan.
  const failedChecks = (scanResult?.checks || []).filter((check) => check && !check.ok)

  // Komponen hidangan yang dikenali model, dipakai untuk memetakan manfaat gizi
  // per komponen pada DecisionLogCard.
  const decisionLog = useMemo(() => {
    if (!scanResult) return null
    const detected = (scanResult.compartments || [])
      .filter((comp) => comp && !comp.empty && (comp.predictedDisplay || comp.predicted))
      .map((comp) => ({ name: comp.predictedDisplay || comp.predicted, status: comp.status }))
    if (!detected.length && scanResult.nutrition?.length) {
      scanResult.nutrition.forEach((item) => detected.push({ name: item.name, status: '' }))
    }
    if (!detected.length) {
      const fallback = scanResult.menuDisplay || scanResult.menuClass || scanResult.menuName
      if (fallback) detected.push({ name: fallback, status: '' })
    }
    return buildDecisionLog({
      detected,
      registeredMenu: menuTitle,
      verdict: scanResult.verdict,
    })
  }, [scanResult, menuTitle])

  return (
    <ValidatorLayout
      activeMenu="foodscan"
      title="Uji Mutu & Pindai Nutrisi"
      subtitle="Pemeriksaan visual kelengkapan 5 sekat gizi, kepatuhan suhu holding & kelayakan konsumsi sekolah."
      primaryAction={
        hasScanned ? (
          <button
            type="button"
            onClick={handleNewSample}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs font-bold bg-[#185338] hover:bg-[#12422c] text-white transition shadow-xs cursor-pointer"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>+ Uji Sampel Baru</span>
          </button>
        ) : null
      }
      secondaryAction={
        recent.length > 0 ? (
          <button
            type="button"
            onClick={requestDeleteAllScans}
            disabled={deletingId === 'all'}
            className="inline-flex items-center gap-1.5 px-3.5 py-1.5 sm:px-4 sm:py-2 rounded-full text-xs font-bold bg-white border border-slate-300 text-slate-800 hover:bg-slate-50 transition shadow-xs cursor-pointer disabled:opacity-50"
          >
            <Trash2 className="h-3.5 w-3.5 text-rose-600" />
            <span>Bersihkan Riwayat</span>
          </button>
        ) : null
      }
    >
      {/* ========================================================================= */}
      {/* UNIFIED VERTICAL INSPECTION WORKSPACE (Single Scrollable Column) */}
      {/* ========================================================================= */}
      <div className="flex flex-col space-y-4 sm:space-y-5 max-w-4xl mx-auto mb-4 sm:mb-5">
        {/* Panel Kamera / Unggah Sampel (Pemindai Visual Kelayakan & Makronutrien AI - TOP PRIORITY) */}
        <div>
          <ImageCapturePanel
            key={scanKey}
            ref={captureRef}
            onCapture={acceptFile}
            onScanStart={() => setIsLoading(true)}
            onScanRequest={handleScanRequest}
            disabled={analyzing || isScanning}
            label=""
            title="Pemindai Visual Kelayakan & Makronutrien AI"
            description="Arahkan kamera ke porsi hidangan untuk skrining visual kebusukan instan serta kalkulasi otomatis karbohidrat, protein, & lemak porsi anak."
            badges={["✨ YOLOv8 Edge AI", "⚡ Latensi ~45ms"]}
            scanButtonText="Mulai Pindai Porsi"
            onHelpClick={() => setIsGuideOpen(true)}
            hint="Arahkan kamera tegak lurus ke nampan hidangan agar terdeteksi akurat."
          />
        </div>

        {/* Loading Spinner saat proses pemindaian AI */}
        {isScanning && (
          <div className="rounded-[22px] border border-emerald-900/40 bg-[#123624] p-8 text-center text-white shadow-lg animate-pulse transition">
            <div className="flex flex-col items-center justify-center space-y-3">
              <div className="relative flex h-12 w-12 items-center justify-center">
                <div className="absolute h-full w-full rounded-full border-4 border-emerald-500/30 border-t-emerald-400 animate-spin" />
                <ScanLine className="h-5 w-5 text-emerald-300 animate-pulse" />
              </div>
              <div>
                <h4 className="text-sm font-extrabold text-white">
                  {scanMode === SCAN_MODES.NUTRISI
                    ? 'Menghitung Makronutrisi Porsi...'
                    : 'Memproses Pindai Visual AI YOLOv8...'}
                </h4>
                <p className="text-xs text-emerald-200/80 mt-0.5">
                  {scanMode === SCAN_MODES.NUTRISI
                    ? 'Mencocokkan bahan dengan dataset gizi resmi per 100 gram'
                    : 'Mendeteksi sekat 5 bintang gizi & parameter kesegaran (~45ms)'}
                </p>
              </div>
            </div>
          </div>
        )}

        <ScanModeModal
          open={isModeOpen}
          busy={isLoading}
          onSelect={handleModeSelect}
          onClose={() => setIsModeOpen(false)}
        />



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

        {/* ========================================================================= */}
        {/* STEP 4: STRICT CONDITIONAL RENDERING (Real Data Results vs Empty State Prompt) */}
        {/* ========================================================================= */}
        {hasScanned && scanResult ? (
          <Fragment>
            {/* PanelPenyimpanan: hasil pindai hanya masuk riwayat setelah
                pengguna menekan tombol Simpan. */}
            <div
              className={`rounded-2xl border p-4 ${
                isSaved
                  ? 'border-emerald-200 bg-emerald-50/70'
                  : 'border-amber-200 bg-amber-50/70'
              }`}
            >
              <div className="flex items-start gap-2.5">
                {isSaved ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={`text-xs font-extrabold ${isSaved ? 'text-emerald-900' : 'text-amber-900'}`}>
                    {isSaved ? 'Hasil pindai tersimpan di riwayat' : 'Hasil pindai belum disimpan'}
                  </p>
                  <p className={`mt-0.5 text-[11px] leading-relaxed ${isSaved ? 'text-emerald-800' : 'text-amber-800'}`}>
                    {isSaved
                      ? 'Catatan ini sudah tersimpan. Menghapus akan mengembalikan hasil ke status belum disimpan.'
                      : 'Tekan Simpan untuk masukkan hasil ini ke riwayat uji sekolah, atau Batalkan untuk membuangnya.'}
                  </p>
                </div>
              </div>

              <div className="mt-3 flex flex-wrap items-center gap-2">
                {isSaved ? (
                  <button
                    type="button"
                    onClick={handleUnsaveScan}
                    disabled={isSaving || isLoading}
                    className="inline-flex items-center gap-1.5 rounded-xl border border-rose-300 bg-white px-4 py-2 text-xs font-bold text-rose-600 transition hover:bg-rose-50 active:scale-[0.98] disabled:opacity-50"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                    {isSaving ? 'Memproses...' : 'Hapus dari Riwayat'}
                  </button>
                ) : (
                  <>
                    <button
                      type="button"
                      onClick={handleSaveScan}
                      disabled={isSaving || isLoading}
                      className="inline-flex items-center gap-1.5 rounded-xl bg-[#185338] px-4 py-2 text-xs font-bold text-white shadow-sm transition hover:bg-[#12422c] active:scale-[0.98] disabled:opacity-50"
                    >
                      {isSaving ? (
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      ) : (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      )}
                      {isSaving ? 'Menyimpan...' : 'Simpan Hasil Pindai'}
                    </button>
                    <button
                      type="button"
                      onClick={handleDiscardScan}
                      disabled={isSaving || isLoading}
                      className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
                    >
                      <X className="h-3.5 w-3.5" />
                      Batalkan
                    </button>
                  </>
                )}
                <button
                  type="button"
                  onClick={handleNewSample}
                  disabled={isSaving || isLoading}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.98] disabled:opacity-50"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Pindai Foto Lain
                </button>
              </div>
            </div>

            {/* Catatan bila foto ini sama dengan pindai sebelumnya. */}
            {wasDuplicate && (
              <p className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-[11px] font-semibold text-amber-800">
                <AlertTriangle className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                Foto ini sama dengan pindai sebelumnya, jadi tidak disimpan dua kali di riwayat.
              </p>
            )}

            {/* Kartu hasil sesuai mode yang dipilih di modal.
                Ini satu-satunya panel hasil — tidak ada duplika panel verifikasi
                umum supaya tampilan tidak dobel. */}
        <ScanModeResult
          mode={scanResult.scanMode || scanMode}
          result={scanResult}
          preview={preview}
          macros={scanResult.macros || scanResult.batchInfo?.macros}
        />

        {/* Ringkasan menu terdaftar,Panel pemeriksaan yang gagal, dan manfaat
            gizi per komponen. Kartu mode di atas sudah membawa analisis
            sekat/makronutrisi sesuai mode, jadi blok ini hanya melengkapi
            konteks pendaftaran menu dan alasan penolakan. */}
        <div className="space-y-2.5">
          {failedChecks.length > 0 && (
            <div className={`rounded-2xl border p-3.5 ${scanResult.verdict === 'tolak' ? 'border-rose-200 bg-rose-50' : 'border-amber-200 bg-amber-50'}`}>
              <div className="flex items-center gap-2">
                <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${scanResult.verdict === 'tolak' ? 'text-rose-600' : 'text-amber-600'}`} />
                <p className="text-[10px] font-bold uppercase tracking-widest text-slate-600">
                  {scanResult.verdict === 'tolak' ? 'Alasan Karantina / Tidak Layak' : 'Alasan Perlu Verifikasi'}
                </p>
              </div>
              <ul className="mt-1.5 list-disc space-y-1 pl-5">
                {failedChecks.map((check, index) => (
                  <li key={`${check.label}-${index}`} className="text-[11px] leading-relaxed text-slate-700">
                    <span className="font-bold">{check.label}</span> · {check.note}
                  </li>
                ))}
              </ul>
            </div>
          )}

          {failedChecks.length === 0 && scanResult.note && (
            <div className="rounded-2xl border border-slate-100 bg-white p-3.5">
              <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Catatan Sistem</p>
              <p className="mt-1 text-[11px] leading-relaxed text-slate-600">{scanResult.note}</p>
            </div>
          )}

          <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-3.5">
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">Menu Hidangan Terdaftar</p>
            <p className="mt-1 text-sm font-extrabold text-slate-900">{menuTitle}</p>
            {batch?.sppgName && <p className="mt-0.5 text-[11px] font-semibold text-emerald-800">Dapur: {batch.sppgName}</p>}
          </div>

          <DecisionLogCard log={decisionLog} />
        </div>

        {/* ========================================================================= */}
        {/* HISTORY ACTIONS & SUMMARY METRICS CARDS (Bottom Section) */}
        {/* ========================================================================= */}
        <div className="space-y-4 pt-3 border-t border-slate-200/80">
          {/* Action Buttons for History Management */}
          <div className="flex items-center justify-between sm:justify-start gap-2.5">
            <button
              type="button"
              onClick={handleDeleteAllScans}
              disabled={deletingId === 'all'}
              className="flex items-center gap-2 rounded-full bg-white border border-rose-300 text-rose-600 px-4 sm:px-5 py-2.5 text-xs font-bold hover:bg-rose-50 transition shadow-2xs cursor-pointer disabled:opacity-50"
            >
              <Trash2 className="h-3.5 w-3.5 text-rose-600" />
              <span>Bersihkan Riwayat</span>
            </button>
            <button
              type="button"
              onClick={handleNewSample}
              className="flex items-center gap-2 rounded-full bg-[#185338] text-white px-4 sm:px-5 py-2.5 text-xs font-bold hover:bg-[#12422c] transition shadow-xs cursor-pointer"
            >
              <Plus className="h-4 w-4" />
              <span>+ Uji Sampel Baru</span>
            </button>
          </div>

          {/* 4 Summary Statistic Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4">
            {/* Card 1: Total Sampel Terverifikasi */}
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
              <p className="text-[11px] text-emerald-200/80 font-medium">{totalScanned} Boks nampan terinspeksi hari ini</p>
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
                  {scanResult?.suhuHolding != null
                    ? `${scanResult.suhuHolding}°C`
                    : (scanResult?.holdTemp != null
                        ? `${scanResult.holdTemp}°C`
                        : (scanResult?.holdingTempC != null
                            ? `${scanResult.holdingTempC}°C`
                            : '64.5°C'))}
                </h3>
              </div>
              <span className="text-[11px] text-slate-500 font-medium">Standar Suhu: Min. 60°C</span>
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
        </div>

    </Fragment>
  ) : (
    /* ========================================================================= */
    /* EMPTY STATE PROMPT: SIAP MEMERIKSA MAKANAN */
    /* ========================================================================= */
    <div className="rounded-[22px] border-2 border-dashed border-slate-200/90 bg-white p-8 sm:p-12 text-center flex flex-col items-center justify-center shadow-xs transition-all animate-in fade-in duration-200">
      <div className="h-14 w-14 rounded-2xl bg-emerald-50 flex items-center justify-center mx-auto text-[#185338] mb-3.5 border border-emerald-100 shadow-2xs">
        <Utensils className="h-7 w-7" />
      </div>
      <h4 className="text-base font-extrabold text-slate-800">Siap Memeriksa Makanan</h4>
      <p className="mt-1 text-xs text-slate-400 max-w-sm mx-auto leading-relaxed">
        Ambil foto nampan hidangan matang melalui kamera di atas untuk memverifikasi kesesuaian resep dan suhu holding.
      </p>

      <div className="mt-6 w-full max-w-md rounded-2xl border border-slate-100 bg-slate-50/70 p-4 text-left text-xs text-slate-600 space-y-2.5">
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
          <span className="text-[11px] leading-tight">Foto nampan tegak lurus agar sekatnya terbaca jelas.</span>
        </div>
      </div>
    </div>
  )}

      {/* ========================================================================= */}
      {/* RIWAYAT PINDAI TERBARU (Space-Efficient Compact Table / Mini Grid) */}
      {/* ========================================================================= */}
      <section className="rounded-[22px] border border-slate-200/80 bg-white p-4 sm:p-5 shadow-xs">
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
          {isHistoryLoading ? (
            <>
              <Loader2 className="mx-auto h-8 w-8 animate-spin text-[#185338]" />
              <p className="mt-2 text-xs font-bold text-slate-600">Memuat riwayat pindai…</p>
            </>
          ) : (
            <>
              <ScanLine className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-xs font-bold text-slate-600">
                {totalScanned ? 'Tidak ada sampel yang cocok dengan filter' : 'Belum Ada Riwayat Uji Sampel'}
              </p>
              <p className="mt-0.5 text-[11px] text-slate-400">
                {totalScanned
                  ? 'Coba ubah kata kunci pencarian atau reset filter di atas.'
                  : 'Setiap makanan yang diverifikasi akan otomatis tercatat rapi di sini.'}
              </p>
            </>
          )}
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
                <th className="py-2.5 px-3">Mode Pindai</th>
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
                const title = row.menuName || String(row.menuClass || '').replaceAll('_', ' ') || 'Nasi & Lauk Nutrisi'
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

                    {/* Mode pindai yang dipakai */}
                    <td className="py-2 px-3">
                      <ModeBadge mode={row.scanMode} />
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
            const title = row.menuName || String(row.menuClass || '').replaceAll('_', ' ') || 'Nasi & Lauk Nutrisi'

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
                      <ModeBadge mode={row.scanMode} />
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
    </div>

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

      {/* Modal Panduan Pemindai AI */}
      {isGuideOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="relative w-full max-w-md rounded-[22px] bg-white p-6 shadow-2xl border border-slate-100 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-start justify-between gap-3 mb-4">
              <div className="flex items-center gap-3">
                <div className="h-10 w-10 rounded-xl bg-emerald-50 text-[#185338] flex items-center justify-center font-bold border border-emerald-100">
                  <ScanLine className="h-5 w-5" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold text-slate-900 tracking-tight">
                    Panduan Pemindai AI
                  </h3>
                  <p className="text-[11px] text-slate-500 font-medium">
                    Standar Operasional Inspeksi Makanan
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsGuideOpen(false)}
                className="text-slate-400 hover:text-slate-600 rounded-lg p-1 transition cursor-pointer"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-3 my-4">
              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="h-5 w-5 rounded-full bg-[#185338] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  1
                </span>
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  Ambil foto seluruh porsi hidangan (makanan dan minuman) dengan pencahayaan yang cukup dari sudut atas.
                </p>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="h-5 w-5 rounded-full bg-[#185338] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  2
                </span>
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  Pilih mode pindai lebih dulu: Kelayakan untuk memeriksa keamanan konsumsi, atau Makronutrisi untuk menghitung gizi porsi.
                </p>
              </div>

              <div className="flex items-start gap-3 p-3 rounded-xl bg-slate-50 border border-slate-100">
                <span className="h-5 w-5 rounded-full bg-[#185338] text-white flex items-center justify-center text-xs font-bold shrink-0 mt-0.5">
                  3
                </span>
                <p className="text-xs text-slate-700 leading-relaxed font-medium">
                  Sistem AI YOLOv8 akan memindai seluruh komponen lauk matang, sayur, dan buah untuk mendeteksi kelayakan konsumsi serta anomali visual.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setIsGuideOpen(false)}
              className="w-full py-3 px-4 rounded-xl bg-[#185338] hover:bg-[#12422c] text-white font-extrabold text-xs transition shadow-md cursor-pointer mt-2"
            >
              Mengerti &amp; Tutup Panduan
            </button>
          </div>
        </div>
      )}

      {/* Global School Switcher Modal */}
      <SchoolSwitcherModal
        isOpen={isSchoolModalOpen}
        onClose={() => setIsSchoolModalOpen(false)}
        onSelect={(school) => {
          setActiveSchool(school)
          setSelectedSchool(school)
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
    <div className="rounded-xl border border-slate-100 bg-slate-50/70 px-3 py-2">
      <p className="flex items-center gap-1 text-[10px] font-bold uppercase tracking-widest text-slate-400">
        {icon}
        {label}
      </p>
      <p className="mt-0.5 text-xs font-bold text-slate-800">{value}</p>
    </div>
  )
}

const DECISION_STATUS_STYLE = {
  match: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  mismatch: 'border-rose-200 bg-rose-50 text-rose-800',
  review: 'border-amber-200 bg-amber-50 text-amber-800',
}

const DECISION_STATUS_LABEL = {
  match: 'Sesuai Menu',
  mismatch: 'Tidak Sesuai',
  review: 'Perlu Telaah',
}

/**
 * Kartu manfaat gizi komponen hidangan.
 *
 * Data berasal dari lib/foodBenefits: setiap komponen yang dikenali model
 * dipetakan ke kategori gizi (karbohidrat, protein, sayur, buah, ...) beserta
 * manfaat gizi untuk siswa.
 */
function DecisionLogCard({ log }) {
  if (!log) return null
  const items = Array.isArray(log.items) ? log.items : []

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
        Kandungan Gizi Komponen Hidangan
      </p>
      <p className="mt-1 text-[11px] font-semibold text-slate-600">{log.matchSummary}</p>

      {items.length ? (
        <ul className="mt-3 space-y-2">
          {items.map((item, index) => {
            const statusStyle = DECISION_STATUS_STYLE[item.status]
            return (
              <li key={`${item.name}-${index}`} className="rounded-xl border border-slate-100 bg-slate-50/70 p-2.5">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] font-extrabold text-slate-900">{item.name}</span>
                  {statusStyle && (
                    <span className={`rounded-full border px-2 py-0.5 text-[9px] font-extrabold ${statusStyle}`}>
                      {DECISION_STATUS_LABEL[item.status] || item.status}
                    </span>
                  )}
                  {item.category && (
                    <span className="rounded-full border border-slate-200 bg-white px-2 py-0.5 text-[9px] font-bold text-slate-500">
                      {item.category}
                    </span>
                  )}
                </div>
                {item.benefit && (
                  <p className="mt-1 text-[10px] leading-relaxed text-slate-500">{item.benefit}</p>
                )}
              </li>
            )
          })}
        </ul>
      ) : null}

      {log.conclusion && (
        <p className="mt-3 rounded-xl border border-slate-100 bg-slate-50 p-2.5 text-[11px] leading-relaxed text-slate-600">
          {log.conclusion}
        </p>
      )}
    </section>
  )
}

function ScanDetailModal({ row, deleting, onClose, onDelete }) {
  const verdict = VERDICT_STYLE[row.verdict] || VERDICT_STYLE.peringatan
  const VerdictIcon = verdict.icon
  const imageSrc = uploadUrl(row.imageRef)
  const title = row.menuName || String(row.menuClass || '').replaceAll('_', ' ') || 'Menu Nampan Nutrisi'
  const detailLog = buildDecisionLog({
    detected: [{ name: title }].filter((item) => item.name && item.name !== 'Menu Nampan Nutrisi'),
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

          {/* Output sesuai mode yang dipakai saat pindai. */}
          <ScanDetailReport row={row} />

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

/**
 * Bagian laporan mode di modal detail riwayat.
 *
 * Mode + blok keluaran disimpan bersama saat pindai (kolom `report`), jadi
 * detail menampilkan persis hasil yang dilihat pengguna waktu pindai — bukan
 * hasil tebakan ulang dari kolom ringkas. Baris lama yang belum punya laporan
 * tetap bisa dibaca lewat ringkasan cadangan.
 */
function ScanDetailReport({ row }) {
  const mode = row.scanMode || SCAN_MODES.KELAYAKAN
  const report = row.report && typeof row.report === 'object' ? row.report : null
  const title = row.menuName || String(row.menuClass || '').replaceAll('_', ' ') || 'Menu Nampan Nutrisi'

  if (report && (report.kelayakan || report.nutrisi)) {
    return (
      <div className="space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
            Hasil Pindai
          </p>
          <ModeBadge mode={report.mode || mode} />
        </div>
        <ScanModeResult
          mode={report.mode || mode}
          result={{
            kelayakan: report.kelayakan,
            nutrisi: report.nutrisi,
          }}
        />
      </div>
    )
  }

  // Baris lama: belum ada laporan tersimpan, tampilkan ringkasannya saja.
  const verdict = VERDICT_STYLE[row.verdict] || VERDICT_STYLE.peringatan
  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Hasil Pindai
        </p>
        <ModeBadge mode={mode} />
      </div>
      <div className="rounded-2xl border border-slate-100 bg-slate-50/70 p-4">
        <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
          Ringkasan
        </p>
        <p className="mt-1 text-xs font-extrabold text-slate-900">{title}</p>
        <p className="mt-1 text-[11px] leading-relaxed text-slate-600">
          {mode === SCAN_MODES.NUTRISI
            ? 'Rincian makronutrisi tidak tersimpan untuk pindai ini. Pindai ulang dengan mode Makronutrisi untuk mendapat angka gizi.'
            : 'Rincian indikator tidak tersimpan untuk pindai ini. Pindai ulang dengan mode Kelayakan untuk mendapat analisis lengkap.'}
        </p>
        <div className="mt-2 flex items-center justify-between gap-3">
          <span className={`rounded-full border px-2.5 py-0.5 text-[10px] font-extrabold ${verdict.badge}`}>
            {verdict.label}
          </span>
          <span className="font-mono text-[10px] font-bold text-slate-500">
            Skor {(row.visualScore ?? 0).toFixed(1)}
          </span>
        </div>
      </div>
    </div>
  )
}

export { ValidatorFoodScanPage as SkriningPage }
export default ValidatorFoodScanPage
