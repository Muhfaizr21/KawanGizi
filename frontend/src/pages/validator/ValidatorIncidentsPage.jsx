import { useState, useEffect, useCallback, useMemo, useRef } from 'react'
import {
  Siren,
  Camera,
  CheckCircle2,
  AlertTriangle,
  Radio,
  Send,
  ChevronRight,
  Image as ImageIcon,
  RefreshCw,
  Clock,
  Building2,
  ShieldAlert,
  Search,
  CheckCircle,
  MessageSquare,
  Sparkles,
  Flame,
  ArrowRight,
  ExternalLink,
  ArrowUpRight,
  Plus,
  Trash2,
  X,
  UploadCloud,
} from 'lucide-react'
import { ValidatorLayout } from '../../components/layout/ValidatorLayout'
import { useAuth } from '../../context/AuthContext'
import { fetchValidatorIncidents, submitValidatorIncident } from '../../lib/api'

export const INCIDENT_CATEGORIES = [
  {
    id: 'sour',
    label: 'Aroma Asam / Basi',
    desc: 'Indikasi fermentasi mikroba atau suhu dingin rantai distribusi putus.',
  },
  {
    id: 'foreign',
    label: 'Benda Asing (Krikil/Serangga)',
    desc: 'Cemaran fisik berbahaya yang masuk pada proses memasak atau pengepakan.',
  },
  {
    id: 'undercooked',
    label: 'Kematangan Kurang / Mentah',
    desc: 'Lauk hewani atau nabati yang belum matang sempurna.',
  },
  {
    id: 'temp_drop',
    label: 'Suhu Drop & Basi Logistik',
    desc: 'Suhu hidangan turun di bawah 60°C selama lebih dari 2 jam.',
  },
  {
    id: 'packaging',
    label: 'Kemasan Pecah / Bocor',
    desc: 'Wadah hidangan retak, bocor, atau segel terbuka saat tiba di sekolah.',
  },
  {
    id: 'allergy',
    label: 'Keluhan Medis / Alergi',
    desc: 'Siswa mengalami gejala alergi atau sakit perut setelah konsumsi.',
  },
]

export const SEVERITY_LEVELS = [
  {
    id: 'low',
    label: 'Rendah (Porsi Cadangan)',
    desc: 'Dapat ditangani dengan porsi cadangan sekolah. SPPG dikirimi catatan koreksi.',
    badgeBg: 'bg-emerald-50 text-emerald-800 border-emerald-200',
    dotColor: 'bg-emerald-500',
  },
  {
    id: 'medium',
    label: 'Sedang (Tahan Kelas / Batch)',
    desc: 'Porsi 1 rombel ditahan sementara. Investigasi cepat dengan tim dapur SPPG.',
    badgeBg: 'bg-amber-50 text-amber-800 border-amber-200',
    dotColor: 'bg-amber-500',
  },
  {
    id: 'high',
    label: 'Tinggi / Darurat (Isolasi Total)',
    desc: '🚨 Sirene darurat aktif. Seluruh batch diisolasi total, Satgas KawanGizi dikerahkan.',
    badgeBg: 'bg-rose-50 text-rose-800 border-rose-200 animate-pulse',
    dotColor: 'bg-rose-600',
  },
]

export const PROTOCOL_STEPS = [
  'Hentikan pembagian porsi yang dicurigai kepada siswa secara tertib.',
  'Amankan 2 sampel boks ke dalam kantong sampel steril berperekat.',
  'Ambil 2-3 foto bukti kondisi makanan, tekstur, dan label stiker boks.',
  'Kirim laporan eskalasi ini untuk instruksi penggantian porsi dari SPPG.',
]

