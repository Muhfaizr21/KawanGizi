import { useState, useEffect, useCallback, useMemo } from 'react'
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
  Truck,
  ExternalLink,
} from 'lucide-react'
import { ValidatorLayout } from '../../components/layout/ValidatorLayout'
import { useAuth } from '../../context/AuthContext'
import { guardAdminAction } from '../../lib/adminActions'
import {
  INCIDENT_CATEGORIES,
  SEVERITY_LEVELS,
  PROTOCOL_STEPS,
  INCIDENT_TICKETS,
} from '../../data/validatorData'
import { fetchValidatorIncidents, submitValidatorIncident } from '../../lib/api'

/**
 * ==============================================================================
 * PORTAL VALIDATOR: LAPOR INSIDEN CEPAT (PANIC BUTTON & TIKET SINKRONISASI)
 * URL: /validator/incidents
 * VALIDATOR.md Bab 4: kategori terstruktur, foto bukti watermark, severity,
 * protokol tindakan pertama, sinkronisasi real-time ke Dapur SPPG & Satgas MBG.
 * ==============================================================================
 */

const SEVERITY_CHIP = {
  low: 'bg-amber-50 text-amber-700 border-amber-200',
  medium: 'bg-orange-50 text-orange-700 border-orange-200',
  high: 'bg-rose-50 text-rose-700 border-rose-200 animate-pulse',
}

const SEVERITY_DOT = {
  low: 'bg-amber-500',
  medium: 'bg-orange-500',
  high: 'bg-rose-600',
}

const EVIDENCE_SLOTS = [
  { id: 1, watermark: 'Foto 1 · kondisi utama' },
  { id: 2, watermark: 'Foto 2 · detail kontaminasi' },
  { id: 3, watermark: 'Foto 3 · kemasan / label batch' },
]

