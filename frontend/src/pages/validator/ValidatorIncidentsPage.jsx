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
  ArrowUpRight,
  Plus,
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

const SEVERITY_CHIP = {
  low: 'bg-emerald-50 text-emerald-800 border-emerald-200',
  medium: 'bg-amber-50 text-amber-800 border-amber-200',
  high: 'bg-rose-50 text-rose-800 border-rose-200 animate-pulse',
}

const SEVERITY_DOT = {
  low: 'bg-emerald-500',
  medium: 'bg-amber-500',
  high: 'bg-rose-600',
}

const EVIDENCE_SLOTS = [
  { id: 1, watermark: 'Foto 1 · Kondisi Utama' },
  { id: 2, watermark: 'Foto 2 · Detail Kontaminasi' },
  { id: 3, watermark: 'Foto 3 · Label / Batch Boks' },
]

export function ValidatorIncidentsPage() {
  const { user } = useAuth()

  // Data Bundle from Backend
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
  const [activeFilter, setActiveFilter] = useState('all')
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

  // Load Data from Backend API
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
            ? `🚨 SIRENE DARURAT DIAKTIFKAN: Tiket ${createdItem.id} terbit! Satgas KawanGizi & Dapur SPPG diinstruksikan isolasi batch.`
            : `Tiket insiden ${createdItem.id} berhasil dikirimkan ke Manajer Dapur SPPG.`,
          'success',
        )

        setCategory('')
        setPhotos([])
        setDescription('')
        setSeverity('low')

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

  const tickets = bundle?.tickets || []
  const activeTicketsCount = tickets.filter((t) => t.status !== 'resolved').length
  const resolvedTicketsCount = tickets.filter((t) => t.status === 'resolved').length
  const highSeverityCount = tickets.filter((t) => t.severity === 'high' && t.status !== 'resolved').length

  const filteredTickets = useMemo(() => {
    return tickets.filter((t) => {
      if (activeFilter === 'active' && t.status === 'resolved') return false
      if (activeFilter === 'resolved' && t.status !== 'resolved') return false
      if (activeFilter === 'high' && t.severity !== 'high') return false

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
    <ValidatorLayout
      activeMenu="incidents"
      title="Lapor Insiden & Siaga Mutu"
      subtitle="Eskalasi temuan organoleptik, kontaminasi asing, dan respons tanggap darurat Satgas KawanGizi."
      primaryAction={
        <button
          type="button"
          onClick={() => {
            setCategory('')
            setDescription('')
            setPhotos([])
          }}
          className="flex items-center gap-2 rounded-full bg-[#185338] text-white px-5 py-2.5 text-xs font-bold hover:bg-[#12422c] transition shadow-xs cursor-pointer"
        >
          <Plus className="h-4 w-4" />
          <span>+ Tiket Baru</span>
        </button>
      }
      secondaryAction={
        <button
          type="button"
          onClick={() => loadData(true)}
          disabled={refreshing}
          className="flex items-center gap-2 rounded-full bg-white border border-slate-300 text-slate-800 px-5 py-2.5 text-xs font-bold hover:bg-slate-50 transition shadow-xs cursor-pointer disabled:opacity-50"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin text-[#185338]' : ''}`} />
          <span>Segarkan Data</span>
        </button>
      }
    >
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`mb-4 flex items-start gap-3 rounded-2xl border px-4 py-3.5 text-xs animate-in fade-in transition shadow-xs ${tones[toast.tone]}`}
        >
          <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-current opacity-80" />
          <p className="leading-relaxed font-bold flex-1">{toast.message}</p>
        </div>
      )}

      {/* ========================================================================= */}
      {/* TOP 4 STAT CARDS (Donezo Style) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5 mb-6">
        {/* Card 1: Total Tiket Masuk */}
        <div className="rounded-[22px] bg-[#185338] text-white p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-emerald-100/90">Total Tiket Masuk</span>
            <div className="h-7 w-7 rounded-full border border-white/20 bg-white/10 flex items-center justify-center text-white">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="my-2">
            <h3 className="text-3xl sm:text-4xl font-black tracking-tight font-mono">{tickets.length}</h3>
          </div>
          <p className="text-[11px] text-emerald-200/80 font-medium">SLA penanganan: &lt; 15 menit</p>
        </div>

        {/* Card 2: Tiket Aktif */}
        <div className="rounded-[22px] bg-white border border-slate-200/80 p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">Tiket Dalam Tindak Lanjut</span>
            <div className="h-7 w-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-700">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="my-2">
            <h3 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 font-mono">
              {activeTicketsCount}
            </h3>
          </div>
          <span className="text-[11px] text-amber-800 font-bold bg-amber-50 px-2 py-0.5 rounded-full self-start">
            Sedang Diinvestigasi SPPG
          </span>
        </div>

        {/* Card 3: Tuntas */}
        <div className="rounded-[22px] bg-white border border-slate-200/80 p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">Tuntas Diselesaikan</span>
            <div className="h-7 w-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-700">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="my-2">
            <h3 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 font-mono">
              {resolvedTicketsCount}
            </h3>
          </div>
          <span className="text-[11px] text-emerald-700 font-bold bg-emerald-50 px-2 py-0.5 rounded-full self-start">
            Penggantian Porsi Berhasil
          </span>
        </div>

        {/* Card 4: Sirene Kritis */}
        <div className="rounded-[22px] bg-white border border-slate-200/80 p-5 flex flex-col justify-between shadow-xs">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-800">Sirene Satgas Merah</span>
            <div className="h-7 w-7 rounded-full border border-slate-200 flex items-center justify-center text-slate-700">
              <ArrowUpRight className="h-3.5 w-3.5" />
            </div>
          </div>
          <div className="my-2">
            <h3 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-900 font-mono">
              {highSeverityCount}
            </h3>
          </div>
          <span className="text-[11px] text-slate-400 font-medium">
            {highSeverityCount > 0 ? 'Batch Wajib Diisolasi' : 'Kondisi Pangan Steril'}
          </span>
        </div>
      </div>

      {/* ========================================================================= */}
      {/* FORMULIR ESKALASI DARURAT & PROTOKOL (2 Columns) */}
      {/* ========================================================================= */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-6">
        {/* Formulir Pelaporan (7 cols) */}
        <section className="lg:col-span-7 bg-white rounded-[22px] border border-slate-200/80 shadow-xs p-6 space-y-5">
          <div>
            <div className="flex items-center gap-2">
              <Siren className="h-4 w-4 text-rose-600" />
              <h2 className="text-base font-extrabold tracking-tight text-slate-900">
                Formulir Eskalasi Darurat Mutu Makanan
              </h2>
            </div>
            <p className="mt-1 text-xs text-slate-400 font-medium">
              Laporkan bau basi, benda asing, atau reaksi medis siswa secara langsung ke terminal SPPG dan dasbor pusat Satgas KawanGizi.
            </p>
          </div>

          {/* 1 · Kategori Insiden */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              1 · Kategori Insiden Mutu
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {INCIDENT_CATEGORIES.map((c) => (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCategory(c.id)}
                  className={`text-left rounded-2xl border p-3.5 transition cursor-pointer ${
                    category === c.id
                      ? 'border-[#185338] bg-emerald-50/50 ring-1 ring-[#185338]/20 shadow-xs'
                      : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50'
                  }`}
                >
                  <p className="text-xs font-black text-slate-900">{c.label}</p>
                  <p className="text-[11px] text-slate-500 mt-0.5 leading-snug">{c.desc}</p>
                </button>
              ))}
            </div>
          </div>

          {/* 2 · Foto Bukti Watermark */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              2 · Foto Bukti Terverifikasi (Maks. 3 Foto)
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {EVIDENCE_SLOTS.map((slot) => {
                const filled = photos.includes(slot.id)
                return (
                  <button
                    key={slot.id}
                    type="button"
                    onClick={() => togglePhoto(slot.id)}
                    className={`relative rounded-2xl border-2 border-dashed aspect-[4/3] flex flex-col items-center justify-center gap-1.5 transition cursor-pointer ${
                      filled
                        ? 'border-[#185338] bg-emerald-50/70 shadow-xs'
                        : 'border-slate-200 bg-slate-50/70 hover:border-slate-300'
                    }`}
                  >
                    {filled ? (
                      <ImageIcon className="h-6 w-6 text-[#185338]" />
                    ) : (
                      <Camera className="h-6 w-6 text-slate-400" />
                    )}
                    <span className="text-[10px] font-extrabold text-slate-700">
                      {filled ? 'Foto Tersimpan' : 'Ambil Foto'}
                    </span>
                    <span className="absolute bottom-2 left-2 right-2 font-mono text-[8px] text-slate-500 bg-white/90 rounded-md px-1.5 py-0.5 truncate border border-slate-200">
                      {slot.watermark}
                    </span>
                  </button>
                )
              })}
            </div>
          </div>

          {/* 3 · Derajat Keparahan */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              3 · Derajat Keparahan (Severity Level)
            </p>
            <div className="space-y-2">
              {SEVERITY_LEVELS.map((s) => (
                <label
                  key={s.id}
                  className={`flex items-start gap-3 rounded-2xl border p-3.5 cursor-pointer transition ${
                    severity === s.id
                      ? 'border-[#185338] bg-emerald-50/40 ring-1 ring-[#185338]/20'
                      : 'border-slate-200 bg-slate-50/60 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="severity"
                    value={s.id}
                    checked={severity === s.id}
                    onChange={() => setSeverity(s.id)}
                    className="mt-1 accent-[#185338]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2">
                      <span className={`h-2 w-2 rounded-full ${SEVERITY_DOT[s.id]}`} />
                      <span className="text-xs font-black text-slate-900">{s.label}</span>
                    </span>
                    <span className="block text-[11px] text-slate-500 mt-0.5 leading-snug">{s.desc}</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 4 · Kronologi Singkat */}
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-slate-400 mb-2">
              4 · Kronologi Singkat Kejadian
            </p>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="Contoh: Ditemukan 2 boks dengan aroma asam menyengat di Kelas 3B pukul 07:26, porsi ditahan sebelum dibagikan..."
              className="w-full rounded-2xl bg-slate-50/70 border border-slate-200 p-3.5 text-xs leading-relaxed focus:outline-none focus:border-[#185338] focus:bg-white transition resize-y"
            />
          </div>

          <button
            type="button"
            onClick={submitReport}
            disabled={submitting}
            className="w-full py-3.5 px-6 rounded-full bg-rose-600 hover:bg-rose-700 text-white text-xs font-black transition shadow-xs flex items-center justify-center gap-2 cursor-pointer disabled:opacity-60"
          >
            {submitting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Mengirimkan Laporan ke SPPG & Satgas...</span>
              </>
            ) : (
              <>
                <Radio className="h-4 w-4" />
                <span>Kirim Laporan Siaga ke SPPG & Satgas KawanGizi</span>
              </>
            )}
          </button>
        </section>

        {/* Sidebar Kanan: Protokol Tindakan & Detail (5 cols) */}
        <section className="lg:col-span-5 space-y-5 self-start">
          <div className="bg-white rounded-[22px] border border-slate-200/80 shadow-xs p-6">
            <button
              type="button"
              onClick={() => setShowProtocol((v) => !v)}
              className="w-full flex items-center justify-between gap-2 cursor-pointer text-left"
            >
              <div className="flex items-center gap-2">
                <ShieldAlert className="h-4 w-4 text-rose-600" />
                <h2 className="text-sm font-extrabold text-slate-900">
                  Protokol Tindakan Pertama
                </h2>
              </div>
              <ChevronRight
                className={`h-4 w-4 text-slate-400 transition-transform ${showProtocol ? 'rotate-90' : ''}`}
              />
            </button>

            {showProtocol && (
              <ol className="mt-4 space-y-3">
                {PROTOCOL_STEPS.map((step, i) => (
                  <li key={step} className="flex items-start gap-3">
                    <span className="h-6 w-6 rounded-full bg-[#185338] text-white flex items-center justify-center shrink-0 text-[11px] font-extrabold font-mono shadow-xs">
                      {i + 1}
                    </span>
                    <p className="text-xs text-slate-700 leading-relaxed font-medium">{step}</p>
                  </li>
                ))}
              </ol>
            )}
          </div>

          <div className="bg-white rounded-[22px] border border-slate-200/80 shadow-xs p-6">
            <h2 className="text-sm font-extrabold text-slate-900">Kategori Terpilih</h2>
            {selectedCat ? (
              <div className="mt-3 rounded-2xl bg-slate-50/70 border border-slate-100 p-4 space-y-2">
                <p className="text-xs font-bold text-slate-800">{selectedCat.label}</p>
                <p className="text-[11px] text-slate-500 leading-relaxed">{selectedCat.desc}</p>
                <div className="pt-2 border-t border-slate-200/60 flex items-center justify-between">
                  <span className="text-[10px] font-mono uppercase tracking-wide text-slate-400">
                    Severity:
                  </span>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${SEVERITY_CHIP[severity]}`}>
                    {selectedSev?.label}
                  </span>
                </div>
              </div>
            ) : (
              <p className="mt-2 text-[11px] text-slate-400 italic">Pilih kategori insiden pada formulir.</p>
            )}
          </div>

          {/* Kontak Siaga Dapur Induk */}
          <div className="bg-emerald-50/60 border border-emerald-200/70 rounded-[22px] p-5 space-y-2">
            <p className="text-xs font-extrabold text-[#185338] flex items-center gap-1.5">
              <Building2 className="h-4 w-4" />
              Kontak Siaga Dapur SPPG
            </p>
            <p className="text-xs text-slate-700 leading-relaxed">
              Kepala Dapur: <strong>{bundle?.parentSppg?.headChef || 'Chef Junaedi'}</strong>
              <br />
              Ahli Gizi: <strong>{bundle?.parentSppg?.nutritionist || 'Siti Rahma, S.Gz'}</strong>
              <br />
              Telepon Siaga: <strong className="font-mono text-[#185338]">{bundle?.parentSppg?.phone || '+62 812-3456-7890'}</strong>
            </p>
          </div>
        </section>
      </div>

      {/* ========================================================================= */}
      {/* PELACAK STATUS TIKET INSIDEN & TANGGAPAN */}
      {/* ========================================================================= */}
      <section className="bg-white rounded-[22px] border border-slate-200/80 shadow-xs p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-extrabold text-slate-900 tracking-tight flex items-center gap-2">
              <Flame className="h-4 w-4 text-orange-600" />
              Pelacak Status Tiket Insiden & Tanggapan Dapur
            </h2>
            <p className="text-xs text-slate-400 font-medium mt-0.5">
              Riwayat investigasi, sampel laboratorium dan porsi pengganti terpantau langsung.
            </p>
          </div>

          {/* Pill Search */}
          <div className="relative w-full sm:w-64">
            <Search className="h-3.5 w-3.5 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Cari ID tiket, catatan..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 rounded-full border border-slate-200 bg-slate-50/70 text-xs focus:outline-none focus:border-[#185338] focus:bg-white transition"
            />
          </div>
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap pt-1">
          <button
            type="button"
            onClick={() => setActiveFilter('all')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
              activeFilter === 'all'
                ? 'bg-[#185338] text-white shadow-xs'
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
            }`}
          >
            Semua ({tickets.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('active')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
              activeFilter === 'active'
                ? 'bg-amber-600 text-white shadow-xs'
                : 'bg-amber-50 text-amber-800 hover:bg-amber-100'
            }`}
          >
            Aktif ({activeTicketsCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('resolved')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
              activeFilter === 'resolved'
                ? 'bg-[#185338] text-white shadow-xs'
                : 'bg-emerald-50 text-emerald-800 hover:bg-emerald-100'
            }`}
          >
            Selesai ({resolvedTicketsCount})
          </button>
          <button
            type="button"
            onClick={() => setActiveFilter('high')}
            className={`px-4 py-1.5 rounded-full text-xs font-bold transition cursor-pointer ${
              activeFilter === 'high'
                ? 'bg-rose-600 text-white shadow-xs'
                : 'bg-rose-50 text-rose-800 hover:bg-rose-100'
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
              <p className="text-xs font-bold text-slate-700">Tidak Ada Tiket Insiden</p>
              <p className="text-[11px] text-slate-400 mt-0.5">Seluruh distribusi boks berjalan steril dan aman.</p>
            </div>
          ) : (
            filteredTickets.map((t) => (
              <article
                key={t.id}
                className={`rounded-2xl border p-4.5 transition ${
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
                      <p className="font-mono text-xs font-extrabold text-slate-900 bg-white px-2.5 py-0.5 rounded-full border border-slate-200">
                        {t.id}
                      </p>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${SEVERITY_CHIP[t.severity] || 'bg-slate-100 text-slate-700'}`}
                      >
                        {t.severityLabel || (t.severity === 'high' ? 'Tinggi / Darurat' : t.severity === 'low' ? 'Rendah' : 'Sedang')}
                      </span>
                      <span
                        className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full ${
                          t.status === 'resolved'
                            ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                            : t.status === 'in_progress'
                            ? 'bg-sky-100 text-sky-800 border border-sky-200'
                            : 'bg-amber-100 text-amber-800 border border-amber-200'
                        }`}
                      >
                        {t.statusLabel || (t.status === 'resolved' ? 'Selesai' : t.status === 'in_progress' ? 'Diproses' : 'Baru')}
                      </span>
                    </div>

                    <h3 className="text-sm font-black text-slate-900 mt-2">{t.category}</h3>
                    <p className="text-xs text-slate-600 mt-0.5 leading-relaxed">{t.note}</p>

                    <div className="flex items-center gap-3 text-[10px] text-slate-400 mt-2 flex-wrap">
                      <span>Dibuka: <strong className="text-slate-600">{t.openedAt}</strong></span>
                      <span>·</span>
                      <span>Penanggung Jawab: <strong className="text-slate-600">{t.handler}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Timeline Tahapan */}
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

                {/* Tanggapan SPPG */}
                {t.responses && t.responses.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-slate-200/80 space-y-1.5">
                    <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5">
                      <MessageSquare className="h-3 w-3 text-indigo-500" />
                      Tanggapan Resmi Dapur SPPG:
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
      </section>
    </ValidatorLayout>
  )
}

export default ValidatorIncidentsPage