export function ValidatorIncidentsPage() {
  const { user } = useAuth()

  // 1. Core Data States (Dynamic API Driven)
  const [incidentList, setIncidentList] = useState([])
  const [schoolInfo, setSchoolInfo] = useState(null)
  const [parentSppg, setParentSppg] = useState(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [toast, setToast] = useState(null)

  // 2. Form States
  const [category, setCategory] = useState('sour')
  const [severityLevel, setSeverityLevel] = useState('low') // 'low' | 'medium' | 'high'
  const [description, setDescription] = useState('')
  const [evidenceImages, setEvidenceImages] = useState([]) // array of { id, file, previewUrl, label }

  // 3. UI Controls
  const [activeFilter, setActiveFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [showProtocol, setShowProtocol] = useState(true)

  const fileInputRef = useRef(null)

  const showToast = (message, tone = 'info') => {
    setToast({ message, tone })
    setTimeout(() => setToast(null), 5000)
  }

  // Fetch Incidents from Backend API (GET request)
  const fetchIncidentData = useCallback(async (isSilent = false) => {
    if (!isSilent) setIsLoading(true)
    else setIsRefreshing(true)

    try {
      const data = await fetchValidatorIncidents()
      if (data) {
        const list = Array.isArray(data)
          ? data
          : Array.isArray(data.tickets)
          ? data.tickets
          : []
        setIncidentList(list)
        if (data.school) setSchoolInfo(data.school)
        if (data.parentSppg) setParentSppg(data.parentSppg)
      } else {
        setIncidentList([])
      }
    } catch (err) {
      console.error('Error fetching incidents:', err)
      showToast('Gagal memuat daftar insiden: ' + (err.message || 'Periksa koneksi backend'), 'error')
    } finally {
      setIsLoading(false)
      setIsRefreshing(false)
    }
  }, [])

  useEffect(() => {
    fetchIncidentData()
  }, [fetchIncidentData])

  // Image Upload Handlers
  const handleFileSelect = (e) => {
    const files = Array.from(e.target.files || [])
    if (!files.length) return

    const remainingSlots = 3 - evidenceImages.length
    const allowedFiles = files.slice(0, remainingSlots)

    const newEvidence = allowedFiles.map((file, idx) => ({
      id: Date.now() + Math.random().toString(36).slice(2, 6) + idx,
      file,
      previewUrl: URL.createObjectURL(file),
      label: `Foto ${evidenceImages.length + idx + 1}`,
    }))

    setEvidenceImages((prev) => [...prev, ...newEvidence])

    // Reset input agar pengguna bisa memilih file yang sama jika dihapus
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const handleRemoveImage = (idToRemove) => {
    setEvidenceImages((prev) => {
      const target = prev.find((img) => img.id === idToRemove)
      if (target?.previewUrl) {
        URL.revokeObjectURL(target.previewUrl)
      }
      return prev.filter((img) => img.id !== idToRemove)
    })
  }

  // Form Submit Handler (POST request)
  const handleSubmit = async (e) => {
    if (e && e.preventDefault) e.preventDefault()

    if (!category) {
      showToast('Harap pilih kategori insiden terlebih dahulu.', 'error')
      return
    }

    if (!description.trim()) {
      showToast('Harap isi kronologi atau keterangan kejadian.', 'error')
      return
    }

    setIsSubmitting(true)
    try {
      // Build form data payload for real multipart submission
      const formData = new FormData()
      formData.append('category', category)
      formData.append('severity', severityLevel)
      formData.append('severityLevel', severityLevel)
      formData.append('description', description.trim())
      formData.append('reporterName', user?.fullName || 'Petugas Validator Lapangan')
      formData.append('npsn', schoolInfo?.npsn || '33.210.130')
      formData.append('sppgId', parentSppg?.id || schoolInfo?.sppgId || 'SPPG-01')

      // Append image files
      evidenceImages.forEach((item, index) => {
        if (item.file) {
          formData.append(`evidenceImages`, item.file)
        }
      })

      // Also provide JSON fallback structure for API helper compatibility
      const jsonPayload = {
        category,
        severity: severityLevel,
        description: description.trim(),
        photos: evidenceImages.map((_, i) => i + 1),
        reporterName: user?.fullName || 'Petugas Validator Lapangan',
        npsn: schoolInfo?.npsn || '33.210.130',
        sppgId: parentSppg?.id || 'SPPG-01',
      }

      // Try sending via submitValidatorIncident (accepts FormData or JSON)
      const newTicket = await submitValidatorIncident(formData).catch(async () => {
        // Fallback to JSON payload if multipart failed
        return await submitValidatorIncident(jsonPayload)
      })

      if (newTicket) {
        showToast(
          severityLevel === 'high'
            ? `🚨 SIRENE DARURAT: Tiket ${newTicket.id || 'baru'} diterbitkan! SPPG & Satgas KawanGizi telah diberitahu.`
            : `Tiket insiden ${newTicket.id || 'baru'} berhasil dikirim ke Manajer Dapur SPPG.`,
          'success'
        )

        // Clear form state
        setDescription('')
        setSeverityLevel('low')
        setCategory('sour')
        setEvidenceImages([])

        // Prepend new incident directly to state for instant UI update
        setIncidentList((prev) => [newTicket, ...prev])

        // Refetch silently to ensure synchronization
        fetchIncidentData(true)
      } else {
        throw new Error('Server tidak mengembalikan respons tiket yang valid.')
      }
    } catch (err) {
      console.error('Error submitting incident:', err)
      showToast('Gagal mengirimkan laporan: ' + (err.message || 'Kesalahan jaringan'), 'error')
    } finally {
      setIsSubmitting(false)
    }
  }

  // Computed metrics
  const activeCount = incidentList.filter((t) => t.status !== 'resolved').length
  const resolvedCount = incidentList.filter((t) => t.status === 'resolved').length
  const highSevCount = incidentList.filter((t) => t.severity === 'high' && t.status !== 'resolved').length

  // Filtered tickets
  const filteredList = useMemo(() => {
    return incidentList.filter((t) => {
      if (activeFilter === 'active' && t.status === 'resolved') return false
      if (activeFilter === 'resolved' && t.status !== 'resolved') return false
      if (activeFilter === 'high' && t.severity !== 'high') return false

      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchId = t.id?.toLowerCase().includes(q)
        const matchCat = t.category?.toLowerCase().includes(q)
        const matchNote = (t.note || t.description)?.toLowerCase().includes(q)
        const matchSchool = t.schoolName?.toLowerCase().includes(q)
        if (!matchId && !matchCat && !matchNote && !matchSchool) return false
      }
      return true
    })
  }, [incidentList, activeFilter, searchQuery])

  return (
    <ValidatorLayout
      activeMenu="incidents"
      title="Lapor Insiden & Siaga Mutu"
      subtitle="Eskalasi temuan organoleptik, kontaminasi asing, dan respons tanggap darurat Satgas KawanGizi."
      primaryAction={
        <button
          type="button"
          onClick={() => {
            window.scrollTo({ top: 350, behavior: 'smooth' })
          }}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-[#123624] hover:bg-[#0e2c1d] text-white px-5 py-3 text-sm font-extrabold transition shadow-sm cursor-pointer active:scale-95"
        >
          <Plus className="h-4 w-4" />
          <span>Buat Laporan Baru</span>
        </button>
      }
      secondaryAction={
        <button
          type="button"
          onClick={() => fetchIncidentData(true)}
          disabled={isRefreshing}
          className="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-full bg-white border border-slate-300 hover:border-slate-400 text-slate-800 px-5 py-3 text-sm font-bold hover:bg-slate-50 transition shadow-xs cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${isRefreshing ? 'animate-spin text-[#185338]' : ''}`} />
          <span>Segarkan Data</span>
        </button>
      }
    >
      {/* Toast Alert Notification */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`mb-5 flex items-start gap-3 rounded-2xl border p-4 text-sm font-bold shadow-md animate-in fade-in slide-in-from-top-2 transition ${
            toast.tone === 'success'
              ? 'border-emerald-300 bg-emerald-50 text-emerald-900'
              : toast.tone === 'error'
              ? 'border-rose-300 bg-rose-50 text-rose-900'
              : 'border-amber-300 bg-amber-50 text-amber-900'
          }`}
        >
          <span className="mt-1 h-2.5 w-2.5 shrink-0 rounded-full bg-current opacity-80" />
          <p className="leading-relaxed flex-1">{toast.message}</p>
          <button
            type="button"
            onClick={() => setToast(null)}
            className="text-current opacity-60 hover:opacity-100 p-0.5 cursor-pointer"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ========================================================================= */}
      {/* RESPONSIVE TOP 4 STAT CARDS */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 lg:gap-5 mb-6">
        {/* Card 1: Total Tiket Masuk */}
        <div className="rounded-[22px] bg-[#123624] text-white p-4 sm:p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-semibold text-emerald-100/90 truncate">Total Tiket</span>
            <div className="h-7 w-7 rounded-full border border-white/20 bg-white/10 flex items-center justify-center text-white shrink-0">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="my-2 sm:my-3">
            <h3 className="text-2xl sm:text-4xl font-black tracking-tight font-mono">{incidentList.length}</h3>
          </div>
          <p className="text-xs text-emerald-200/80 font-medium truncate">SLA: &lt; 15 menit</p>
        </div>

        {/* Card 2: Tiket Dalam Tindak Lanjut */}
        <div className="rounded-[22px] bg-white border border-slate-200/80 p-4 sm:p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate">Dalam Proses</span>
            <div className="h-7 w-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
              <Clock className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="my-2 sm:my-3">
            <h3 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 font-mono">
              {activeCount}
            </h3>
          </div>
          <span className="text-xs text-amber-800 font-bold bg-amber-50 px-2.5 py-0.5 rounded-full border border-amber-200/60 self-start truncate max-w-full">
            Investigasi SPPG
          </span>
        </div>

        {/* Card 3: Tuntas Diselesaikan */}
        <div className="rounded-[22px] bg-white border border-slate-200/80 p-4 sm:p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate">Tuntas</span>
            <div className="h-7 w-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />
            </div>
          </div>
          <div className="my-2 sm:my-3">
            <h3 className="text-2xl sm:text-4xl font-black tracking-tight text-slate-900 font-mono">
              {resolvedCount}
            </h3>
          </div>
          <span className="text-xs text-emerald-800 font-bold bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200/60 self-start truncate max-w-full">
            Porsi Diganti
          </span>
        </div>

        {/* Card 4: Sirene Darurat */}
        <div className="rounded-[22px] bg-white border border-slate-200/80 p-4 sm:p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs sm:text-sm font-semibold text-slate-800 truncate">Darurat Merah</span>
            <div className="h-7 w-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-700 shrink-0">
              <Siren className={`h-3.5 w-3.5 ${highSevCount > 0 ? 'text-rose-600 animate-pulse' : 'text-slate-400'}`} />
            </div>
          </div>
          <div className="my-2 sm:my-3">
            <h3 className={`text-2xl sm:text-4xl font-black tracking-tight font-mono ${highSevCount > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
              {highSevCount}
            </h3>
          </div>
          <span className="text-xs text-slate-500 font-medium truncate">
            {highSevCount > 0 ? 'Wajib Isolasi Batch' : 'Kondisi Aman'}
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FORMULIR PELAPORAN INSIDEN & PROTOKOL (Responsive 2-Col Layout) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-8">
        {/* Formulir Pelaporan (7 cols) */}
        <section className="lg:col-span-7 bg-white rounded-[24px] border border-slate-200/80 shadow-xs p-5 sm:p-6 md:p-7 space-y-6">
          <div className="border-b border-slate-100 pb-4">
            <div className="flex items-center gap-2.5">
              <div className="h-9 w-9 rounded-2xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600 shrink-0">
                <Siren className="h-5 w-5" />
              </div>
              <div>
                <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-slate-900">
                  Formulir Eskalasi Darurat Mutu Makanan
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
                  Laporan disinkronkan langsung ke terminal dapur SPPG & Satgas KawanGizi.
                </p>
              </div>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* 1 · Kategori Insiden */}
            <div className="space-y-2.5">
              <label className="block text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-700">
                1 · Kategori Temuan Insiden
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {INCIDENT_CATEGORIES.map((c) => {
                  const isSelected = category === c.id
                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCategory(c.id)}
                      className={`min-h-[52px] text-left rounded-2xl border p-4 transition cursor-pointer select-none ${
                        isSelected
                          ? 'border-[#123624] bg-emerald-50/70 ring-2 ring-[#123624]/20 shadow-xs'
                          : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/80'
                      }`}
                    >
                      <p className={`text-xs sm:text-sm font-black ${isSelected ? 'text-[#123624]' : 'text-slate-900'}`}>
                        {c.label}
                      </p>
                      <p className="text-xs text-slate-500 mt-1 leading-relaxed">
                        {c.desc}
                      </p>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* 2 · Derajat Keparahan (Touch Target >= 44px) */}
            <div className="space-y-2.5">
              <label className="block text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-700">
                2 · Derajat Keparahan (Severity Level)
              </label>
              <div className="space-y-3">
                {SEVERITY_LEVELS.map((s) => {
                  const isSelected = severityLevel === s.id
                  return (
                    <label
                      key={s.id}
                      className={`min-h-[56px] flex items-start gap-3.5 rounded-2xl border p-4 sm:p-4.5 cursor-pointer transition select-none ${
                        isSelected
                          ? 'border-[#123624] bg-emerald-50/60 ring-2 ring-[#123624]/15 shadow-xs'
                          : 'border-slate-200 bg-slate-50/70 hover:bg-slate-100/80'
                      }`}
                    >
                      <input
                        type="radio"
                        name="severityLevel"
                        value={s.id}
                        checked={isSelected}
                        onChange={() => setSeverityLevel(s.id)}
                        className="mt-1 h-5 w-5 accent-[#123624] cursor-pointer"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className={`h-2.5 w-2.5 rounded-full ${s.dotColor} shrink-0`} />
                          <span className="text-sm font-extrabold text-slate-900">{s.label}</span>
                        </div>
                        <p className="text-xs text-slate-600 mt-1 leading-relaxed">
                          {s.desc}
                        </p>
                      </div>
                    </label>
                  )
                })}
              </div>
            </div>

            {/* 3 · Foto Bukti (Touch Target >= 44px, Stacks Neatly) */}
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <label className="block text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-700">
                  3 · Foto Bukti Terverifikasi (Maks. 3 Foto)
                </label>
                <span className="text-xs font-bold text-slate-400">
                  {evidenceImages.length} / 3 Foto
                </span>
              </div>

              {/* Hidden File Input */}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                multiple
                className="hidden"
                onChange={handleFileSelect}
              />

              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5">
                {evidenceImages.map((img, idx) => (
                  <div
                    key={img.id}
                    className="relative rounded-2xl overflow-hidden border border-slate-200 bg-slate-100 aspect-[4/3] group shadow-xs"
                  >
                    <img
                      src={img.previewUrl}
                      alt={img.label}
                      className="w-full h-full object-cover"
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 p-2.5 flex flex-col justify-between">
                      <div className="flex justify-end">
                        <button
                          type="button"
                          onClick={() => handleRemoveImage(img.id)}
                          className="h-8 w-8 rounded-full bg-rose-600 hover:bg-rose-700 text-white flex items-center justify-center transition shadow-md cursor-pointer"
                          title="Hapus foto"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                      <p className="text-xs font-bold text-white truncate">
                        {img.label}
                      </p>
                    </div>
                  </div>
                ))}

                {evidenceImages.length < 3 && (
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    className="min-h-[140px] rounded-2xl border-2 border-dashed border-slate-300 hover:border-[#123624] bg-slate-50/80 hover:bg-emerald-50/40 p-4 flex flex-col items-center justify-center gap-2 transition cursor-pointer text-center group"
                  >
                    <div className="h-10 w-10 rounded-full bg-white border border-slate-200 group-hover:border-emerald-300 flex items-center justify-center text-slate-500 group-hover:text-[#123624] transition shadow-xs">
                      <Camera className="h-5 w-5" />
                    </div>
                    <div>
                      <span className="block text-xs sm:text-sm font-extrabold text-slate-800 group-hover:text-[#123624]">
                        Ambil / Unggah Foto
                      </span>
                      <span className="block text-xs text-slate-400 mt-0.5">
                        Slot Foto {evidenceImages.length + 1}
                      </span>
                    </div>
                  </button>
                )}
              </div>
            </div>

            {/* 4 · Kronologi Kejadian */}
            <div className="space-y-2.5">
              <label className="block text-xs sm:text-sm font-extrabold uppercase tracking-wider text-slate-700">
                4 · Kronologi Kejadian & Catatan Spesifik
              </label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={3}
                placeholder="Contoh: Ditemukan 2 boks dengan aroma asam menyengat pada lauk ayam suwir di Kelas 3B pukul 07:26. Porsi segera ditahan sebelum dikonsumsi siswa..."
                className="w-full rounded-2xl bg-slate-50/90 border border-slate-200 p-4 text-xs sm:text-sm text-slate-800 leading-relaxed placeholder-slate-400 focus:outline-none focus:border-[#123624] focus:bg-white focus:ring-2 focus:ring-[#123624]/10 transition resize-y"
              />
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={isSubmitting || !description.trim()}
              className="w-full min-h-[52px] py-3.5 px-6 rounded-2xl bg-rose-600 hover:bg-rose-700 active:scale-98 text-white text-sm font-extrabold transition shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {isSubmitting ? (
                <>
                  <RefreshCw className="h-5 w-5 animate-spin" />
                  <span>Mengirimkan Laporan ke SPPG & Satgas...</span>
                </>
              ) : (
                <>
                  <Radio className="h-5 w-5" />
                  <span>Kirim Laporan Siaga ke SPPG & Satgas KawanGizi</span>
                </>
              )}
            </button>
          </form>
        </section>

        {/* Sidebar Kanan: Protokol Tindakan & Detail Kontak (5 cols) */}
        <section className="lg:col-span-5 space-y-5 self-start">
          {/* Card Protokol */}
          <div className="bg-white rounded-[24px] border border-slate-200/80 shadow-xs p-5 sm:p-6">
            <button
              type="button"
              onClick={() => setShowProtocol((v) => !v)}
              className="w-full flex items-center justify-between gap-2 cursor-pointer text-left"
            >
              <div className="flex items-center gap-2.5">
                <div className="h-8 w-8 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center shrink-0">
                  <ShieldAlert className="h-4 w-4" />
                </div>
                <h2 className="text-sm sm:text-base font-extrabold text-slate-900">
                  SOP Tindakan Pertama
                </h2>
              </div>
              <ChevronRight
                className={`h-5 w-5 text-slate-400 transition-transform ${showProtocol ? 'rotate-90' : ''}`}
              />
            </button>

            {showProtocol && (
              <ol className="mt-4 space-y-3.5 border-t border-slate-100 pt-3.5">
                {PROTOCOL_STEPS.map((step, i) => (
                  <li key={step} className="flex items-start gap-3">
                    <span className="h-6 w-6 rounded-full bg-[#123624] text-white flex items-center justify-center shrink-0 text-xs font-black font-mono shadow-xs mt-0.5">
                      {i + 1}
                    </span>
                    <p className="text-xs sm:text-sm text-slate-700 leading-relaxed font-medium">
                      {step}
                    </p>
                  </li>
                ))}
              </ol>
            )}
          </div>

          {/* Kontak Siaga Dapur SPPG */}
          <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-[24px] p-5 sm:p-6 space-y-3 shadow-xs">
            <div className="flex items-center gap-2 text-[#123624]">
              <Building2 className="h-5 w-5" />
              <h3 className="text-sm font-extrabold">
                Kontak Siaga Dapur SPPG
              </h3>
            </div>
            <div className="text-xs sm:text-sm text-slate-700 space-y-1.5 leading-relaxed">
              <p>Dapur: <strong>{parentSppg?.name || 'Dapur Sentral SPPG Menteng 01'}</strong></p>
              <p>Kepala Dapur: <strong>{parentSppg?.headChef || 'Chef Junaedi'}</strong></p>
              <p>Ahli Gizi: <strong>{parentSppg?.nutritionist || 'Siti Rahma, S.Gz'}</strong></p>
              <p className="pt-1">
                Hotline Darurat:{' '}
                <strong className="font-mono text-[#123624] text-sm">
                  {parentSppg?.phone || '+62 812-3456-7890'}
                </strong>
              </p>
            </div>
          </div>
        </section>
      </div>

      {/* ========================================================================= */}
      {/* RIWAYAT TIKET INSIDEN DARI BACKEND (Dynamic GET Integration) */}
      {/* ========================================================================= */}
      <section className="bg-white rounded-[24px] border border-slate-200/80 shadow-xs p-5 sm:p-6 md:p-7 space-y-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-4">
          <div>
            <div className="flex items-center gap-2">
              <Flame className="h-5 w-5 text-orange-600" />
              <h2 className="text-base sm:text-lg font-extrabold text-slate-900 tracking-tight">
                Riwayat & Pelacak Status Tiket Insiden
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-slate-500 font-medium mt-0.5">
              Data investigasi, penanganan sampel, dan porsi pengganti dari backend SPPG.
            </p>
          </div>

          {/* Search Field */}
          <div className="relative w-full sm:w-64">
            <Search className="h-4 w-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari ID tiket, catatan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9.5 pr-4 py-2.5 rounded-2xl border border-slate-200 bg-slate-50 text-xs sm:text-sm focus:outline-none focus:border-[#123624] focus:bg-white transition"
            />
          </div>
        </div>

        {/* Filter Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-[#123624] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua ({incidentList.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('active')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              activeFilter === 'active'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            Dalam Proses ({activeCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('resolved')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              activeFilter === 'resolved'
                ? 'bg-[#123624] text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            Selesai ({resolvedCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('high')}
            className={`px-4 py-2 rounded-xl text-xs sm:text-sm font-bold transition cursor-pointer ${
              activeFilter === 'high'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
            }`}
          >
            Darurat Merah ({highSevCount})
          </button>
        </div>

        {/* Daftar Tiket List */}
        <div className="space-y-4 pt-1">
          {isLoading ? (
            <div className="p-12 text-center rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3">
              <RefreshCw className="h-6 w-6 animate-spin text-[#123624] mx-auto" />
              <p className="text-xs sm:text-sm font-bold text-slate-600">
                Memuat riwayat insiden dari server...
              </p>
            </div>
          ) : filteredList.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-300 p-10 text-center bg-slate-50/50 space-y-2">
              <CheckCircle className="h-10 w-10 text-emerald-500 mx-auto" />
              <h3 className="text-sm sm:text-base font-extrabold text-slate-800">
                Tidak Ada Tiket Insiden
              </h3>
              <p className="text-xs sm:text-sm text-slate-500 max-w-sm mx-auto leading-relaxed">
                Seluruh distribusi makanan tercatat steril, aman, dan memenuhi standar higienis.
              </p>
            </div>
          ) : (
            filteredList.map((ticket) => {
              const sev = SEVERITY_LEVELS.find((s) => s.id === ticket.severity) || SEVERITY_LEVELS[0]
              return (
                <article
                  key={ticket.id}
                  className={`rounded-2xl border p-4 sm:p-5 transition space-y-3 ${
                    ticket.severity === 'high' && ticket.status !== 'resolved'
                      ? 'border-rose-300 bg-rose-50/30 ring-1 ring-rose-200'
                      : ticket.status === 'resolved'
                      ? 'border-slate-200 bg-white'
                      : 'border-amber-200 bg-amber-50/20'
                  }`}
                >
                  {/* Top Bar: ID, Severity, Status */}
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="font-mono text-xs sm:text-sm font-black text-slate-900 bg-slate-100 px-3 py-1 rounded-lg border border-slate-200">
                        {ticket.id}
                      </span>

                      {/* Severity Badge */}
                      <span className={`text-xs font-bold px-2.5 py-1 rounded-full border ${sev.badgeBg}`}>
                        {ticket.severityLabel || sev.label}
                      </span>

                      {/* Status Badge */}
                      <span
                        className={`text-xs font-bold px-2.5 py-1 rounded-full ${
                          ticket.status === 'resolved'
                            ? 'bg-emerald-100 text-emerald-900 border border-emerald-200'
                            : ticket.status === 'in_progress'
                            ? 'bg-sky-100 text-sky-900 border border-sky-200'
                            : 'bg-amber-100 text-amber-900 border border-amber-200'
                        }`}
                      >
                        {ticket.statusLabel || (ticket.status === 'resolved' ? 'Selesai' : 'Dalam Investigasi')}
                      </span>
                    </div>

                    <span className="text-xs text-slate-400 font-medium">
                      {ticket.openedAt || 'Baru saja'}
                    </span>
                  </div>

                  {/* Category & Description */}
                  <div>
                    <h4 className="text-sm sm:text-base font-extrabold text-slate-900">
                      {ticket.category || 'Insiden Pangan'}
                    </h4>
                    <p className="text-xs sm:text-sm text-slate-700 mt-1 leading-relaxed whitespace-pre-line">
                      {ticket.note || ticket.description || 'Tidak ada catatan tambahan.'}
                    </p>
                  </div>

                  {/* Meta Bar */}
                  <div className="pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-500 flex-wrap">
                    <span>
                      Sekolah: <strong>{ticket.schoolName || schoolInfo?.name || 'SDN 01 Menteng Pagi'}</strong>
                    </span>
                    <span>
                      Penanggung Jawab: <strong>{ticket.handler || parentSppg?.headChef || 'Dapur SPPG'}</strong>
                    </span>
                  </div>

                  {/* Responses from SPPG */}
                  {Array.isArray(ticket.responses) && ticket.responses.length > 0 && (
                    <div className="rounded-xl bg-slate-50 border border-slate-200 p-3.5 space-y-1.5">
                      <p className="text-xs font-bold text-slate-700 flex items-center gap-1.5">
                        <MessageSquare className="h-3.5 w-3.5 text-[#123624]" />
                        <span>Tanggapan Tim Dapur SPPG:</span>
                      </p>
                      {ticket.responses.map((resp, idx) => (
                        <p key={idx} className="text-xs sm:text-sm text-slate-600 leading-relaxed pl-5">
                          • {resp}
                        </p>
                      ))}
                    </div>
                  )}
                </article>
              )
            })
          )}
        </div>
      </section>
    </ValidatorLayout>
  )
}

// Export both names for maximum compatibility
export { ValidatorIncidentsPage as LaporInsidenPage }
export default ValidatorIncidentsPage