export function ValidatorIncidentsPage() {
  const { user } = useAuth()

  // Data Bundle dari Backend
  const [bundle, setBundle] = useState(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [selectedNPSN, setSelectedNPSN] = useState('')

  // Form input state
  const [category, setCategory] = useState('')
  const [severity, setSeverity] = useState('low')
  const [photos, setPhotos] = useState([])
  const [description, setDescription] = useState('')
  const [toast, setToast] = useState(null)
  const [showProtocol, setShowProtocol] = useState(true)

  // Filter & Search Tiket
  const [activeFilter, setActiveFilter] = useState('all') // 'all' | 'active' | 'resolved' | 'high'
  const [searchQuery, setSearchQuery] = useState('')

  const showToast = (message, tone = 'info') => {
    setToast({ message, tone })
    setTimeout(() => setToast(null), 5000)
  }

  const tones = {
    info: 'border-amber-200 bg-amber-50 text-amber-900',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
    error: 'border-rose-200 bg-rose-50 text-rose-900',
  }

  // Load Data dari API Backend
  const loadData = useCallback(async (isSilent = false) => {
    if (!isSilent) setLoading(true)
    else setRefreshing(true)

    try {
      const data = await fetchValidatorIncidents({
        npsn: selectedNPSN || undefined,
      })
      if (data) {
        setBundle(data)
      } else {
        // Fallback baseline
        setBundle({
          school: {
            npsn: '33.210.130',
            name: 'SDN 01 Menteng Pagi',
            sppgId: 'SPPG-01',
          },
          parentSppg: {
            id: 'SPPG-01',
            name: 'Dapur Sentral SPPG-01 Menteng',
            code: 'BGN-SPPG-001',
            phone: '+62 812-3456-7890',
          },
          activeBatch: 'MBG-2026-SPPG01-SDN01P-B01',
          tickets: INCIDENT_TICKETS,
          lastUpdated: new Date().toISOString(),
        })
      }
    } catch (err) {
      console.error('Gagal memuat insiden validator:', err)
      showToast('Koneksi backend lambat, menggunakan data tersimpan lokal.', 'info')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [selectedNPSN])

  useEffect(() => {
    loadData()
  }, [loadData])

  const togglePhoto = (slotId) => {
    setPhotos((prev) =>
      prev.includes(slotId) ? prev.filter((p) => p !== slotId) : [...prev, slotId],
    )
  }

  // Submit Laporan Insiden Cepat
  const submitReport = async () => {
    const res = guardAdminAction(
      user,
      'ValidatorIncidents',
      'kirim laporan insiden siaga',
      { category, severity, photos: photos.length, desc: description.slice(0, 60) },
      ['incident.submit'],
    )
    if (!res.allowed) {
      showToast(res.message, 'error')
      return
    }
    if (!category) {
      showToast('Pilih kategori insiden terlebih dahulu.', 'error')
      return
    }

    setSubmitting(true)
    try {
      const payload = {
        category,
        severity,
        description: description || INCIDENT_CATEGORIES.find((c) => c.id === category)?.desc || '',
        photos,
        npsn: bundle?.school?.npsn || '33.210.130',
        sppgId: bundle?.school?.sppgId || bundle?.parentSppg?.id || 'SPPG-01',
        batchToken: bundle?.activeBatch || 'MBG-2026-SPPG01-SDN01P-B01',
        reporterName: user?.fullName || 'Petugas Validator Lapangan',
      }

      const createdItem = await submitValidatorIncident(payload)

      if (createdItem) {
        showToast(
          severity === 'high'
            ? `🚨 SIRENE DARURAT DIAKTIFKAN: Tiket ${createdItem.id} terbit! Satgas MBG & Dapur SPPG diinstruksikan isolasi batch.`
            : `Tiket insiden ${createdItem.id} berhasil dikirimkan ke Manajer Dapur SPPG.`,
          'success',
        )

        // Reset form
        setCategory('')
        setPhotos([])
        setDescription('')
        setSeverity('low')

        // Reload data segar dari backend
        await loadData(true)
      } else {
        throw new Error('Respon server kosong')
      }
    } catch (err) {
      console.error('Error kirim laporan insiden:', err)
      showToast('Gagal mengirimkan laporan insiden: ' + (err.message || 'Kesalahan jaringan'), 'error')
    } finally {
      setSubmitting(false)
    }
  }

  const selectedCat = INCIDENT_CATEGORIES.find((c) => c.id === category)
  const selectedSev = SEVERITY_LEVELS.find((s) => s.id === severity)

  // Metrik Tiket
  const tickets = bundle?.tickets || []
  const activeTicketsCount = tickets.filter((t) => t.status !== 'resolved').length
  const resolvedTicketsCount = tickets.filter((t) => t.status === 'resolved').length
  const highSeverityCount = tickets.filter((t) => t.severity === 'high' && t.status !== 'resolved').length

  // Filter Tiket
  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      // 1. Status Filter
      if (activeFilter === 'active' && t.status === 'resolved') return false
      if (activeFilter === 'resolved' && t.status !== 'resolved') return false
      if (activeFilter === 'high' && t.severity !== 'high') return false

      // 2. Search query
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase()
        const matchId = t.id?.toLowerCase().includes(q)
        const matchCat = t.category?.toLowerCase().includes(q)
        const matchNote = t.note?.toLowerCase().includes(q)
        const matchSchool = t.schoolName?.toLowerCase().includes(q)
        if (!matchId && !matchCat && !matchNote && !matchSchool) return false
      }
      return true
    })
  }, [tickets, activeFilter, searchQuery])

  return (
    <ValidatorLayout activeMenu="incidents" title="Lapor Insiden Cepat" badge="PANIC BUTTON & TIKET">
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`flex items-start gap-3 rounded-xl border px-4 py-3.5 text-xs animate-in fade-in transition shadow-sm ${tones[toast.tone]}`}
        >
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-current opacity-80" />
          <p className="leading-relaxed font-semibold flex-1">{toast.message}</p>
        </div>
      )}

      {/* Header Context Bar: Sinkronisasi Lintas Role */}
      <section className="rounded-2xl border border-slate-200/80 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white p-5 shadow-sm">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase tracking-wider bg-rose-500/20 text-rose-300 border border-rose-500/30">
                <ShieldAlert className="h-3 w-3 text-rose-400" />
                Jalur Eskalasi Darurat MBG
              </span>
              <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-mono font-bold bg-white/10 text-slate-300 border border-white/10">
                <Clock className="h-3 w-3 text-amber-400" />
                SLA Tindak Lanjut: &lt; 15 Menit
              </span>
            </div>
            <h1 className="text-base sm:text-lg font-extrabold tracking-tight">
              {bundle?.school?.name || 'SDN 01 Menteng Pagi'}
              <span className="ml-2 font-mono text-xs font-normal text-slate-400">
                (NPSN: {bundle?.school?.npsn || '33.210.130'})
              </span>
            </h1>
            <p className="text-xs text-slate-300 flex items-center gap-2 flex-wrap">
              <span>Dapur Induk: <strong>{bundle?.parentSppg?.name || 'Dapur Sentral SPPG-01 Menteng'}</strong></span>
              <span className="text-slate-500">·</span>
              <span className="font-mono text-emerald-300 bg-emerald-950/60 px-2 py-0.5 rounded border border-emerald-500/30 text-[11px]">
                Batch: {bundle?.activeBatch || 'MBG-2026-SPPG01-SDN01P-B01'}
              </span>
            </p>
          </div>

          <div className="flex items-center gap-2.5 self-start md:self-auto">
            {/* Superadmin School Switcher */}
            {user?.role === 'superadmin' && bundle?.availableSchools?.length > 0 && (
              <select
                aria-label="Pilih sekolah untuk pantauan tiket insiden"
                value={selectedNPSN}
                onChange={(e) => setSelectedNPSN(e.target.value)}
                className="bg-slate-800 border border-slate-700 text-xs rounded-xl px-3 py-2 text-white font-medium focus:outline-none focus:ring-2 focus:ring-rose-500 cursor-pointer"
              >
                <option value="">Semua Sekolah / Default</option>
                {bundle.availableSchools.map((s) => (
                  <option key={s.npsn} value={s.npsn}>
                    {s.name} ({s.npsn})
                  </option>
                ))}
              </select>
            )}

            <button
              type="button"
              onClick={() => loadData(true)}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl bg-white/10 hover:bg-white/20 border border-white/15 px-3 py-2 text-xs font-bold transition text-white cursor-pointer disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} />
              <span>{refreshing ? 'Menyinkronkan...' : 'Segarkan Data'}</span>
            </button>
          </div>
        </div>

        {/* Metrik Ringkas Insiden */}
        <div className="mt-4 pt-4 border-t border-white/10 grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">Total Tiket Masuk</p>
            <p className="text-lg font-black text-white mt-0.5">{tickets.length}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
            <p className="text-[10px] font-bold text-amber-400 uppercase tracking-wider">Tiket Aktif / Proses</p>
            <p className="text-lg font-black text-amber-400 mt-0.5">{activeTicketsCount}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
            <p className="text-[10px] font-bold text-emerald-400 uppercase tracking-wider">Tuntas Diselesaikan</p>
            <p className="text-lg font-black text-emerald-400 mt-0.5">{resolvedTicketsCount}</p>
          </div>
          <div className="bg-white/5 rounded-xl p-2.5 border border-white/5">
            <p className="text-[10px] font-bold text-rose-400 uppercase tracking-wider">Sirene Satgas Merah</p>
            <p className="text-lg font-black text-rose-400 mt-0.5">{highSeverityCount}</p>
          </div>
        </div>
      </section>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Form Laporan Insiden */}
        <section className="lg:col-span-2 bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-5">
          <div>
            <div className="flex items-center gap-2">
              <Siren className="h-4 w-4 text-rose-600 animate-bounce" />
              <h2 className="text-sm font-extrabold tracking-tight text-slate-900">
                Formulir Eskalasi Darurat Mutu Makanan
              </h2>
            </div>
            <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
              Laporkan bau basi, benda asing, atau reaksi medis siswa secara seketika. Tiket ini langsung terdistribusi ke
              terminal dapur SPPG dan dasbor pusat Satgas MBG untuk tindakan karantina porsi.
            </p>
          </div>

          {/* 1 · Kategori Insiden */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              1 · Kategori Insiden Mutu
            </p>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2">
              {INCIDENT_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={`text-left rounded-xl border p-3 transition cursor-pointer ${
                    category === c.id
                      ? 'border-rose-300 bg-rose-50/70 ring-1 ring-rose-200 shadow-xs'
                      : 'border-slate-200 bg-slate-50/60 hover:border-slate-300'
                  }`}
                >
                  <p className="text-xs font-bold text-slate-800">{c.label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{c.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 2 · Foto Bukti Watermark */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              2 · Foto Bukti Terverifikasi (Maks. 3 Foto Digital)
            </p>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-3 gap-2">
              {EVIDENCE_SLOTS.map((slot) => {
                const filled = photos.includes(slot.id)
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => togglePhoto(slot.id)}
                    className={`relative rounded-xl border-2 border-dashed aspect-[4/3] flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
                      filled
                        ? 'border-amber-400 bg-amber-50/70 shadow-inner'
                        : 'border-slate-300 bg-slate-50 hover:border-slate-400'
                    }`}
                  >
                    {filled ? (
                      <ImageIcon className="h-6 w-6 text-amber-600" />
                    ) : (
                      <Camera className="h-6 w-6 text-slate-400" />
                    )}
                    <span className="text-[10px] font-semibold text-slate-600">
                      {filled ? 'Foto Tersimpan' : 'Ambil Foto'}
                    </span>
                    <span className="absolute bottom-1.5 left-1.5 right-1.5 font-mono text-[8px] text-slate-500 bg-white/90 rounded px-1 py-0.5 truncate border border-slate-200">
                      {slot.watermark} · {bundle?.school?.npsn || '33.210.130'}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 3 · Derajat Keparahan */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              3 · Derajat Keparahan (Severity Level)
            </p>
            <div className="mt-2 space-y-2">
              {SEVERITY_LEVELS.map((s) => (
                <label
                  key={s.id}
                  className={`flex items-start gap-3 rounded-xl border p-3 cursor-pointer transition ${
                    severity === s.id
                      ? 'border-rose-300 bg-rose-50/60 ring-1 ring-rose-200'
                      : 'border-slate-200 bg-slate-50/60 hover:border-slate-300'
                  }`}
                >
                  <input
                    type="radio"
                    name="severity"
                    value={s.id}
                    checked={severity === s.id}
                    onChange={() => setSeverity(s.id)}
                    className="mt-1 accent-rose-600"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${SEVERITY_DOT[s.id]}`} />
                      <span className="text-xs font-bold text-slate-800">{s.label}</span>
                    </span>
                    <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">{s.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 4 · Kronologi Singkat */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400">
              4 · Kronologi Singkat Kejadian
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Contoh: Ditemukan 2 boks dengan aroma asam menyengat di Kelas 3B pukul 07:26, porsi ditahan sebelum dibagikan ke siswa..."
              className="mt-2 w-full rounded-xl bg-slate-50 border border-slate-200 px-3.5 py-3 text-xs leading-relaxed focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition resize-y"
            />
          </div>

          {selectedSev?.id === 'high' && (
            <div className="text-[11px] text-rose-800 bg-rose-50 border border-rose-200 rounded-xl p-3 leading-relaxed flex items-start gap-2 animate-in fade-in">
              <AlertTriangle className="h-4 w-4 text-rose-600 shrink-0 mt-0.5" />
              <div>
                <p className="font-bold">Protokol Darurat Merah Diaktifkan:</p>
                <p className="mt-0.5 text-rose-700">
                  Push sirene akan langsung berbunyi di konsol kendali Satgas MBG & Manajer Dapur SPPG.
                  Mohon <strong>ISOLASI SELURUH BOKS</strong> di sekolah agar tidak dibagikan ke kelas lain.
                </p>
              </div>
            </div>
          )}

          <button
            type="button"
            onClick={submitReport}
            disabled={submitting}
            className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white px-4 py-3.5 text-sm font-extrabold transition shadow-md shadow-rose-500/20 cursor-pointer disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Mengirimkan Laporan ke SPPG & Satgas...</span>
              </>
            ) : (
              <>
                <Radio className="h-4 w-4" />
                <span>Kirim Laporan Siaga ke SPPG & Satgas MBG</span>
              </>
            )}
          </button>
        </section>

        {/* Protokol Tindakan & Detail Terpilih */}
        <section className="space-y-5 self-start">
          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <button
              type="button"
              onClick={() => setShowProtocol((v) => !v)}
              className="w-full flex items-center justify-between gap-2 cursor-pointer"
            >
              <div className="flex items-center gap-2 text-left">
                <ShieldAlert className="h-4 w-4 text-rose-600" />
                <h2 className="text-sm font-extrabold tracking-tight text-slate-900">
                  Protokol Tindakan Pertama
                </h2>
              </div>
              <ChevronRight
                className={`h-4 w-4 text-slate-400 transition-transform ${showProtocol ? 'rotate-90' : ''}`}
              />
            </button>

            {showProtocol && (
              <ol className="mt-3.5 space-y-3">
                {PROTOCOL_STEPS.map((step, i) => (
                  <li key={step} className="flex items-start gap-3">
                    <span className="h-6 w-6 rounded-lg bg-rose-600 text-white flex items-center justify-center shrink-0 text-[11px] font-extrabold font-mono shadow-xs">
                      {i + 1}
                    </span>
                    <p className="text-xs text-slate-700 leading-relaxed font-medium">{step}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5">
            <h2 className="text-sm font-extrabold tracking-tight text-slate-900">Kategori Terpilih</h2>
            {selectedCat ? (
              <div className="mt-2.5 rounded-xl bg-slate-50 border border-slate-100 p-3.5 space-y-1.5">
                <p className="text-xs font-bold text-slate-800">{selectedCat.label}</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">{selectedCat.desc}</p>
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wide text-slate-400">
                    Severity:
                  </span>
                  <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${SEVERITY_CHIP[severity]}`}>
                    {selectedSev?.label}
                  </span>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-slate-400 italic">Belum ada kategori yang dipilih pada formulir.</p>
            )}
          </div>

          {/* Info Kontak Darurat SPPG */}
          <div className="bg-amber-50/70 border border-amber-200/80 rounded-2xl p-4 space-y-2">
            <p className="text-xs font-bold text-amber-900 flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5 text-amber-700" />
              Kontak Siaga Dapur Induk
            </p>
            <p className="text-[11px] text-amber-800 leading-relaxed">
              Kepala Dapur: <strong>{bundle?.parentSppg?.headChef || 'Chef Junaedi'}</strong>
              <br />
              Ahli Gizi: <strong>{bundle?.parentSppg?.nutritionist || 'Siti Rahma, S.Gz'}</strong>
              <br />
              Telepon Siaga: <strong className="font-mono">{bundle?.parentSppg?.phone || '+62 812-3456-7890'}</strong>
            </p>
          </div>
        </section>
      </div>

      {/* Pelacak Status Tiket Insiden Real-Time */}
      <section className="bg-white rounded-2xl border border-slate-200/80 shadow-xs p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-sm font-extrabold tracking-tight text-slate-900 flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-600" />
              Pelacak Status Tiket Insiden & Tanggapan Dapur
            </h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              Seluruh riwayat penanganan, tanggapan sampel organoleptik dari SPPG, dan porsi pengganti terpantau di sini.
            </p>
          </div>

          {/* Quick Search */}
          <div className="relative w-full sm:w-64">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari ID tiket, kategori, catatan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-8 pr-3 py-1.5 rounded-xl border border-slate-200 bg-slate-50 text-xs focus:outline-none focus:ring-2 focus:ring-rose-500 focus:bg-white transition"
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-slate-900 text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua ({tickets.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('active')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
              activeFilter === 'active'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-700 hover:bg-amber-100'
            }`}
          >
            Aktif / Proses ({activeTicketsCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('resolved')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
              activeFilter === 'resolved'
                ? 'bg-emerald-600 text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
            }`}
          >
            Selesai ({resolvedTicketsCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('high')}
            className={`px-3 py-1 rounded-full text-xs font-bold transition cursor-pointer ${
              activeFilter === 'high'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-700 hover:bg-rose-100'
            }`}
          >
            Darurat Merah ({highSeverityCount})
          </button>
        </div>

        {/* Daftar Tiket */}
        <div className="space-y-4 pt-2">
          {filteredTickets.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 p-8 text-center bg-slate-50/50">
              <CheckCircle className="h-8 w-8 text-slate-300 mx-auto mb-2" />
              <p className="text-xs font-bold text-slate-700">Tidak ada tiket insiden yang sesuai filter</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Seluruh distribusi boks makanan berjalan aman dan steril.</p>
            </div>
          ) : (
            filteredTickets.map((t) => (
              <article
                key={t.id}
                className={`rounded-2xl border p-4 transition ${
                  t.fresh
                    ? 'border-rose-300 bg-rose-50/40 ring-1 ring-rose-200'
                    : t.status === 'resolved'
                    ? 'border-slate-200 bg-slate-50/40'
                    : 'border-amber-200/80 bg-amber-50/30'
                }`}
              >
                <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-mono text-xs font-extrabold text-slate-900 bg-white px-2 py-0.5 rounded border border-slate-200">
                        {t.id}
                      </p>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${SEVERITY_CHIP[t.severity] || 'bg-slate-100 text-slate-700'}`}
                      >
                        {t.severityLabel || (t.severity === 'high' ? 'Tinggi / Darurat Merah' : t.severity === 'low' ? 'Rendah' : 'Sedang')}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                          t.status === 'resolved'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : t.status === 'in_progress'
                            ? 'bg-sky-100 text-sky-800 border border-sky-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {t.statusLabel || (t.status === 'resolved' ? 'Selesai' : t.status === 'in_progress' ? 'Sedang Ditindaklanjuti' : 'Baru Masuk')}
                      </span>
                    </div>

                    <h3 className="text-sm font-bold text-slate-900 mt-2">{t.category}</h3>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed font-normal">{t.note}</p>

                    <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-2 flex-wrap">
                      <span>Dibuka: <strong className="text-slate-600">{t.openedAt}</strong></span>
                      <span>·</span>
                      <span>Penanggung Jawab: <strong className="text-slate-600">{t.handler}</strong></span>
                      {t.schoolName && (
                        <>
                          <span>·</span>
                          <span>Sekolah: <strong className="text-slate-600">{t.schoolName}</strong></span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                {/* Timeline Tahapan Penanganan */}
                {t.timeline && (
                  <ol className="mt-3.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {t.timeline.map((step) => (
                      <li
                        key={step.label}
                        className={`rounded-xl border px-3 py-2 transition ${
                          step.done
                            ? 'bg-emerald-50/90 border-emerald-200'
                            : 'bg-white border-dashed border-slate-200'
                        }`}
                      >
                        <div className="flex items-center gap-1.5">
                          {step.done ? (
                            <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          ) : (
                            <span className="h-3.5 w-3.5 rounded-full border-2 border-slate-300 shrink-0" />
                          )}
                          <p
                            className={`text-[10px] font-bold leading-tight ${
                              step.done ? 'text-emerald-900' : 'text-slate-400'
                            }`}
                          >
                            {step.label}
                          </p>
                        </div>
                        <p className="font-mono text-[9px] text-slate-500 mt-1">{step.time || '—'}</p>
                      </li>
                    ))}
                  </ol>
                )}

                {/* Riwayat Tanggapan Resmi Dapur SPPG */}
                {t.responses && t.responses.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <MessageSquare className="h-3 w-3 text-indigo-500" />
                      Tanggapan Resmi & Uji Sampel Dapur SPPG:
                    </p>
                    <div className="space-y-1">
                      {t.responses.map((resp, i) => (
                        <div
                          key={i}
                          className="bg-indigo-50/60 border border-indigo-100 rounded-xl px-3 py-2 text-xs text-indigo-950 leading-relaxed font-medium"
                        >
                          {resp}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </article>
            ))
          )}
        </div>

        {/* Footer Actions */}
        <div className="pt-2 flex items-center justify-between flex-wrap gap-2 border-t border-slate-100">
          <button
            type="button"
            onClick={() =>
              showToast('Laporan tembusan insiden dikirimkan ke Kepala Sekolah & Komite via WhatsApp/Email resmi.', 'info')
            }
            className="inline-flex items-center gap-1.5 text-xs font-bold text-amber-700 hover:text-amber-800 transition cursor-pointer"
          >
            <Send className="h-3.5 w-3.5" />
            <span>Kirim Tembusan Laporan ke Kepala Sekolah & Komite</span>
          </button>

          <span className="text-[10px] font-mono text-slate-400">
            Terakhir disinkronkan: {bundle?.lastUpdated ? new Date(bundle.lastUpdated).toLocaleTimeString('id-ID') : 'Baru saja'} WIB
          </span>
        </div>
      </section>
    </ValidatorLayout>
  )
}

export default ValidatorIncidentsPage
